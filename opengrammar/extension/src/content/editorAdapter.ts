/**
 * ONE apply primitive for every field type.
 *
 * Replaces the three divergent, fragile apply paths (raw `el.value =`,
 * `range.insertNode`+`normalize`, per-call splices) that caused: fixes not
 * landing on React-controlled inputs, corruption/revert on framework rich
 * editors, and caret jumps.
 *
 * Strategy (per the research): validate the span, focus, set the native
 * selection to it, then drive the browser's real editing pipeline via
 * `execCommand('insertText')`. That fires genuine beforeinput/input, so
 * React/Vue value tracking and ProseMirror/Lexical/Slate/Quill/TipTap/
 * CodeMirror transaction systems all observe it, undo is preserved, and
 * the caret ends up correctly placed. Fallbacks cover the rare cases.
 */
import { buildTextMap, offsetToRange, resolveInString, resolveSpan } from './textMap';

export type EditorKind =
  | 'input'
  | 'textarea'
  | 'draft'
  | 'gmail'
  | 'lexical'
  | 'prosemirror'
  | 'slate'
  | 'quill'
  | 'ckeditor'
  | 'codemirror'
  | 'contenteditable';

export function detectEditor(el: HTMLElement): EditorKind {
  if (el.tagName === 'INPUT') return 'input';
  if (el.tagName === 'TEXTAREA') return 'textarea';
  if (el.closest('.public-DraftEditor-content')) return 'draft';
  // Gmail compose body: contenteditable that Gmail's own editor reconciles in
  // the same frame, reverting a naive insert. Detected via stable selectors so
  // we can give it the deferred re-apply below.
  if (el.closest('div[g_editable="true"], div[aria-label="Message Body"][contenteditable="true"]')) {
    return 'gmail';
  }
  if (el.closest('[data-lexical-editor="true"]')) return 'lexical';
  if (el.closest('.ProseMirror')) return 'prosemirror';
  if (el.closest('[data-slate-editor="true"]')) return 'slate';
  if (el.closest('.ql-editor')) return 'quill';
  if (el.closest('.ck-editor__editable')) return 'ckeditor';
  if (el.closest('.cm-editor, .cm-content, .CodeMirror')) return 'codemirror';
  return 'contenteditable';
}

export interface Fix {
  original: string;
  offset: number;
  length: number;
  replacement: string;
}

function fireInput(el: HTMLElement, replacement: string) {
  try {
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: replacement }),
    );
  } catch {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** input/textarea: execCommand keeps undo + notifies React/Vue; native
 *  prototype-setter is the fallback when execCommand is unavailable. */
function applyToFormField(
  el: HTMLInputElement | HTMLTextAreaElement,
  fix: Fix,
): boolean {
  const val = el.value;
  const span = resolveInString(val, fix.offset, fix.length, fix.original);
  if (!span) return false;
  el.focus();
  try {
    el.setSelectionRange(span.start, span.end);
  } catch {
    /* number/email inputs may not support selection — fall through */
  }
  const before = el.value;
  let ok = false;
  try {
    ok = document.execCommand('insertText', false, fix.replacement);
  } catch {
    ok = false;
  }
  if (!ok || el.value === before) {
    // React/Vue-safe: call the *prototype* value setter so framework
    // value-trackers observe the change, then fire a bubbling input.
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    const next = val.slice(0, span.start) + fix.replacement + val.slice(span.end);
    if (setter) setter.call(el, next);
    else el.value = next;
    const caret = span.start + fix.replacement.length;
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      /* noop */
    }
    fireInput(el, fix.replacement);
    return true;
  }
  fireInput(el, fix.replacement);
  return true;
}

/**
 * Did the replacement actually land? Re-reads the field's current text and
 * confirms `replacement` is present at the offset we targeted (tolerating the
 * fact that frameworks may renormalize whitespace/nodes around it). This is
 * how we distinguish a real apply from one a framework silently reverted.
 */
function replacementLanded(el: HTMLElement, span: { start: number }, fix: Fix): boolean {
  if (fix.replacement === '') {
    // Deletion: success means the original text is no longer sitting at `start`.
    const now = buildTextMap(el).text;
    return now.slice(span.start, span.start + fix.original.length) !== fix.original;
  }
  const now = buildTextMap(el).text;
  // Primary check: the replacement sits exactly where we inserted it.
  if (now.slice(span.start, span.start + fix.replacement.length) === fix.replacement) {
    return true;
  }
  // Tolerant check: some editors re-wrap or shift by a character (e.g. a
  // leading/trailing space normalization). Accept if the replacement appears in
  // a small window around the target AND the original no longer occupies it.
  const windowStart = Math.max(0, span.start - 2);
  const windowEnd = span.start + fix.replacement.length + 2;
  const around = now.slice(windowStart, windowEnd);
  const stillOriginal =
    fix.original !== fix.replacement &&
    now.slice(span.start, span.start + fix.original.length) === fix.original;
  return around.includes(fix.replacement) && !stillOriginal;
}

/** contenteditable + framework editors: select the span, drive
 *  execCommand('insertText'); fall back to a minimal, caret-preserving
 *  DOM splice (never normalize()). After applying we VERIFY the insert
 *  actually landed (frameworks like Draft/Gmail/Lexical can silently revert
 *  it on their next reconcile tick) and retry once before giving up. */
function applyToRichEditor(el: HTMLElement, fix: Fix, kind: EditorKind): boolean {
  const map = buildTextMap(el);
  const span = resolveSpan(map, fix.offset, fix.length, fix.original);
  if (!span) return false;

  // Perform one insert attempt. Re-resolves the span each time so a retry works
  // against the editor's current DOM (a partial/reverted first attempt may have
  // shifted nodes). Returns whether the insert verifiably landed.
  const attempt = (): boolean => {
    const liveMap = buildTextMap(el);
    const liveSpan = resolveSpan(liveMap, fix.offset, fix.length, fix.original);
    // If the original span is already gone, the change may have landed on a
    // prior tick — verify against the offset we originally targeted.
    if (!liveSpan) return replacementLanded(el, span, fix);
    const range = offsetToRange(liveMap, liveSpan.start, liveSpan.end);
    if (!range) return false;

    el.focus();
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);

    let ok = false;
    try {
      ok = document.execCommand('insertText', false, fix.replacement);
    } catch {
      ok = false;
    }
    if (!ok) {
      // Minimal DOM fallback with caret placed AFTER the inserted text.
      try {
        range.deleteContents();
        const tn = document.createTextNode(fix.replacement);
        range.insertNode(tn);
        const after = document.createRange();
        after.setStartAfter(tn);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
      } catch {
        return false;
      }
    }
    fireInput(el, fix.replacement);
    return replacementLanded(el, liveSpan, fix);
  };

  // Synchronous first attempt for everything. Draft.js / Gmail reconcile their
  // state on a tick, so a same-frame insert can race the reconciler — for those
  // we ALSO schedule a verify+retry on the next tick. For all other editors we
  // verify immediately and only retry-on-tick if the synchronous insert didn't
  // verify (covers any framework that silently reverts).
  if (kind === 'draft' || kind === 'gmail') {
    // These editors are known to revert synchronous inserts; the authoritative
    // apply is the deferred one. We can't report the deferred result back
    // synchronously, so do a best-effort sync insert, then re-apply + verify on
    // the next tick, and report optimistic success (the field is editable and
    // the span matched). The caller's own re-analysis will re-flag if it fails.
    attempt();
    setTimeout(() => {
      if (!replacementLanded(el, span, fix)) attempt();
    }, 0);
    return true;
  }

  if (attempt()) return true;
  // The synchronous insert did not verify. It may be a framework that applies
  // on a microtask/tick; retry ONCE on the next tick as a best-effort so the
  // user's text still gets corrected. We can't block to report that deferred
  // result, so the synchronous return below stays false — the caller treats it
  // as a failed apply (keeps the underline/card), and the field's own
  // re-analysis will clear it if the retry did land.
  setTimeout(() => {
    if (!replacementLanded(el, span, fix)) attempt();
  }, 0);
  return false;
}

/**
 * Apply one correction to any editable element. Validates the span first
 * (re-finds `original` near the offset; returns false instead of
 * corrupting if it no longer matches). Returns true if applied.
 */
export function applyFix(element: HTMLElement, fix: Fix): boolean {
  if (!fix.replacement && fix.replacement !== '') return false;
  if (fix.original === fix.replacement) return false;
  const kind = detectEditor(element);
  if (kind === 'input' || kind === 'textarea') {
    return applyToFormField(element as HTMLInputElement | HTMLTextAreaElement, fix);
  }
  return applyToRichEditor(element, fix, kind);
}
