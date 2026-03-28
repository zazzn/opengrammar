import type { AutocompleteResponse, Issue } from "../types";
import { extractText, getCaretPosition, setCaretPosition } from "./textExtractor";

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
      const paddedSuggestion = (before.endsWith(' ') || suggestion.startsWith(' ') || suggestion.startsWith('.')) ? suggestion : ' ' + suggestion;
      
      input.value = `${before}${paddedSuggestion}${after}`;
      const nextCursor = replaceStart + paddedSuggestion.length;
      input.setSelectionRange(nextCursor, nextCursor);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const before = text.slice(0, replaceStart);
      const after = text.slice(replaceEnd);
      const paddedSuggestion = (before.endsWith(' ') || suggestion.startsWith(' ') || suggestion.startsWith('.')) ? suggestion : ' ' + suggestion;
      
      element.textContent = `${before}${paddedSuggestion}${after}`;
      setCaretPosition(element, replaceStart + paddedSuggestion.length);
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
}

export const autocompleteManager = new AutocompletePopup();
