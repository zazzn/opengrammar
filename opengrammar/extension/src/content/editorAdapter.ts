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
 *  DOM splice (never normalize()). Draft needs a post-tick. */
function applyToRichEditor(el: HTMLElement, fix: Fix, kind: EditorKind): boolean {
  const map = buildTextMap(el);
  const span = resolveSpan(map, fix.offset, fix.length, fix.original);
  if (!span) return false;
  const range = offsetToRange(map, span.start, span.end);
  if (!range) return false;

  const run = () => {
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
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
        return;
      }
    }
    fireInput(el, fix.replacement);
  };

  // Draft.js reconciles editorState on a tick; replacing synchronously
  // inside the same frame races its reconciler and gets reverted.
  if (kind === 'draft') setTimeout(run, 0);
  else run();
  return true;
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
