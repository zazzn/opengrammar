/**
 * iPhone-style autocorrect for OGrammar (opt-in, default off).
 *
 * Behaviour, proven on the desktop sibling app:
 *  - Only acts while typing FORWARD (caret at the end of the field) so we never
 *    rewrite text the user is editing in the middle.
 *  - Only auto-applies HIGH-CONFIDENCE fixes — i.e. issues the background has
 *    already classified as `route === 'quick-fix'` (capitalization, punctuation,
 *    small-edit spelling). We never re-classify here.
 *  - Only touches a word the user JUST completed before the caret (past the
 *    common prefix with the previous text, and ending at/before the caret).
 *  - REVERT-LEARNING: if the user undoes an auto-apply (the field returns to the
 *    exact text we had right before we applied it), we remember that
 *    `${original}->${suggestion}` pair and never auto-apply it again. Exact-text
 *    matching avoids the false positive of the user simply typing the same typo
 *    a second time.
 *
 * The rejected set is persisted in chrome.storage.sync under `autocorrectRejected`
 * so it follows the user across signed-in Chrome profiles.
 */
import type { Issue } from '../types';
import { applyFix } from './editorAdapter';

const REJECTED_STORAGE_KEY = 'autocorrectRejected';

/** Recent auto-applies are remembered for this long for revert-learning. */
const REVERT_WINDOW_MS = 25_000;

/** One auto-applied fix, kept briefly so we can detect a user undo. */
interface RecentApply {
  /** The full field text immediately BEFORE we applied this fix. */
  preText: string;
  original: string;
  suggestion: string;
  at: number;
}

/** Ring buffer of recent auto-applies, newest last; pruned by time. */
const recentApplies: RecentApply[] = [];

/**
 * Per-element record of the text we saw on the previous call, used as the diff
 * baseline. The content script overwrites `EditableElement.lastText` on `input`
 * *before* the debounced grammar check resolves, so we cannot rely on the
 * caller's `lastText` for the diff — we track our own here.
 */
const prevTextByElement = new WeakMap<HTMLElement, string>();

/** In-memory copy of the persisted rejected set (`${original}->${suggestion}`). */
const rejectedKeys = new Set<string>();

function rejectedKey(original: string, suggestion: string): string {
  return `${original}->${suggestion}`;
}

export function isRejected(original: string, suggestion: string): boolean {
  return rejectedKeys.has(rejectedKey(original, suggestion));
}

/**
 * Remember (and persist) that the user rejected an auto-apply. Guards against
 * garbage: only stores when `original` is alphabetic and at least 2 chars, so a
 * stray punctuation or single-letter pair can never poison the set.
 */
export function addRejected(original: string, suggestion: string): void {
  if (original.length < 2 || !/^[A-Za-z]+$/.test(original)) return;
  const key = rejectedKey(original, suggestion);
  if (rejectedKeys.has(key)) return;
  rejectedKeys.add(key);
  try {
    chrome.storage.sync.set({ [REJECTED_STORAGE_KEY]: Array.from(rejectedKeys) });
  } catch {
    /* storage may be unavailable if the context was invalidated */
  }
}

function applyRejectedList(value: unknown): void {
  rejectedKeys.clear();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string') rejectedKeys.add(entry);
    }
  }
}

/** Load the persisted rejected set into memory. Call once on init. */
export async function initAutocorrect(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get([REJECTED_STORAGE_KEY]);
    applyRejectedList(result[REJECTED_STORAGE_KEY]);
  } catch {
    /* leave the set empty if storage is unavailable */
  }
}

/** Keep the in-memory rejected set in sync with storage changes. */
export function onRejectedStorageChange(newValue: unknown): void {
  applyRejectedList(newValue);
}

/** Length of the common prefix of two strings. */
function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

function pruneRecentApplies(now: number): void {
  for (let i = recentApplies.length - 1; i >= 0; i--) {
    if (now - recentApplies[i].at > REVERT_WINDOW_MS) recentApplies.splice(i, 1);
  }
}

/** Move the caret to the very end of the field after we edit it. */
function moveCaretToEnd(element: HTMLElement): void {
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    const el = element as HTMLInputElement | HTMLTextAreaElement;
    try {
      el.setSelectionRange(el.value.length, el.value.length);
    } catch {
      /* some input types don't support selection */
    }
    return;
  }
  const sel = window.getSelection();
  if (!sel) return;
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    /* noop */
  }
}

/**
 * Maybe auto-apply high-confidence fixes for text the user just typed.
 *
 * @param element     the focused editable element
 * @param text        the element's current text (offsets in `issues` index this)
 * @param lastText    the caller's previous text (fallback diff baseline only)
 * @param issues      issues computed for `text` this cycle
 * @param caretOffset caret position as a character offset into `text`
 */
export function maybeAutocorrect(
  element: HTMLElement,
  text: string,
  lastText: string,
  issues: Issue[],
  caretOffset: number,
): void {
  const now = Date.now();
  pruneRecentApplies(now);

  // Our own previous-text record is the reliable diff baseline (see above);
  // fall back to the caller's value the first time we see this element.
  const tracked = prevTextByElement.get(element);
  const baseline = tracked !== undefined ? tracked : lastText;

  // REVERT-LEARNING: if the field now exactly equals the text we had right
  // before applying a fix, the user undid it. Learn it and consume the entry.
  for (let i = recentApplies.length - 1; i >= 0; i--) {
    if (recentApplies[i].preText === text) {
      const undone = recentApplies.splice(i, 1)[0];
      addRejected(undone.original, undone.suggestion);
    }
  }

  // Record the current text as the baseline for the next call, regardless of
  // whether we end up applying anything below.
  prevTextByElement.set(element, text);

  // Need a previous text to diff — never auto-edit pre-existing text on first
  // sight of a field.
  if (baseline === undefined || baseline === text) return;

  // Only act when the caret is at the END (typing forward): everything from the
  // caret onward must be whitespace.
  if (caretOffset < 0 || caretOffset > text.length) return;
  if (text.slice(caretOffset).trim().length > 0) return;

  const firstDiff = commonPrefixLength(baseline, text);

  // Eligible: a high-confidence fix for a word the user just COMPLETED before
  // the caret, freshly typed (past the common prefix), not previously rejected.
  const eligible = issues.filter((issue) => {
    if (issue.route !== 'quick-fix') return false;
    if (!issue.suggestion || issue.suggestion === issue.original) return false;
    const end = issue.offset + issue.length;
    if (end > caretOffset) return false; // word not finished yet
    if (end <= firstDiff) return false; // not freshly typed
    if (isRejected(issue.original, issue.suggestion)) return false;
    return true;
  });

  if (eligible.length === 0) return;

  // Apply right-to-left so earlier offsets stay valid as text shifts length.
  eligible.sort((a, b) => b.offset - a.offset);

  let appliedAny = false;
  for (const issue of eligible) {
    const ok = applyFix(element, {
      original: issue.original,
      offset: issue.offset,
      length: issue.length,
      replacement: issue.suggestion,
    });
    if (ok) {
      appliedAny = true;
      recentApplies.push({
        preText: text,
        original: issue.original,
        suggestion: issue.suggestion,
        at: now,
      });
    }
  }

  if (appliedAny) {
    // We only act when the caret was already at the end, so end is correct.
    moveCaretToEnd(element);
  }
}
