import { debounce } from './utils';

export class GoogleDocsHandler {
  private editorElement: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private lastText = '';

  constructor() {
    this.init();
  }

  private async init() {
    console.log('[OpenGrammar] Initializing Google Docs integration...');

    // We need to wait for the iframe to be available
    for (let i = 0; i < 20; i++) {
      if (this.findEditor()) {
        console.log('[OpenGrammar] Found Google Docs editor');
        this.setupObserver();
        this.runCheck();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private findEditor(): boolean {
    const iframe = document.querySelector('.docs-texteventtarget-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentDocument) {
      this.editorElement = iframe.contentDocument.querySelector('.kix-appview-editor');
      return !!this.editorElement;
    }
    return false;
  }

  private extractText(): string {
    if (!this.editorElement) return '';

    // Google Docs stores paragraphs in .kix-paragraphrenderer
    const paragraphs = this.editorElement.querySelectorAll('.kix-paragraphrenderer');
    return Array.from(paragraphs)
      .map((p) => {
        // Getting innerText is more reliable than textContent as it preserves visual breaks
        return (p as HTMLElement).innerText || p.textContent || '';
      })
      .join('\n');
  }

  private setupObserver() {
    if (!this.editorElement) return;

    this.observer = new MutationObserver(
      debounce(() => {
        const newText = this.extractText();
        if (newText !== this.lastText) {
          this.lastText = newText;
          this.runCheck();
        }
      }, 800),
    );

    this.observer.observe(this.editorElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  private async runCheck() {
    if (!this.lastText || this.lastText.trim().length < 5) return;

    console.log(
      '[OpenGrammar] Analyzing Google Docs content (length: ' + this.lastText.length + ')',
    );

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_GRAMMAR',
        text: this.lastText,
        context: {
          domain: 'docs.google.com',
          editorType: 'google-docs',
          fullTextExcerpt: this.lastText.slice(0, 1500),
        },
      });

      if (response?.issues) {
        // Send badge count
        void chrome.runtime.sendMessage({
          type: 'UPDATE_BADGE_COUNT',
          count: response.issues.length,
        });

        // Sync context so the extension popup can display the issues
        void chrome.runtime.sendMessage({
          type: 'SYNC_ACTIVE_CONTEXT',
          text: this.lastText,
          issues: response.issues,
        });
      }
    } catch (e) {
      console.debug('[OpenGrammar] GDocs check skipped:', e);
    }
  }

  public disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GoogleDocsHandler());
} else {
  new GoogleDocsHandler();
}
