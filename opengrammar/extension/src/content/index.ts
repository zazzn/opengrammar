import type { AnalysisContext, AutocompleteResponse, Issue } from '../types';
import { autocompleteManager } from './autocomplete';
import {
  clearHighlights,
  highlightIssues,
  isUIActive,
  refreshFloatingDecorations,
} from './highlighter';
import {
  extractText,
  getCaretPosition,
  getElementFromTarget,
  setCaretPosition,
  stripQuotedBBCode,
} from './textExtractor';
import { debounce } from './utils';

interface EditableElement {
  element: HTMLElement;
  observer?: MutationObserver;
  lastText: string;
  lastCheck?: number;
  lastIssues?: Issue[];
}

const activeElements = new Map<HTMLElement, EditableElement>();
let currentFocusElement: HTMLElement | null = null;
let lastSelectionRange: Range | null = null;
let lastInputSelection: {
  element: HTMLInputElement | HTMLTextAreaElement;
  start: number;
  end: number;
} | null = null;

// Track which domains are disabled
let disabledDomains: string[] = [];
let checkAsYouTypeEnabled = true;
let showNotificationsEnabled = true;
let autocompleteEnabled = true;

let isContextInvalidated = false;

/**
 * Check if the extension context is still valid
 */
function checkContext(): boolean {
  if (isContextInvalidated) return false;

  if (!chrome.runtime?.id) {
    if (!isContextInvalidated) {
      console.warn('[OpenGrammar] Extension context invalidated. Please refresh the page.');
      isContextInvalidated = true;
      deactivateAll();
    }
    return false;
  }
  return true;
}

/**
 * Deactivate all active elements
 */
function deactivateAll() {
  activeElements.forEach((_, element) => {
    deactivateElement(element);
  });
  activeElements.clear();
}

/**
 * Initialize the content script
 */
function initialize() {
  console.log('🚀 [OpenGrammar] Content script starting...');

  // Check context immediately
  if (!checkContext()) return;

  // Check for file:// protocol
  if (window.location.protocol === 'file:') {
    console.warn(
      '⚠️ [OpenGrammar] You are using file:// protocol. Make sure "Allow access to file URLs" is enabled in chrome://extensions for OpenGrammar.',
    );
  }

  // Load disabled domains
  loadUserSettings();

  // Listen for focus events on editable elements
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);

  // Handle scroll events to reposition highlights
  window.addEventListener('scroll', debounce(handleScroll, 100), true);
  window.addEventListener('resize', debounce(handleScroll, 100), true);

  // Check for already focused elements on page load
  setTimeout(checkExistingFocusedElement, 500);

  // Verify connection to background script
  try {
    chrome.runtime.sendMessage({ type: 'GET_BACKEND_URL' }, (response) => {
      if (chrome.runtime.lastError) {
        if (chrome.runtime.lastError.message?.includes('context invalidated')) {
          isContextInvalidated = true;
        }
        console.error(
          '❌ [OpenGrammar] Cannot connect to background script:',
          chrome.runtime.lastError.message,
        );
      } else {
        console.log('✅ [OpenGrammar] Connected to background script. Backend URL:', response?.url);
      }
    });
  } catch (e) {
    console.error('❌ [OpenGrammar] Fatal error connecting to background:', e);
    isContextInvalidated = true;
  }

  console.log(
    '[OpenGrammar] Content script initialized on',
    window.location.hostname || 'local file',
  );

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'GET_SELECTED_TEXT') {
      sendResponse({ text: captureSelectedText() });
      return false;
    }

    if (request.type === 'GET_ACTIVE_TEXT') {
      const text = currentFocusElement ? extractText(currentFocusElement) : '';
      const issues = currentFocusElement
        ? activeElements.get(currentFocusElement)?.lastIssues || []
        : [];
      sendResponse({ text, issues });
      return false;
    }

    if (request.type === 'APPLY_REWRITE') {
      const success = applyRewrite(request.original, request.rewritten);
      sendResponse(success);
      return false;
    }

    return false;
  });
}

/**
 * Load disabled domains from storage
 */
async function loadUserSettings() {
  if (!checkContext()) return;

  try {
    const result = await chrome.storage.sync.get([
      'disabledDomains',
      'checkAsYouType',
      'showNotifications',
      'autocompleteEnabled',
    ]);
    disabledDomains = result.disabledDomains || [];
    checkAsYouTypeEnabled = result.checkAsYouType !== false;
    showNotificationsEnabled = result.showNotifications !== false;
    autocompleteEnabled = result.autocompleteEnabled !== false;
  } catch (e) {
    if (e instanceof Error && e.message.includes('context invalidated')) {
      isContextInvalidated = true;
    }
    console.debug('[OpenGrammar] Could not load disabled domains');
  }
}

/**
 * Check if current domain is disabled
 */
function isDomainDisabled(): boolean {
  if (!checkContext()) return true;
  const domain = window.location.hostname.toLowerCase();
  return disabledDomains.some((d) => domain.includes(d) || d.includes(domain));
}

/**
 * Check for already focused elements on page load
 */
function checkExistingFocusedElement() {
  if (!checkContext()) return;
  if (isDomainDisabled()) {
    console.log('[OpenGrammar] Domain is disabled, skipping');
    return;
  }

  const activeElement = document.activeElement as HTMLElement;
  if (activeElement && isEditable(activeElement)) {
    console.log('[OpenGrammar] Found active element on load:', activeElement.tagName);
    activateElement(activeElement);
  }
}

/**
 * Handle focus in event
 */
function handleFocusIn(event: FocusEvent) {
  if (!checkContext()) return;
  if (isDomainDisabled()) return;

  const target = getElementFromTarget(event.target);
  const normalizedTarget = normalizeEditableTarget(target);
  if (normalizedTarget && isEditable(normalizedTarget)) {
    console.log('[OpenGrammar] Focus in:', normalizedTarget.tagName, normalizedTarget.className);
    activateElement(normalizedTarget);
  }
}

/**
 * Handle focus out event
 */
function handleFocusOut(event: FocusEvent) {
  if (!checkContext()) return;

  const target = getElementFromTarget(event.target);
  const relatedTarget = event.relatedTarget as HTMLElement;

  // If we're moving focus to something inside our own UI, don't deactivate
  if (
    relatedTarget &&
    (relatedTarget.closest('.opengrammar-tooltip') ||
      relatedTarget.closest('.opengrammar-badge') ||
      relatedTarget.closest('#opengrammar-highlights') ||
      relatedTarget.classList.contains('opengrammar-underline'))
  ) {
    console.log('[OpenGrammar] Focus moving to UI, staying active');
    return;
  }

  if (target && activeElements.has(target)) {
    // Longer timeout to allow clicks on UI to register
    setTimeout(() => {
      if (!checkContext()) return;

      // Don't deactivate while OpenGrammar UI (tooltip/panel) is active
      if (isUIActive()) return;

      const currentActive = document.activeElement;
      if (
        currentActive &&
        (currentActive.closest('.opengrammar-tooltip') ||
          currentActive.closest('.opengrammar-badge') ||
          currentActive.closest('#opengrammar-highlights') ||
          currentActive.classList.contains('opengrammar-underline'))
      ) {
        return;
      }

      if (document.activeElement !== target) {
        console.log('[OpenGrammar] Focus out:', target.tagName);
        deactivateElement(target);
      }
    }, 200);
  }
}

/**
 * Handle scroll event to update highlight positions
 */
function handleScroll() {
  refreshFloatingDecorations();
}

/**
 * Activate an editable element for grammar checking
 */
function activateElement(element: HTMLElement) {
  if (activeElements.has(element)) {
    return; // Already active
  }

  currentFocusElement = element;

  const editableElement: EditableElement = {
    element,
    lastText: extractText(element),
  };

  // Set up mutation observer for contenteditable elements
  if (element.isContentEditable && element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
    const observer = new MutationObserver(
      debounce((mutations) => {
        const newText = extractText(element);
        if (newText !== editableElement.lastText) {
          editableElement.lastText = newText;
          console.log('[OpenGrammar] Content changed, checking grammar...');
          debouncedCheck(element);
        }
      }, 500),
    );

    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    editableElement.observer = observer;
  }

  // Listen for input events
  element.addEventListener('input', handleInput as EventListener);
  element.addEventListener('keydown', handleKeyDown as EventListener);

  activeElements.set(element, editableElement);

  // Initial check
  console.log(
    '[OpenGrammar] Activated element, initial text:',
    editableElement.lastText.substring(0, 50),
  );
  void syncActiveContext(editableElement.lastText, editableElement.lastIssues || []);
  if (checkAsYouTypeEnabled) {
    debouncedCheck(element);
  }
}

/**
 * Deactivate an editable element
 */
function deactivateElement(element: HTMLElement) {
  const editableElement = activeElements.get(element);
  if (!editableElement) return;

  // Disconnect observer
  if (editableElement.observer) {
    editableElement.observer.disconnect();
  }

  // Remove event listeners
  element.removeEventListener('input', handleInput as EventListener);
  element.removeEventListener('keydown', handleKeyDown as EventListener);

  // Clear highlights only if NOT currently interacting with a tooltip
  const currentActive = document.activeElement;
  const isInteractingWithUI =
    currentActive &&
    (currentActive.closest('.opengrammar-tooltip') || currentActive.closest('.opengrammar-badge'));

  if (!isInteractingWithUI && !isUIActive()) {
    clearHighlights();
  }

  activeElements.delete(element);

  if (currentFocusElement === element) {
    currentFocusElement = null;
  }

  console.log('[OpenGrammar] Deactivated element');
  autocompleteManager.hide();
}

/**
 * Handle input event
 */
function handleInput(event: Event) {
  const target = getElementFromTarget(event.target);
  if (target && activeElements.has(target)) {
    const editableElement = activeElements.get(target)!;
    editableElement.lastText = extractText(target);
    void syncActiveContext(editableElement.lastText, editableElement.lastIssues || []);
    if (checkAsYouTypeEnabled) {
      debouncedCheck(target);
    }
    if (autocompleteEnabled) {
      debouncedAutocomplete(target);
    }
  }
}

function handleKeyDown(event: Event) {
  const keyboardEvent = event as KeyboardEvent;
  const target = getElementFromTarget(event.target);
  if (!target) return;

  if (keyboardEvent.key === 'Tab' && autocompleteManager.getState()?.element === target) {
    keyboardEvent.preventDefault();
    autocompleteManager.accept();
    return;
  }

  if (keyboardEvent.key === 'Escape') {
    autocompleteManager.hide();
  }
}

/**
 * Check grammar for an element
 */
function handleGrammarSuccess(element: HTMLElement, text: string, issues: Issue[]) {
  const editableElement = activeElements.get(element);
  if (issues && issues.length > 0) {
    if (editableElement) editableElement.lastIssues = issues;
    void syncActiveContext(text, issues);
    // Don't tear down the review panel mid-batch: accepting a sentence
    // dispatches `input` → re-analysis, and re-highlighting would wipe the
    // open panel before the user finishes the remaining sentences. Defer
    // the underline refresh until the panel is closed.
    if (!isUIActive()) highlightIssues(element, issues);

    const statsPerType = { grammar: 0, spelling: 0, clarity: 0, style: 0 };
    for (const issue of issues) {
      if (issue.type in statsPerType) statsPerType[issue.type as keyof typeof statsPerType]++;
    }
    void chrome.storage.local.set({
      lastIssueStats: {
        grammar: statsPerType.grammar + statsPerType.spelling,
        style: statsPerType.style,
        clarity: statsPerType.clarity,
        total: issues.length,
      },
    });

    void chrome.runtime.sendMessage({ type: 'UPDATE_BADGE_COUNT', count: issues.length });

    const wordCount = text.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
    const errorTypes: Record<string, number> = {};
    for (const issue of issues) {
      errorTypes[issue.type] = (errorTypes[issue.type] || 0) + 1;
    }
    const issuesPerHundred = wordCount > 0 ? (issues.length / wordCount) * 100 : 0;
    const writingScore = Math.round(Math.max(0, Math.min(100, 100 - issuesPerHundred * 10)));
    void chrome.runtime.sendMessage({
      type: 'SAVE_WRITING_SESSION',
      payload: { wordsChecked: wordCount, issuesFound: issues.length, issuesFixed: 0, writingScore, errorTypes },
    });
  } else {
    if (editableElement) editableElement.lastIssues = [];
    void syncActiveContext(text, []);
    // Text is now clean — remove the stale bubble/underlines from the previous
    // analysis. Without this, an accepted fix leaves a lingering icon whose
    // (now stale) issues garble the panel when reopened.
    if (!isUIActive()) clearHighlights();
    void chrome.runtime.sendMessage({ type: 'UPDATE_BADGE_COUNT', count: 0 });
  }
}

const checkGrammar = async (element: HTMLElement) => {
  if (!checkContext()) return;

  if (!activeElements.has(element)) {
    console.log('[OpenGrammar] Element not active, skipping check');
    return;
  }

  // Blank quoted posts (length-preserving) so we only check the user's own
  // writing. Offsets stay 1:1 with the editor text because length is kept.
  const text = stripQuotedBBCode(extractText(element));
  if (!text || text.trim().length < 5) {
    clearHighlights();
    return;
  }

  try {
    const startTime = Date.now();
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_GRAMMAR',
      text,
      context: buildAnalysisContext(element, text),
    });

    if (response?.error) {
      showNotification('Grammar check failed: ' + response.error, 'error');
      return;
    }

    handleGrammarSuccess(element, text, response?.issues || []);
  } catch (err) {
    if (err instanceof Error && err.message.includes('context invalidated')) {
      isContextInvalidated = true;
      deactivateAll();
      return;
    }

    console.error('[OpenGrammar] Grammar check failed:', err);
    showNotification(
      'Cannot connect to grammar service. Make sure the backend is running.',
      'error',
    );
  }
};

const debouncedCheck = debounce(checkGrammar, 800);

/**
 * Check if an element is editable
 */
function isEditable(el: HTMLElement): boolean {
  if (!el) return false;

  // Check for input/textarea
  if (el.tagName === 'INPUT') {
    const inputType = (el as HTMLInputElement).type.toLowerCase();
    if (
      !['button', 'submit', 'reset', 'image', 'checkbox', 'radio', 'file', 'hidden'].includes(
        inputType,
      )
    ) {
      return true;
    }
  }

  if (el.tagName === 'TEXTAREA') {
    return true;
  }

  // Check for contenteditable
  if (el.isContentEditable) {
    return true;
  }

  // Check for role attribute indicating editability
  const role = el.getAttribute('role');
  if (role === 'textbox') {
    return true;
  }

  return false;
}

/**
 * Show a notification to the user
 */
function showNotification(message: string, type: 'error' | 'warning' | 'info') {
  if (!showNotificationsEnabled) return;

  // Remove existing notifications
  const existing = document.getElementById('opengrammar-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'opengrammar-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 400px;
    padding: 14px 18px;
    background: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#f59e0b' : '#2563eb'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    animation: opengrammar-slide-in 0.3s ease-out;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

async function syncActiveContext(text: string, issues: Issue[]) {
  if (!checkContext()) return;

  try {
    await chrome.runtime.sendMessage({
      type: 'SYNC_ACTIVE_CONTEXT',
      text,
      issues,
    });
  } catch {
    // ignore sync failures
  }
}

function normalizeEditableTarget(target: HTMLElement | null): HTMLElement | null {
  if (!target) return null;
  if (isEditable(target)) return target;

  const closest = target.closest(
    'input, textarea, [contenteditable="true"], [role="textbox"]',
  ) as HTMLElement | null;
  if (closest) return closest;

  if (window.location.hostname.includes('docs.google.com')) {
    return target.closest('.kix-appview-editor, [role="textbox"]') as HTMLElement | null;
  }

  return target;
}

function buildAnalysisContext(element: HTMLElement, text: string): AnalysisContext {
  const cursor = getCaretPosition(element);
  const previousText = text.slice(Math.max(0, cursor - 220), cursor).trim();
  const nextText = text.slice(cursor, Math.min(text.length, cursor + 220)).trim();
  const activeSentence = text
    .slice(
      Math.max(0, text.lastIndexOf('.', cursor - 1) + 1),
      Math.min(
        text.length,
        (() => {
          const nextPeriod = text.indexOf('.', cursor);
          return nextPeriod === -1 ? text.length : nextPeriod + 1;
        })(),
      ),
    )
    .trim();

  return {
    domain: window.location.hostname,
    editorType: getEditorType(element),
    activeSentence,
    previousText,
    nextText,
    fullTextExcerpt: text.slice(0, 1500),
  };
}

function getEditorType(element: HTMLElement): string {
  if (window.location.hostname.includes('docs.google.com')) return 'google-docs';
  if (element.tagName === 'TEXTAREA') return 'textarea';
  if (element.tagName === 'INPUT') return 'input';
  if (element.isContentEditable) return 'contenteditable';
  return 'generic';
}

function captureSelectedText(): string {
  const activeElement = currentFocusElement;

  if (
    activeElement &&
    (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
  ) {
    const input = activeElement as HTMLInputElement | HTMLTextAreaElement;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    lastInputSelection = { element: input, start, end };
    return input.value.slice(start, end);
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return '';
  }

  const text = selection.toString();
  if (!text) {
    return '';
  }

  lastSelectionRange = selection.getRangeAt(0).cloneRange();
  return text;
}

function applyRewrite(original: string, rewritten: string): { success: boolean; error?: string } {
  if (
    lastInputSelection &&
    document.contains(lastInputSelection.element) &&
    lastInputSelection.end >= lastInputSelection.start
  ) {
    const { element, start, end } = lastInputSelection;
    const selected = element.value.slice(start, end);
    if (!selected || selected === original) {
      const before = element.value.slice(0, start);
      const after = element.value.slice(end);
      element.value = `${before}${rewritten}${after}`;
      const nextCaret = start + rewritten.length;
      element.setSelectionRange(nextCaret, nextCaret);
      element.focus();
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return { success: true };
    }
  }

  if (lastSelectionRange) {
    try {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(lastSelectionRange);
      const activeText = selection?.toString() || '';
      if (!activeText || activeText === original) {
        lastSelectionRange.deleteContents();
        lastSelectionRange.insertNode(document.createTextNode(rewritten));
        currentFocusElement?.dispatchEvent(new Event('input', { bubbles: true }));
        selection?.removeAllRanges();
        lastSelectionRange = null;
        return { success: true };
      }
    } catch (error) {
      console.debug('[OpenGrammar] Failed to apply selection rewrite:', error);
    }
  }

  if (currentFocusElement) {
    const text = extractText(currentFocusElement);
    const index = text.indexOf(original);
    if (index !== -1) {
      if (currentFocusElement.tagName === 'INPUT' || currentFocusElement.tagName === 'TEXTAREA') {
        const input = currentFocusElement as HTMLInputElement | HTMLTextAreaElement;
        input.value = `${text.slice(0, index)}${rewritten}${text.slice(index + original.length)}`;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return { success: true };
      }

      currentFocusElement.textContent = `${text.slice(0, index)}${rewritten}${text.slice(index + original.length)}`;
      currentFocusElement.dispatchEvent(new Event('input', { bubbles: true }));
      return { success: true };
    }
  }

  return { success: false, error: 'No editable selection available to rewrite.' };
}

const requestAutocomplete = async (element: HTMLElement) => {
  if (!checkContext() || !autocompleteEnabled) return;
  if (currentFocusElement !== element) return;

  const text = extractText(element);
  if (!text || text.trim().length < 12) {
    autocompleteManager.hide();
    return;
  }

  const cursor = getCaretPosition(element);
  if (cursor < text.length && !element.isContentEditable) {
    autocompleteManager.hide();
    return;
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'AUTOCOMPLETE_TEXT',
      text,
      cursor,
      context: buildAnalysisContext(element, text),
    })) as AutocompleteResponse;

    if (!response?.suggestion || response.confidence < 0.35) {
      autocompleteManager.hide();
      return;
    }

    const rect = element.getBoundingClientRect();
    autocompleteManager.show(element, response, rect);
  } catch {
    autocompleteManager.hide();
  }
};

const debouncedAutocomplete = debounce(requestAutocomplete, 700);

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes opengrammar-fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes opengrammar-slide-in {
    from { opacity: 0; transform: translateX(100%); }
    to { opacity: 1; transform: translateX(0); }
  }
`;
document.head.appendChild(style);

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Listen for storage changes (e.g., when domain is disabled/enabled)
chrome.storage?.onChanged?.addListener((changes) => {
  if (changes.disabledDomains) {
    disabledDomains = changes.disabledDomains.newValue || [];
    console.log('[OpenGrammar] Disabled domains updated:', disabledDomains);
  }
  if (changes.checkAsYouType) {
    checkAsYouTypeEnabled = changes.checkAsYouType.newValue !== false;
  }
  if (changes.showNotifications) {
    showNotificationsEnabled = changes.showNotifications.newValue !== false;
  }
  if (changes.autocompleteEnabled) {
    autocompleteEnabled = changes.autocompleteEnabled.newValue !== false;
    if (!autocompleteEnabled) autocompleteManager.hide();
  }
});
