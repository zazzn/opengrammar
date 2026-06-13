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

/** contenteditable + framework editors: select the span, drive
 *  execCommand('insertText'); fall back to a minimal, caret-preserving
 *  DOM splice (never normalize()). After applying we VERIFY the insert
 *  actually landed (frameworks like Draft/Gmail/Lexical can silently revert
 *  it on their next reconcile tick) and retry once before giving up. */
function applyToRichEditor(el: HTMLElement, fix: Fix, kind: EditorKind): boolean {
  const map = buildTextMap(el);
  const span = resolveSpan(map, fix.offset, fix.length, fix.original);
  if (!span) return false;

  // The EXACT field text we expect after a clean replace. Verifying against the whole
  // expected string (not just "is the replacement present at the offset") is what
  // distinguishes a real replacement from a duplicate insert — the "damn" → "DamnDamn"
  // bug — because a duplicate makes the field longer than `expected` and never matches.
  const before = map.text;
  const expected = before.slice(0, span.start) + fix.replacement + before.slice(span.end);
  const norm = (s: string) =>
    s
      .replace(/[​-‍﻿]/g, '') // zero-width chars (Lexical/Draft insert these)
      .replace(/['‘’ʼ]/g, "'")
      .replace(/["“”]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  const cleanlyReplaced = () => norm(buildTextMap(el).text) === norm(expected);

  // One insert attempt. Re-resolves the span each call so a retry works against the
  // editor's current DOM. Returns whether the field now equals the clean replacement.
  const attempt = (): boolean => {
    const liveMap = buildTextMap(el);
    const liveSpan = resolveSpan(liveMap, fix.offset, fix.length, fix.original);
    if (!liveSpan) return cleanlyReplaced(); // may already have landed on a prior tick
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
    return cleanlyReplaced();
  };

  // Reconcile on the next tick (frameworks apply async). Three outcomes:
  //  - CLEAN replace → done.
  //  - field UNCHANGED → the framework reverted us (a no-op) → retry ONCE.
  //  - field changed but NOT into the clean replacement → the insert landed WRONG
  //    (duplicated the word: "damn" → "DamnDamn") → UNDO it so we never leave corrupted
  //    text. We NEVER blindly re-insert after a change — that is exactly what compounds
  //    into a duplicate. The field's own re-analysis re-flags the issue for a clean retry.
  const reconcile = () => {
    if (cleanlyReplaced()) return;
    if (buildTextMap(el).text === before) {
      attempt();
      return;
    }
    try {
      document.execCommand('undo');
    } catch {
      /* best effort — no worse than leaving the bad edit */
    }
  };

  if (kind !== 'contenteditable') {
    // Framework editors (Draft, Gmail, Lexical, ProseMirror, Slate, Quill, CKEditor,
    // CodeMirror) reconcile on a tick, so a same-frame insert can race the reconciler.
    // Do a best-effort sync insert, reconcile on the next tick, and report optimistic
    // success — the caller's re-analysis re-flags if it didn't hold.
    attempt();
    setTimeout(reconcile, 0);
    return true;
  }

  if (attempt()) return true;
  // Plain contenteditable: the sync insert didn't verify. Reconcile once on the next
  // tick (no-op → retry, bad insert → undo) and report the accurate sync result so a
  // stale span keeps its underline.
  setTimeout(reconcile, 0);
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
