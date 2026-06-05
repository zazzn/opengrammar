import type { AutocompleteResponse, Issue } from '../types';
import { extractText, getCaretPosition, setCaretPosition } from './textExtractor';

export interface AutocompleteState {
  element: HTMLElement;
  suggestion: string;
  replaceStart: number;
  replaceEnd: number;
}

export class AutocompletePopup {
  private box: HTMLElement | null = null;
  private state: AutocompleteState | null = null;
  private ghostSpan: HTMLElement | null = null;

  public show(element: HTMLElement, response: AutocompleteResponse, rect: DOMRect) {
    this.hide();

    // Check if element is an input or textarea
    const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
    const text = extractText(element);

    // Create the ghost text container
    this.box = document.createElement('div');
    this.box.className = 'opengrammar-autocomplete-ghost';

    if (isInput) {
      // Basic inline popup for now to avoid breaking the complex inputMirror logic safely
      this.box.style.cssText = `
        position: fixed;
        left: ${Math.max(12, rect.left + 12)}px;
        top: ${Math.min(window.innerHeight - 70, rect.bottom + 8)}px;
        max-width: min(460px, calc(100vw - 24px));
        padding: 4px 6px;
        background: rgba(43, 44, 54, 0.96);
        color: #94a3b8;
        border-radius: 6px;
        font-family: inherit;
        font-size: 13px;
        line-height: 1.4;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        pointer-events: none;
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(255,255,255,0.1);
        animation: opengrammar-fade-in 0.2s ease-out;
      `;
      this.box.innerHTML = `
        <span style="opacity: 0.6;">(Tab)</span> 
        <strong style="color: #60a5fa; font-weight: 500;">${this.escapeHtml(response.suggestion)}</strong>
      `;
    } else {
      // ContentEditable true ghost text logic can be placed inline more easily, but for consistency we use the tooltip popup
      this.box.style.cssText = `
        position: fixed;
        left: ${Math.max(12, rect.left + 12)}px;
        top: ${Math.min(window.innerHeight - 70, rect.bottom + 8)}px;
        max-width: min(460px, calc(100vw - 24px));
        padding: 4px 8px;
        background: rgba(43, 44, 54, 0.96);
        color: #94a3b8;
        border-radius: 6px;
        font-size: 13px;
        font-family: inherit;
        line-height: 1.4;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        pointer-events: none;
        border: 1px solid rgba(255,255,255,0.1);
      `;
      this.box.innerHTML = `
        <span style="opacity: 0.6;">(Tab)</span> 
        <strong style="color: #60a5fa; font-weight: 500;">${this.escapeHtml(response.suggestion)}</strong>
      `;
    }

    document.body.appendChild(this.box);
    this.state = {
      element,
      suggestion: response.suggestion,
      replaceStart: response.replaceStart,
      replaceEnd: response.replaceEnd,
    };
  }

  public accept(): boolean {
    if (!this.state) return false;

    const { element, suggestion, replaceStart, replaceEnd } = this.state;
    const text = extractText(element);

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      const before = text.slice(0, replaceStart);
      const after = text.slice(replaceEnd);
      // Auto-add space before suggestion if needed
      const paddedSuggestion =
        before.endsWith(' ') || suggestion.startsWith(' ') || suggestion.startsWith('.')
          ? suggestion
          : ' ' + suggestion;

      input.value = `${before}${paddedSuggestion}${after}`;
      const nextCursor = replaceStart + paddedSuggestion.length;
      input.setSelectionRange(nextCursor, nextCursor);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const before = text.slice(0, replaceStart);
      const paddedSuggestion =
        before.endsWith(' ') || suggestion.startsWith(' ') || suggestion.startsWith('.')
          ? suggestion
          : ' ' + suggestion;

      // INSERT at the caret via the browser's real editing pipeline rather than
      // clobbering element.textContent (which destroys the editor's node
      // structure + undo stack and breaks framework editors). The completion is
      // an append at the caret (replaceStart === replaceEnd in every producer),
      // so this is an insert, not a span replacement. execCommand('insertText')
      // fires genuine beforeinput/input so React/ProseMirror/Lexical/etc. all
      // observe it and undo is preserved; a minimal DOM splice is the fallback.
      this.insertAtCaretContentEditable(element, replaceStart, replaceEnd, paddedSuggestion);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    void chrome.runtime.sendMessage({
      type: 'TRACK_ANALYTICS_EVENT',
      eventType: 'autocomplete_accepted',
      payload: { count: 1, domain: window.location.hostname },
    });

    this.hide();
    return true;
  }

  public hide() {
    this.box?.remove();
    this.box = null;
    this.state = null;
    if (this.ghostSpan) {
      this.ghostSpan.remove();
      this.ghostSpan = null;
    }
  }

  public getState() {
    return this.state;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Insert `value` into a contenteditable at the [start, end) plain-text offset
   * (collapsed at the caret for completions, since start === end). Selects the
   * span, then drives execCommand('insertText') so the browser's real editing
   * pipeline runs — preserving framework state and the undo stack. Falls back to
   * a minimal Range splice if execCommand is unavailable. NEVER reassigns
   * textContent (which would flatten the editor's DOM).
   */
  private insertAtCaretContentEditable(
    element: HTMLElement,
    start: number,
    end: number,
    value: string,
  ): void {
    element.focus();
    const range = this.rangeForOffsets(element, start, end);
    const selection = window.getSelection();
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      let ok = false;
      try {
        ok = document.execCommand('insertText', false, value);
      } catch {
        ok = false;
      }
      if (ok) return;
      // execCommand unavailable/blocked: minimal splice that still avoids
      // clobbering the whole subtree, caret placed AFTER the inserted text.
      try {
        range.deleteContents();
        const tn = document.createTextNode(value);
        range.insertNode(tn);
        const after = document.createRange();
        after.setStartAfter(tn);
        after.collapse(true);
        selection.removeAllRanges();
        selection.addRange(after);
        return;
      } catch {
        /* fall through to the last-resort caret placement below */
      }
    }
    // Last resort (no resolvable range): place the caret and try once more.
    setCaretPosition(element, Math.min(end, extractText(element).length));
    try {
      document.execCommand('insertText', false, value);
    } catch {
      /* give up silently — the input event below still fires for re-analysis */
    }
  }

  /**
   * Build a DOM Range spanning the [start, end) plain-text offsets within a
   * contenteditable, walking its text nodes (same traversal as
   * textExtractor.setCaretPosition). Returns null if the offsets can't be
   * resolved.
   */
  private rangeForOffsets(element: HTMLElement, start: number, end: number): Range | null {
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let startSet = false;
    let endSet = false;
    let node: Node | null = walker.nextNode();
    let lastNode: Node | null = null;
    let lastLen = 0;
    while (node) {
      const len = node.textContent?.length || 0;
      if (!startSet && pos + len >= start) {
        range.setStart(node, start - pos);
        startSet = true;
      }
      if (!endSet && pos + len >= end) {
        range.setEnd(node, end - pos);
        endSet = true;
      }
      if (startSet && endSet) return range;
      lastNode = node;
      lastLen = len;
      pos += len;
      node = walker.nextNode();
    }
    // Offsets past the end of content (typical for an append): anchor to the end
    // of the last text node, or the element itself when it has no text nodes.
    if (lastNode) {
      if (!startSet) range.setStart(lastNode, lastLen);
      if (!endSet) range.setEnd(lastNode, lastLen);
      return range;
    }
    try {
      range.selectNodeContents(element);
      range.collapse(false);
      return range;
    } catch {
      return null;
    }
  }
}

export const autocompleteManager = new AutocompletePopup();
