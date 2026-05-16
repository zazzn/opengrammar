import type { IgnoredIssue, Issue } from '../types';
import { buildTextMap, offsetToRange, resolveInString, resolveSpan } from './textMap';

let currentTooltip: HTMLElement | null = null;
let currentRephrasePanel: HTMLElement | null = null;
let highlightContainer: HTMLElement | null = null;
let assistantBubble: HTMLElement | null = null;
// Contenteditable overlay state — so scroll/resize can re-place underlines
let overlayTarget: HTMLElement | null = null;
let overlayIssues: Issue[] = [];
// Field the floating bubble is anchored to (tracked on scroll/resize)
let assistantTarget: HTMLElement | null = null;
let currentSpellMenu: HTMLElement | null = null;

const BUBBLE_SIZE = 30; // px — small, fits inside the field corner
const MIN_FIELD_HEIGHT = 38; // skip tiny inputs (matches Grammarly)

/** Anchor the bubble to the bottom-right corner of its target field. */
function positionAssistantBubble() {
  if (!assistantBubble || !assistantTarget || !assistantTarget.isConnected) return;
  const r = assistantTarget.getBoundingClientRect();
  if (r.height < MIN_FIELD_HEIGHT || r.width === 0) {
    assistantBubble.style.display = 'none';
    return;
  }
  assistantBubble.style.display = 'inline-flex';
  const inset = 6;
  assistantBubble.style.left = `${Math.round(r.right - BUBBLE_SIZE - inset)}px`;
  assistantBubble.style.top = `${Math.round(r.bottom - BUBBLE_SIZE - inset)}px`;
}
let inputMirrorOverlay: HTMLElement | null = null;
let inputMirrorContent: HTMLElement | null = null;
let inputMirrorTarget: HTMLElement | null = null;
let cleanupInputMirror: (() => void) | null = null;
let uiActive = false;

export function isUIActive(): boolean {
  return uiActive;
}

/* ────────────────────────────────────────────────────────────
   GRAMMARLY COLOR SYSTEM — exact hex values from Grammarly
──────────────────────────────────────────────────────────── */
const COLORS = {
  grammar:  { line: '#e53935', bg: 'rgba(229,57,53,0.10)',  hover: 'rgba(229,57,53,0.20)',  dot: '#e53935' },
  spelling: { line: '#e53935', bg: 'rgba(229,57,53,0.10)',  hover: 'rgba(229,57,53,0.20)',  dot: '#e53935' },
  clarity:  { line: '#f59e0b', bg: 'rgba(245,158,11,0.10)', hover: 'rgba(245,158,11,0.22)', dot: '#f59e0b' },
  style:    { line: '#1565c0', bg: 'rgba(21,101,192,0.09)', hover: 'rgba(21,101,192,0.18)', dot: '#1565c0' },
};

function getC(type: string) {
  return COLORS[type as keyof typeof COLORS] ?? COLORS.grammar;
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'grammar':  return 'Grammar';
    case 'spelling': return 'Spelling';
    case 'clarity':  return 'Clarity';
    case 'style':    return 'Style';
    default:         return 'Suggestion';
  }
}

function getCategoryLabel(type: string): string {
  return type === 'grammar' || type === 'spelling' ? 'Correctness' : 'Clarity & Style';
}

function escapeHtml(text: string): string {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function escapeHtmlPreservingWhitespace(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>').replace(/ {2}/g, ' &nbsp;');
}

/* ────────────────────────────────────────────────────────────
   HIGHLIGHT OVERLAY
──────────────────────────────────────────────────────────── */
function initHighlightContainer() {
  if (!highlightContainer) {
    highlightContainer = document.createElement('div');
    highlightContainer.id = 'opengrammar-highlights';
    highlightContainer.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none; z-index: 2147483647;
    `;
    document.body.appendChild(highlightContainer);
  }
}

export function highlightIssues(element: HTMLElement, issues: Issue[]) {
  initHighlightContainer();
  clearHighlights();
  if (issues.length === 0) return;

  showAssistantBubble(element, issues);

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    showInputMirror(element, issues);
    showInputBadge(element, issues);
    return;
  }

  // Contenteditable: draw underlines in an OVERLAY — never mutate the editor's
  // DOM (that is what stole the caret and corrupted offsets).
  renderOverlayUnderlines(element, issues);
}

function clearOverlayUnderlines() {
  highlightContainer
    ?.querySelectorAll('.opengrammar-underline')
    .forEach((e) => e.remove());
}

/**
 * Draw wavy underlines for contenteditable issues in the fixed overlay layer.
 * The editor's own DOM is never touched, so the caret and the host editor are
 * unaffected. Underlines are positioned from Range.getClientRects() (one rect
 * per visual line a span wraps across).
 */
function renderOverlayUnderlines(element: HTMLElement, issues: Issue[]) {
  initHighlightContainer();
  clearOverlayUnderlines();
  overlayTarget = element;
  overlayIssues = issues;
  if (!highlightContainer) return;

  const map = buildTextMap(element);

  for (const issue of issues) {
    if (issue.ignored) continue;
    const span = resolveSpan(map, issue.offset, issue.length, issue.original);
    if (!span) continue;
    const range = offsetToRange(map, span.start, span.end);
    if (!range) continue;

    const c = getC(issue.type);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width === 0 || r.height === 0) continue;
      // Cover the whole word so it's an easy click / right-click target;
      // the wavy line is drawn only along the bottom edge.
      const u = document.createElement('div');
      u.className = 'opengrammar-underline';
      u.style.cssText = `
        position: fixed;
        left: ${r.left}px;
        top: ${Math.round(r.top)}px;
        width: ${r.width}px;
        height: ${Math.round(r.height)}px;
        pointer-events: auto;
        cursor: pointer;
        z-index: 2147483646;
        background-image:
          linear-gradient(45deg, transparent 60%, ${c.line} 60%, ${c.line} 78%, transparent 78%),
          linear-gradient(-45deg, transparent 60%, ${c.line} 60%, ${c.line} 78%, transparent 78%);
        background-size: 6px 3px;
        background-position: bottom;
        background-repeat: repeat-x;
      `;
      u.title = issue.reason || '';
      u.addEventListener('mousedown', (e) => e.preventDefault());
      if (issue.type === 'spelling') {
        // Spelling: quick inline replace menu on left- OR right-click.
        const open = (e: Event) => {
          e.stopPropagation();
          e.preventDefault();
          showSpellingMenu(u, issue, element);
        };
        u.addEventListener('click', open);
        u.addEventListener('contextmenu', open);
      } else {
        // Grammar/clarity/style: the per-issue card.
        u.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          showTooltip(u, issue, element);
        });
      }
      highlightContainer.appendChild(u);
    }
  }
}

/**
 * Apply a single correction to a contenteditable using the shared map.
 * Validates the span still matches `original` (rebasing if the user edited),
 * and drops the fix instead of corrupting text when it no longer matches.
 * Returns true if applied.
 */
function applyContentEditableFix(
  element: HTMLElement,
  issue: Issue,
): boolean {
  const map = buildTextMap(element);
  const span = resolveSpan(map, issue.offset, issue.length, issue.original);
  if (!span) return false;
  const range = offsetToRange(map, span.start, span.end);
  if (!range) return false;
  range.deleteContents();
  range.insertNode(document.createTextNode(issue.suggestion));
  element.normalize();
  return true;
}

export function clearHighlights() {
  clearOverlayUnderlines();
  overlayTarget = null;
  overlayIssues = [];
  document.querySelectorAll('.opengrammar-badge').forEach((el) => el.remove());
  destroyInputMirror();
  assistantBubble?.remove(); assistantBubble = null;
  assistantTarget = null;
  currentSpellMenu?.remove(); currentSpellMenu = null;
  currentTooltip?.remove(); currentTooltip = null;
  currentRephrasePanel?.remove(); currentRephrasePanel = null;
  uiActive = false;
}

export function refreshFloatingDecorations() {
  if (inputMirrorOverlay && inputMirrorTarget) positionInputMirror(inputMirrorTarget);
  if (inputMirrorContent && inputMirrorTarget) syncInputMirrorScroll(inputMirrorTarget);
  // Re-place contenteditable underlines (Range rects are viewport-relative, so
  // they must be recomputed when the field scrolls or the layout changes).
  positionAssistantBubble();
  if (overlayTarget && overlayIssues.length && overlayTarget.isConnected) {
    renderOverlayUnderlines(overlayTarget, overlayIssues);
  }
  document.querySelectorAll('.opengrammar-badge').forEach((badge) => {
    if (!inputMirrorTarget) return;
    const rect = inputMirrorTarget.getBoundingClientRect();
    (badge as HTMLElement).style.left = `${rect.right - 35}px`;
    (badge as HTMLElement).style.top  = `${rect.top + 5}px`;
  });
}

/* ────────────────────────────────────────────────────────────
   SPELLING QUICK-REPLACE MENU (right/left-click a misspelled word)
──────────────────────────────────────────────────────────── */
function parseSpellingOptions(issue: Issue): string[] {
  const opts: string[] = [];
  if (issue.suggestion && issue.suggestion !== issue.original) opts.push(issue.suggestion);
  // Backend reason often carries: "...Other suggestions: foo, bar"
  const m = /Other suggestions?:\s*([^.]+)/i.exec(issue.reason || '');
  if (m && m[1]) {
    for (const w of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (w && !opts.includes(w) && w !== issue.original) opts.push(w);
    }
  }
  return opts.slice(0, 5);
}

function addWordToDictionary(word: string) {
  const w = word.toLowerCase();
  chrome.storage.sync.get(['dictionary'], (r) => {
    const dict: string[] = Array.isArray(r.dictionary) ? r.dictionary : [];
    if (!dict.includes(w)) {
      dict.push(w);
      chrome.storage.sync.set({ dictionary: dict });
    }
  });
}

function removeIssueUnderline(issue: Issue, element: HTMLElement) {
  issue.ignored = true;
  overlayIssues = overlayIssues.filter((i) => i !== issue);
  if (overlayTarget) renderOverlayUnderlines(overlayTarget, overlayIssues);
  void element;
}

function showSpellingMenu(anchor: HTMLElement, issue: Issue, element: HTMLElement) {
  currentSpellMenu?.remove();
  injectStyles();

  const options = parseSpellingOptions(issue);
  const ar = anchor.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.className = 'opengrammar-spell-menu';
  const top = Math.min(ar.bottom + 6, window.innerHeight - 220);
  const left = Math.max(8, Math.min(ar.left, window.innerWidth - 248));
  menu.style.cssText = `
    position: fixed; left: ${left}px; top: ${top}px;
    width: 240px;
    background: #fff; border-radius: 10px;
    box-shadow: 0 4px 28px rgba(0,0,0,0.16), 0 1px 5px rgba(0,0,0,0.08);
    border: 1px solid rgba(0,0,0,0.07);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden; animation: og-fade-in 0.1s ease;
  `;

  const optionRows = options.length
    ? options
        .map(
          (o, i) => `
      <button class="og-sp-opt" data-i="${i}" style="
        display:flex; align-items:center; gap:8px; width:100%;
        padding:9px 12px; background:#fff; border:none; cursor:pointer;
        font-size:14px; color:#1c1c1e; text-align:left; font-family:inherit;
        border-bottom:1px solid #f4f4f5; transition:background 0.1s;
      ">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="#16a34a" style="flex-shrink:0;">
          <path d="M6.5 11.5L2.5 7.5l1.06-1.06 2.94 2.93 5.94-5.93 1.06 1.06z"/>
        </svg>
        <span style="font-weight:600;">${escapeHtml(o)}</span>
      </button>`,
        )
        .join('')
    : `<div style="padding:10px 12px;font-size:13px;color:#8e8e93;">No suggestion — add to dictionary or ignore.</div>`;

  menu.innerHTML = `
    <div style="
      padding:8px 12px; background:#fafafa; border-bottom:1px solid #f0f0f0;
      font-size:11px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase;
      color:#e53935; display:flex; align-items:center; gap:6px;
    ">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="#e53935"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 10.5h-1.5v-1.5h1.5v1.5zm0-3h-1.5V4.5h1.5V8.5z"/></svg>
      Spelling · <span style="color:#b91c1c;text-transform:none;font-weight:600;">${escapeHtml(issue.original)}</span>
    </div>
    ${optionRows}
    <button class="og-sp-dict" style="
      display:flex; align-items:center; gap:8px; width:100%;
      padding:9px 12px; background:#fff; border:none; cursor:pointer;
      font-size:13px; color:#3c3c43; text-align:left; font-family:inherit;
      border-bottom:1px solid #f4f4f5; transition:background 0.1s;
    ">📘 Add “${escapeHtml(issue.original)}” to dictionary</button>
    <button class="og-sp-ignore" style="
      display:flex; align-items:center; gap:8px; width:100%;
      padding:9px 12px; background:#fff; border:none; cursor:pointer;
      font-size:13px; color:#5f6368; text-align:left; font-family:inherit;
      transition:background 0.1s;
    ">✕ Ignore</button>
  `;

  menu.addEventListener('mousedown', (e) => e.preventDefault());

  menu.querySelectorAll<HTMLButtonElement>('.og-sp-opt').forEach((btn) => {
    btn.addEventListener('mouseenter', () => { btn.style.background = '#EEF2FF'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#fff'; });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = Number(btn.dataset.i || 0);
      const chosen = options[i]!;
      applySuggestion(element, { ...issue, suggestion: chosen }, anchor);
      removeIssueUnderline(issue, element);
      menu.remove(); currentSpellMenu = null;
    });
  });

  const dictBtn = menu.querySelector('.og-sp-dict') as HTMLButtonElement;
  dictBtn.addEventListener('mouseenter', () => { dictBtn.style.background = '#f5f5f7'; });
  dictBtn.addEventListener('mouseleave', () => { dictBtn.style.background = '#fff'; });
  dictBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    addWordToDictionary(issue.original);
    removeIssueUnderline(issue, element);
    menu.remove(); currentSpellMenu = null;
  });

  const ignBtn = menu.querySelector('.og-sp-ignore') as HTMLButtonElement;
  ignBtn.addEventListener('mouseenter', () => { ignBtn.style.background = '#f5f5f7'; });
  ignBtn.addEventListener('mouseleave', () => { ignBtn.style.background = '#fff'; });
  ignBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ignoreIssue(issue, anchor);
    removeIssueUnderline(issue, element);
    menu.remove(); currentSpellMenu = null;
  });

  const onDocClick = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove(); currentSpellMenu = null;
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      menu.remove(); currentSpellMenu = null;
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
  }, 60);

  document.body.appendChild(menu);
  currentSpellMenu = menu;
}

/* ────────────────────────────────────────────────────────────
   GRAMMARLY-STYLE FLOATING BADGE (bottom-right green circle)
──────────────────────────────────────────────────────────── */
function showAssistantBubble(element: HTMLElement, issues: Issue[]) {
  assistantBubble?.remove();
  assistantBubble = null;

  // Grammarly uses a green circle with the G logo and a red count badge
  const bubble = document.createElement('button');
  bubble.className = 'opengrammar-assistant';
  bubble.type = 'button';
  bubble.setAttribute('aria-label', `OpenGrammar: ${issues.length} suggestion${issues.length !== 1 ? 's' : ''}`);
  bubble.style.cssText = `
    position: fixed;
    left: 0; top: 0;
    display: inline-flex; align-items: center; justify-content: center;
    width: ${BUBBLE_SIZE}px; height: ${BUBBLE_SIZE}px; padding: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
    box-shadow: 0 1px 6px rgba(79,70,229,0.45), 0 1px 3px rgba(0,0,0,0.18);
    z-index: 2147483646;
    cursor: pointer; pointer-events: auto;
    border: none; outline: none;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  `;

  const hasErrors = issues.some(i => i.type === 'grammar' || i.type === 'spelling');
  const badgeBg = hasErrors ? '#e53935' : '#f59e0b';

  bubble.innerHTML = `
    <span style="position:relative;display:flex;align-items:center;justify-content:center;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M20 4C15 4 10 7 8 12L4 20l8-4c5-2 8-7 8-12z" fill="white" opacity="0.92"/>
        <path d="M8 12 L4 20" stroke="rgba(255,255,255,0.55)" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M5 18l2 2 4-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span style="
        position:absolute; top:-6px; right:-8px;
        min-width:15px; height:15px; padding:0 3px;
        border-radius:999px; background:${badgeBg}; color:white;
        font-size:9px; font-weight:700;
        display:inline-flex; align-items:center; justify-content:center;
        border:1.5px solid white;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        box-shadow:0 1px 3px rgba(0,0,0,0.25);
      ">${issues.length}</span>
    </span>
  `;

  bubble.addEventListener('mouseenter', () => { bubble.style.transform = 'scale(1.12)'; });
  bubble.addEventListener('mouseleave', () => { bubble.style.transform = 'scale(1)'; });
  bubble.addEventListener('mousedown', (e) => e.preventDefault());
  bubble.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    // Grammar/clarity/style → whole-sentence review.
    // Spelling is handled inline via right/left-click on the underline.
    showSentenceReview(issues, element, 0);
  });

  document.body.appendChild(bubble);
  assistantBubble = bubble;
  assistantTarget = element;
  positionAssistantBubble();
}

/* ────────────────────────────────────────────────────────────
   GRAMMARLY-STYLE TOOLTIP CARD (inline highlight → click)
──────────────────────────────────────────────────────────── */
/**
 * Place a panel relative to an anchor, staying fully inside the viewport.
 * Must be called AFTER the element is in the DOM (uses its measured size).
 * Opens below the anchor if it fits, else above, else clamps on-screen — so
 * it never runs off the bottom where the user might not be able to scroll.
 */
function placeFixedPanel(el: HTMLElement, anchorRect: DOMRect, gap = 8) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth || 334;
  const h = el.offsetHeight || 300;
  const left = Math.max(8, Math.min(anchorRect.left, vw - w - 8));
  const spaceBelow = vh - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  let top: number;
  if (h + gap <= spaceBelow) top = anchorRect.bottom + gap;
  else if (h + gap <= spaceAbove) top = anchorRect.top - gap - h;
  else top = spaceBelow >= spaceAbove ? vh - h - 8 : 8;
  top = Math.max(8, Math.min(top, vh - h - 8));
  el.style.position = 'fixed';
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

function showTooltip(anchor: HTMLElement, issue: Issue, element: HTMLElement) {
  uiActive = true;
  currentTooltip?.remove();
  currentRephrasePanel?.remove();
  currentRephrasePanel = null;

  const anchorRect = anchor.getBoundingClientRect();
  const c = getC(issue.type);

  const card = document.createElement('div');
  card.className = 'opengrammar-tooltip';
  card.style.cssText = `
    position: fixed;
    left: -9999px; top: -9999px;
    width: 334px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.14), 0 1px 6px rgba(0,0,0,0.07);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    border: 1px solid rgba(0,0,0,0.07);
    animation: og-fade-in 0.12s ease;
  `;

  // Inject keyframe once
  injectStyles();

  card.innerHTML = `
    <!-- Header: type badge + label -->
    <div style="
      padding: 13px 16px 10px;
      display: flex; align-items: center; gap: 9px;
      border-bottom: 1px solid #f0f0f0;
    ">
      <span style="
        display:inline-flex; align-items:center; justify-content:center;
        width: 28px; height: 28px; border-radius: 50%;
        background: ${c.line}18; flex-shrink: 0;
      ">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="${c.line}">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 10.5h-1.5v-1.5h1.5v1.5zm0-3h-1.5V4.5h1.5V8.5z"/>
        </svg>
      </span>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:7px;">
          <span style="
            font-size: 12px; font-weight: 600; color: ${c.line};
            text-transform: uppercase; letter-spacing: 0.5px;
          ">${getTypeLabel(issue.type)}</span>
          <span style="
            width: 4px; height: 4px; border-radius: 50%;
            background: #ccc; display: inline-block;
          "></span>
          <span style="font-size: 12px; color: #8e8e93;">${getCategoryLabel(issue.type)}</span>
        </div>
        <div style="font-size: 13px; color: #3c3c43; line-height: 1.5; margin-top: 4px;">
          ${escapeHtml(issue.reason)}
        </div>
      </div>
    </div>

    <!-- Diff: original → suggestion -->
    <div style="padding: 12px 16px; background: #fafafa; display: flex; flex-direction: column; gap: 7px;">
      <div style="
        display: flex; align-items: stretch; gap: 8px;
        background: #fff0f0; border-radius: 8px;
        padding: 9px 11px;
        border-left: 3px solid #e53935;
      ">
        <svg style="flex-shrink:0;margin-top:2px;" width="13" height="13" viewBox="0 0 16 16" fill="#e53935">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 10.5h-1.5v-1.5h1.5v1.5zm0-3h-1.5V4.5h1.5V8.5z"/>
        </svg>
        <span style="
          font-size: 14px; color: #b91c1c;
          text-decoration: line-through; word-break: break-word; line-height: 1.4;
        ">${escapeHtml(issue.original)}</span>
      </div>

      <div style="display:flex;justify-content:center;align-items:center;">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M4 10l4 4 4-4" stroke="#aaa" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <div class="og-suggestion-click" style="
        display: flex; align-items: stretch; gap: 8px;
        background: #EEF2FF; border-radius: 8px;
        padding: 9px 11px;
        border-left: 3px solid #4F46E5;
        cursor: pointer;
        transition: background 0.12s;
      ">
        <svg style="flex-shrink:0;margin-top:2px;" width="13" height="13" viewBox="0 0 16 16" fill="#4F46E5">
          <path d="M6.5 11.5L2.5 7.5l1.06-1.06 2.94 2.93 5.94-5.93 1.06 1.06z"/>
        </svg>
        <span style="
          font-size: 14px; color: #3730A3;
          font-weight: 600; word-break: break-word; line-height: 1.4;
        ">${escapeHtml(issue.suggestion)}</span>
      </div>
    </div>

    <!-- Action buttons -->
    <div style="display:flex; border-top: 1px solid #f0f0f0;">
      <button class="og-apply-btn" style="
        flex: 1; padding: 11px 16px;
        background: #4F46E5; color: white;
        border: none; cursor: pointer;
        font-size: 13px; font-weight: 600;
        border-radius: 0 0 0 12px;
        font-family: inherit;
        transition: background 0.12s;
        display: flex; align-items: center; justify-content: center; gap: 5px;
      ">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
          <path d="M6.5 11.5L2.5 7.5l1.06-1.06 2.94 2.93 5.94-5.93 1.06 1.06z"/>
        </svg>
        Accept
      </button>
      <button class="og-rephrase-btn" style="
        flex: 1; padding: 11px 16px;
        background: white; color: #5f6368;
        border: none; border-left: 1px solid #f0f0f0; cursor: pointer;
        font-size: 13px; font-weight: 500;
        font-family: inherit;
        transition: background 0.12s;
        display: flex; align-items: center; justify-content: center; gap: 5px;
      " title="Get AI rewrites (requires API key)">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5f6368" stroke-width="1.5" stroke-linecap="round">
          <path d="M2 8a6 6 0 1 1 1.5 4M2 12V8h4"/>
        </svg>
        Rephrase
      </button>
      <button class="og-ignore-btn" style="
        flex: 1; padding: 11px 16px;
        background: white; color: #5f6368;
        border: none; border-left: 1px solid #f0f0f0; cursor: pointer;
        font-size: 13px; font-weight: 500;
        border-radius: 0 0 12px 0;
        font-family: inherit;
        transition: background 0.12s;
      ">Dismiss</button>
    </div>
  `;

  // Suggestion click = apply fix
  const suggClick = card.querySelector('.og-suggestion-click') as HTMLElement;
  if (suggClick) {
    suggClick.addEventListener('click', (e) => {
      e.stopPropagation();
      applySuggestion(element, issue, anchor);
      hideTooltip();
    });
    suggClick.addEventListener('mouseenter', () => { suggClick.style.background = '#E0E7FF'; });
    suggClick.addEventListener('mouseleave', () => { suggClick.style.background = '#EEF2FF'; });
  }

  const applyBtn  = card.querySelector('.og-apply-btn') as HTMLButtonElement;
  const rephraseBtn = card.querySelector('.og-rephrase-btn') as HTMLButtonElement;
  const ignoreBtn = card.querySelector('.og-ignore-btn') as HTMLButtonElement;

  applyBtn.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault();
    applySuggestion(element, issue, anchor);
    hideTooltip();
  });
  applyBtn.addEventListener('mouseenter', () => { applyBtn.style.background = '#4338CA'; });
  applyBtn.addEventListener('mouseleave', () => { applyBtn.style.background = '#4F46E5'; });

  rephraseBtn.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault();
    showRephrasePanel(card, issue, element, anchor);
  });
  rephraseBtn.addEventListener('mouseenter', () => { rephraseBtn.style.background = '#f8f9fa'; });
  rephraseBtn.addEventListener('mouseleave', () => { rephraseBtn.style.background = 'white'; });

  ignoreBtn.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault();
    ignoreIssue(issue, anchor);
    hideTooltip();
  });
  ignoreBtn.addEventListener('mouseenter', () => { ignoreBtn.style.background = '#f8f9fa'; });
  ignoreBtn.addEventListener('mouseleave', () => { ignoreBtn.style.background = 'white'; });

  card.addEventListener('mousedown', (e) => e.preventDefault());

  const closeOnOutsideClick = (e: MouseEvent) => {
    const t = e.target as Node;
    if (!card.contains(t) && !anchor.contains(t) && !(currentRephrasePanel?.contains(t))) {
      hideTooltip();
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 100);

  document.body.appendChild(card);
  placeFixedPanel(card, anchorRect, 8);
  currentTooltip = card;
}

/* ────────────────────────────────────────────────────────────
   REPHRASE PANEL (slides below tooltip card)
──────────────────────────────────────────────────────────── */
function showRephrasePanel(tooltipCard: HTMLElement, issue: Issue, element: HTMLElement, highlightAnchor: HTMLElement) {
  currentRephrasePanel?.remove();

  const panel     = document.createElement('div');
  panel.className = 'opengrammar-rephrase-panel';
  panel.style.cssText = `
    position: fixed;
    left: -9999px; top: -9999px;
    width: 334px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.14), 0 1px 6px rgba(0,0,0,0.07);
    border: 1px solid rgba(0,0,0,0.07);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    animation: og-fade-in 0.12s ease;
  `;

  const goals = [
    { id: 'clarity',  icon: '🎯', label: 'Clearer' },
    { id: 'formal',   icon: '👔', label: 'More Formal' },
    { id: 'concise',  icon: '✂️', label: 'Concise' },
    { id: 'friendly', icon: '😊', label: 'Friendlier' },
  ];

  panel.innerHTML = `
    <div style="padding: 12px 14px; border-bottom: 1px solid #f0f0f0; display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:7px;">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4F46E5" stroke-width="1.6" stroke-linecap="round">
          <path d="M2 8a6 6 0 1 1 1.5 4M2 12V8h4"/>
        </svg>
        <span style="font-size:13px;font-weight:700;color:#1c1c1e;">✨ Rephrase Sentence</span>
      </div>
      <button class="og-close-rephrase" style="
        background:none;border:none;cursor:pointer;padding:4px;
        color:#8e8e93;border-radius:6px;font-size:16px;line-height:1;
        transition:background 0.1s;
      " aria-label="Close">✕</button>
    </div>

    <!-- Goal selector -->
    <div style="padding: 10px 14px; border-bottom: 1px solid #f4f4f5; display:flex; gap:6px; flex-wrap:wrap;">
      ${goals.map(g => `
        <button class="og-goal-btn" data-goal="${g.id}" style="
          padding: 5px 10px;
          background: ${g.id === 'clarity' ? '#EEF2FF' : '#f4f4f5'};
          color: ${g.id === 'clarity' ? '#3730A3' : '#5f6368'};
          border: 1px solid ${g.id === 'clarity' ? '#C7D2FE' : '#e5e7eb'};
          border-radius: 999px;
          font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.12s;
          font-family: inherit;
          white-space: nowrap;
        ">${g.icon} ${g.label}</button>
      `).join('')}
    </div>

    <!-- Content area -->
    <div class="og-rephrase-content" style="padding: 10px 14px; min-height: 80px;">
      <div class="og-rephrase-loading" style="
        display:flex;flex-direction:column;align-items:center;
        justify-content:center; gap:8px; padding:24px 0;
      ">
        <div style="
          width: 22px; height: 22px;
          border: 2px solid #e5e7eb; border-top-color: #4F46E5;
          border-radius: 50%;
          animation: og-spin 0.7s linear infinite;
        "></div>
        <span style="font-size:12px;color:#8e8e93;">Generating alternatives…</span>
      </div>
    </div>

    <!-- Sentence shown -->
    <div style="padding: 0 14px 10px;">
      <div style="
        font-size: 11px; color: #8e8e93; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.5px;
        margin-bottom: 4px;
      ">Original sentence</div>
      <div style="
        font-size: 13px; color: #3c3c43;
        background: #fafafa; border-radius: 6px;
        padding: 7px 10px; line-height: 1.45;
        border: 1px solid #f0f0f0;
        word-break: break-word;
      ">${escapeHtml(issue.original)}</div>
    </div>

    <div style="padding: 0 14px 12px;">
      <p style="font-size:11px;color:#aeaeb2;margin:0;text-align:center;">
        Powered by your configured AI provider · Requires API key
      </p>
    </div>
  `;

  panel.addEventListener('mousedown', (e) => e.preventDefault());

  // Close button
  const closeBtn = panel.querySelector('.og-close-rephrase') as HTMLButtonElement;
  closeBtn.addEventListener('click', () => {
    currentRephrasePanel?.remove();
    currentRephrasePanel = null;
  });
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#f4f4f5'; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'none'; });

  // Goal buttons
  let activeGoal = 'clarity';
  const goalBtns = panel.querySelectorAll('.og-goal-btn') as NodeListOf<HTMLButtonElement>;

  const setGoalActive = (goal: string) => {
    activeGoal = goal;
    goalBtns.forEach((btn) => {
      const isActive = btn.dataset.goal === goal;
      btn.style.background = isActive ? '#EEF2FF' : '#f4f4f5';
      btn.style.color        = isActive ? '#3730A3' : '#5f6368';
      btn.style.borderColor  = isActive ? '#C7D2FE' : '#e5e7eb';
    });
    triggerRephrase(goal);
  };

  goalBtns.forEach((btn) => {
    btn.addEventListener('click', () => setGoalActive(btn.dataset.goal || 'clarity'));
  });

  document.body.appendChild(panel);
  const repositionPanel = () =>
    placeFixedPanel(panel, tooltipCard.getBoundingClientRect(), 6);
  repositionPanel();
  currentRephrasePanel = panel;

  // Auto-trigger rephrase with default goal
  triggerRephrase(activeGoal);

  async function triggerRephrase(goal: string) {
    const content = panel.querySelector('.og-rephrase-content') as HTMLElement;
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px 0;">
        <div style="
          width:22px;height:22px;
          border:2px solid #e5e7eb;border-top-color:#4F46E5;
          border-radius:50%;animation:og-spin 0.7s linear infinite;
        "></div>
        <span style="font-size:12px;color:#8e8e93;">Generating alternatives…</span>
      </div>
    `;

    try {
      const stored = await new Promise<Record<string, string>>((res) =>
        chrome.storage.sync.get(['apiKey', 'provider', 'model', 'backendUrl', 'customBaseUrl'], (r) => res(r as Record<string, string>))
      );
      const apiKey    = stored.apiKey    || '';
      const provider  = stored.provider  || 'groq';
      const model     = stored.model     || '';
      const backendUrl = stored.backendUrl || 'http://localhost:8787';

      if (!apiKey && provider !== 'ollama') {
        content.innerHTML = `
          <div style="padding:16px;text-align:center;">
            <div style="font-size:13px;color:#dc2626;margin-bottom:6px;">🔑 API key required</div>
            <div style="font-size:12px;color:#8e8e93;">Add your API key in the OpenGrammar popup settings, then try again.</div>
          </div>
        `;
        repositionPanel();
        return;
      }

      const res = await fetch(`${backendUrl}/rephrase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: issue.original, goal, apiKey, provider, model }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { suggestions?: { text: string; label: string }[]; explanation?: string } = await res.json();
      const suggestions = data.suggestions || [];

      if (suggestions.length === 0) {
        content.innerHTML = `
          <div style="padding:16px;text-align:center;font-size:13px;color:#8e8e93;">
            No alternatives generated. Try a different goal.
          </div>
        `;
        repositionPanel();
        return;
      }

      content.innerHTML = suggestions.map((s, i) => `
        <div class="og-rephrase-item" data-idx="${i}" style="
          display:flex; align-items:flex-start; gap:10px;
          padding: 9px 10px; margin-bottom: 5px;
          border: 1px solid #e5e7eb; border-radius: 8px;
          cursor: pointer; transition: all 0.12s;
          background: white;
        ">
          <span style="
            flex-shrink:0;
            display:inline-flex;align-items:center;justify-content:center;
            width:20px;height:20px;border-radius:50%;
            background:#EEF2FF;border:1px solid #C7D2FE;
            font-size:11px;font-weight:700;color:#3730A3;
            margin-top:1px;
          ">${i + 1}</span>
          <span style="font-size:13px;color:#1c1c1e;line-height:1.45;flex:1;word-break:break-word;">
            ${escapeHtml(s.text)}
          </span>
          <button class="og-use-btn" data-text="${escapeHtml(s.text)}" style="
            flex-shrink:0;
            padding: 4px 10px;
            background: #4F46E5; color: white;
            border: none; border-radius: 6px;
            font-size: 11px; font-weight: 700;
            cursor: pointer; transition: background 0.12s;
            font-family: inherit; white-space: nowrap;
            align-self: center;
          ">Use</button>
        </div>
      `).join('');

      // Wire "Use" buttons
      content.querySelectorAll('.og-use-btn').forEach((btn) => {
        const useBtn = btn as HTMLButtonElement;
        useBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const text = useBtn.dataset.text ? decodeHtmlEntities(useBtn.dataset.text) : '';
          if (text && element) {
            applySuggestion(element, { ...issue, suggestion: text }, highlightAnchor);
          }
          hideTooltip();
          currentRephrasePanel?.remove();
          currentRephrasePanel = null;
        });
        useBtn.addEventListener('mouseenter', () => { useBtn.style.background = '#4338CA'; });
        useBtn.addEventListener('mouseleave', () => { useBtn.style.background = '#4F46E5'; });
      });

      // Hover effect on rows
      content.querySelectorAll('.og-rephrase-item').forEach((row) => {
        const r = row as HTMLElement;
        r.addEventListener('mouseenter', () => { r.style.background = '#f9fafb'; r.style.borderColor = '#d1d5db'; });
        r.addEventListener('mouseleave', () => { r.style.background = 'white'; r.style.borderColor = '#e5e7eb'; });
      });
      repositionPanel();

    } catch (err) {
      content.innerHTML = `
        <div style="padding:16px;text-align:center;font-size:13px;color:#dc2626;">
          Failed to get suggestions. Check your API key and backend connection.
        </div>
      `;
      repositionPanel();
    }
  }

}

function decodeHtmlEntities(str: string): string {
  const d = document.createElement('div');
  d.innerHTML = str;
  return d.textContent || '';
}

/* ────────────────────────────────────────────────────────────
   SPELL CHECK REVIEW PANEL
   Shows spelling issues one-by-one with full sentence context,
   Fix This / Fix All Spelling / Skip navigation.
──────────────────────────────────────────────────────────── */

function getFullText(element: HTMLElement): string {
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return (element as HTMLInputElement | HTMLTextAreaElement).value;
  }
  return element.textContent || '';
}

/**
 * Apply an arbitrary set of issues to the element atomically. Fixes are applied
 * in reverse offset order so that earlier character positions stay valid while
 * later ones are rewritten. Used for "Accept Sentence" and "Fix All".
 */
function applyIssueSet(element: HTMLElement, issues: Issue[]) {
  const toFix = [...issues]
    .filter(i => !i.ignored && i.suggestion !== i.original)
    .sort((a, b) => b.offset - a.offset);
  if (toFix.length === 0) return;

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    let text = input.value;
    for (const issue of toFix) {
      const span = resolveInString(text, issue.offset, issue.length, issue.original);
      if (!span) continue; // stale — skip rather than corrupt
      text = text.substring(0, span.start) + issue.suggestion + text.substring(span.end);
    }
    input.value = text;
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (element.isContentEditable) {
    // Build the map ONCE; apply highest-offset first so earlier text nodes
    // (and therefore the snapshot map) stay valid for the remaining fixes.
    const map = buildTextMap(element);
    for (const issue of toFix) {
      const span = resolveSpan(map, issue.offset, issue.length, issue.original);
      if (!span) continue; // text changed since analysis — skip, don't corrupt
      const range = offsetToRange(map, span.start, span.end);
      if (!range) continue;
      range.deleteContents();
      range.insertNode(document.createTextNode(issue.suggestion));
    }
    element.normalize();
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

interface SentenceGroup {
  start: number;
  end: number;
  issues: Issue[];
}

/**
 * Group fixable issues by the sentence they fall in, so corrections can be
 * reviewed and accepted a whole sentence at a time instead of word-by-word.
 */
function getSentenceGroups(text: string, issues: Issue[]): SentenceGroup[] {
  // Re-validate every issue against the CURRENT text. If the text changed since
  // analysis (e.g. the user just accepted a fix), a stale offset would splice
  // the suggestion at the wrong place and garble the sentence ("haven't" ->
  // "havenn't"). resolveInString drops issues that no longer match and rebases
  // ones that merely shifted, so the panel only ever shows valid corrections.
  const fixable = issues
    .filter(i => !i.ignored && i.suggestion !== i.original)
    .map((i) => {
      const span = resolveInString(text, i.offset, i.length, i.original);
      if (!span) return null;
      return { ...i, offset: span.start, length: span.end - span.start };
    })
    .filter((i): i is Issue => i !== null)
    .sort((a, b) => a.offset - b.offset);

  const groups: SentenceGroup[] = [];
  for (const issue of fixable) {
    let s = issue.offset;
    while (s > 0) {
      const ch = text[s - 1];
      if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') break;
      s--;
    }
    while (s < issue.offset && (text[s] === ' ' || text[s] === '\n')) s++;

    let e = issue.offset + issue.length;
    while (e < text.length) {
      const ch = text[e];
      if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') { e++; break; }
      e++;
    }

    const last = groups[groups.length - 1];
    if (last && s < last.end && last.start < e) {
      last.start = Math.min(last.start, s);
      last.end = Math.max(last.end, e);
      last.issues.push(issue);
    } else {
      groups.push({ start: s, end: e, issues: [issue] });
    }
  }
  return groups;
}

function typeColorLine(type: string): string {
  return getC(type).line;
}

/**
 * Render a sentence as HTML with each issue span marked with a wavy underline.
 * Offsets in `issues` are absolute; `sentenceStart` maps them into the slice.
 */
function renderMarkedSentence(text: string, group: SentenceGroup): string {
  const sentence = text.slice(group.start, group.end);
  const spans = [...group.issues].sort((a, b) => a.offset - b.offset);
  let cursor = 0;
  let html = '';
  for (const issue of spans) {
    const rel = Math.max(0, issue.offset - group.start);
    const relEnd = Math.min(sentence.length, issue.offset + issue.length - group.start);
    if (relEnd <= rel) continue;
    if (rel > cursor) html += escapeHtml(sentence.slice(cursor, rel));
    const line = typeColorLine(issue.type);
    html += `<mark style="background:${line}14;border-radius:3px;padding:0 1px;text-decoration:underline;text-decoration-style:wavy;text-decoration-color:${line};color:#b91c1c;font-style:normal;font-weight:600;">${escapeHtml(sentence.slice(rel, relEnd))}</mark>`;
    cursor = relEnd;
  }
  if (cursor < sentence.length) html += escapeHtml(sentence.slice(cursor));
  return html.trim();
}

/** Build the corrected sentence string by applying the group's fixes. */
function buildCorrectedSentence(text: string, group: SentenceGroup): string {
  let sentence = text.slice(group.start, group.end);
  const ordered = [...group.issues].sort((a, b) => b.offset - a.offset);
  for (const issue of ordered) {
    const rel = issue.offset - group.start;
    const relEnd = rel + issue.length;
    if (rel < 0 || relEnd > sentence.length) continue;
    sentence = sentence.slice(0, rel) + issue.suggestion + sentence.slice(relEnd);
  }
  return sentence.trim();
}

function showSentenceReview(
  allIssues: Issue[],
  element: HTMLElement,
  groupIndex: number,
  precomputed?: SentenceGroup[],
) {
  uiActive = true;
  currentTooltip?.remove();
  currentRephrasePanel?.remove();
  currentRephrasePanel = null;
  injectStyles();

  const text = getFullText(element);
  const groups = precomputed ?? getSentenceGroups(text, allIssues);

  if (groups.length === 0) { hideTooltip(); return; }
  const idx = Math.max(0, Math.min(groupIndex, groups.length - 1));
  const group = groups[idx]!;
  const total = groups.length;
  const isFirst = idx === 0;
  const isLast  = idx >= total - 1;

  const originalHtml  = renderMarkedSentence(text, group);
  const correctedText = buildCorrectedSentence(text, group);
  const changeCount   = group.issues.length;
  const totalFixes    = groups.reduce((n, g) => n + g.issues.length, 0);

  const typeCounts = new Map<string, number>();
  for (const i of group.issues) typeCounts.set(i.type, (typeCounts.get(i.type) || 0) + 1);
  const typeSummary = [...typeCounts.entries()]
    .map(([t, n]) => `${n} ${getTypeLabel(t).toLowerCase()}`)
    .join(' · ');

  const changeListHtml = [...group.issues]
    .sort((a, b) => a.offset - b.offset)
    .map((i) => {
      const line = typeColorLine(i.type);
      return `
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;line-height:1.5;padding:2px 0;">
          <span style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:${line};"></span>
          <span style="color:#b91c1c;text-decoration:line-through;word-break:break-word;">${escapeHtml(i.original)}</span>
          <span style="color:#aaa;">→</span>
          <span style="color:#3730A3;font-weight:600;word-break:break-word;">${escapeHtml(i.suggestion)}</span>
        </div>`;
    })
    .join('');

  const card = document.createElement('div');
  card.className = 'opengrammar-tooltip';
  card.style.cssText = `
    position: fixed;
    right: 24px;
    bottom: 84px;
    width: 360px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.14), 0 1px 6px rgba(0,0,0,0.07);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.07);
    animation: og-fade-in 0.12s ease;
  `;

  card.innerHTML = `
    <!-- Header: progress + nav arrows -->
    <div style="
      padding: 11px 14px 9px;
      display:flex; align-items:center; justify-content:space-between;
      border-bottom: 1px solid #f0f0f0;
      background: #fafafa;
    ">
      <div style="display:flex; align-items:center; gap:9px;">
        <span style="
          display:inline-flex; align-items:center; justify-content:center;
          width:28px; height:28px; border-radius:50%;
          background:#4F46E518; flex-shrink:0;
        ">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#4F46E5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 11.5 11 2.5l2.5 2.5L4.5 14H2z"/><path d="M9.5 4 12 6.5"/>
          </svg>
        </span>
        <div>
          <div style="font-size:12px; font-weight:600; color:#4F46E5; text-transform:uppercase; letter-spacing:0.5px;">Sentence ${idx + 1} of ${total}</div>
          <div style="font-size:11px; color:#8e8e93;">${changeCount} change${changeCount !== 1 ? 's' : ''}${typeSummary ? ' · ' + escapeHtml(typeSummary) : ''}</div>
        </div>
      </div>
      ${total > 1 ? `
      <div style="display:flex; gap:4px; align-items:center;">
        <button class="og-sr-prev" style="
          width:28px; height:28px;
          display:flex; align-items:center; justify-content:center;
          background:white; border:1px solid #e5e5ea; border-radius:7px;
          cursor:${isFirst ? 'default' : 'pointer'};
          opacity:${isFirst ? '0.3' : '1'};
          font-size:16px; color:#3c3c43; line-height:1;
        ">‹</button>
        <button class="og-sr-next" style="
          width:28px; height:28px;
          display:flex; align-items:center; justify-content:center;
          background:white; border:1px solid #e5e5ea; border-radius:7px;
          cursor:${isLast ? 'default' : 'pointer'};
          opacity:${isLast ? '0.3' : '1'};
          font-size:16px; color:#3c3c43; line-height:1;
        ">›</button>
      </div>` : ''}
    </div>

    <!-- Original sentence with errors marked inline -->
    <div style="padding: 11px 14px 9px;">
      <div style="font-size:10px; color:#8e8e93; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:5px;">Original sentence</div>
      <div style="
        font-size:13px; color:#3c3c43; line-height:1.6; word-break:break-word;
        background:#fff7f7; border:1px solid #ffe0e0; border-radius:7px; padding:8px 10px;
      ">${originalHtml}</div>
    </div>

    <!-- Corrected sentence (all fixes applied) -->
    <div class="og-sr-accept-box" style="padding: 0 14px 10px; cursor:pointer;">
      <div style="font-size:10px; color:#8e8e93; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:5px;">Corrected sentence</div>
      <div style="
        font-size:13px; color:#1c1c1e; line-height:1.6; word-break:break-word; font-weight:500;
        background:#EEF2FF; border:1px solid #C7D2FE; border-radius:7px; padding:8px 10px;
        transition:background 0.12s;
      ">${escapeHtml(correctedText)}</div>
    </div>

    <!-- Per-change breakdown -->
    <details style="border-top:1px solid #f0f0f0;">
      <summary style="
        padding:8px 14px; cursor:pointer; font-size:12px; color:#5f6368;
        font-weight:600; list-style:none; user-select:none;
      ">View ${changeCount} individual change${changeCount !== 1 ? 's' : ''}</summary>
      <div style="padding:2px 14px 10px;">${changeListHtml}</div>
    </details>

    <!-- Action buttons -->
    <div style="display:flex; border-top:1px solid #f0f0f0;">
      ${total > 1 ? `
      <button class="og-sr-fix-all" style="
        flex:1; padding:10px 8px;
        background:white; color:#4F46E5;
        border:none; border-right:1px solid #f0f0f0; cursor:pointer;
        font-size:11px; font-weight:700; line-height:1.35;
        font-family:inherit; transition:background 0.12s;
      ">Fix All<br><span style="font-weight:400; color:#8e8e93;">${totalFixes} change${totalFixes !== 1 ? 's' : ''}</span></button>` : ''}
      <button class="og-sr-accept" style="
        flex:2; padding:11px 10px;
        background:#4F46E5; color:white;
        border:none; cursor:pointer;
        font-size:13px; font-weight:600;
        border-radius:0 0 0 ${total > 1 ? '0' : '12px'};
        font-family:inherit; transition:background 0.12s;
        display:flex; align-items:center; justify-content:center; gap:5px;
      ">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="white">
          <path d="M6.5 11.5L2.5 7.5l1.06-1.06 2.94 2.93 5.94-5.93 1.06 1.06z"/>
        </svg>
        Accept Sentence
      </button>
      <button class="og-sr-skip" style="
        flex:1; padding:11px 10px;
        background:white; color:#5f6368;
        border:none; border-left:1px solid #f0f0f0;
        cursor:pointer;
        font-size:13px; font-weight:500;
        border-radius:0 0 12px 0;
        font-family:inherit; transition:background 0.12s;
      ">Skip</button>
    </div>
  `;

  card.addEventListener('mousedown', (e) => e.preventDefault());

  const acceptSentence = () => {
    applyIssueSet(element, group.issues);
    // Shift offsets of every later group so subsequent accepts land correctly
    const delta = group.issues.reduce((d, i) => d + (i.suggestion.length - i.length), 0);
    if (delta !== 0) {
      for (let g = idx + 1; g < groups.length; g++) {
        const grp = groups[g]!;
        grp.start += delta;
        grp.end += delta;
        for (const iss of grp.issues) iss.offset += delta;
      }
    }
    // Drop the accepted group and show the next remaining one
    groups.splice(idx, 1);
    if (groups.length === 0) { hideTooltip(); return; }
    showSentenceReview(allIssues, element, Math.min(idx, groups.length - 1), groups);
  };

  const acceptBox = card.querySelector('.og-sr-accept-box') as HTMLElement | null;
  const correctedInner = acceptBox?.firstElementChild?.nextElementSibling as HTMLElement | undefined;
  if (acceptBox) {
    acceptBox.addEventListener('click', (e) => { e.stopPropagation(); acceptSentence(); });
    acceptBox.addEventListener('mouseenter', () => { if (correctedInner) correctedInner.style.background = '#E0E7FF'; });
    acceptBox.addEventListener('mouseleave', () => { if (correctedInner) correctedInner.style.background = '#EEF2FF'; });
  }

  const acceptBtn = card.querySelector('.og-sr-accept') as HTMLButtonElement | null;
  if (acceptBtn) {
    acceptBtn.addEventListener('click', (e) => { e.stopPropagation(); acceptSentence(); });
    acceptBtn.addEventListener('mouseenter', () => { acceptBtn.style.background = '#4338CA'; });
    acceptBtn.addEventListener('mouseleave', () => { acceptBtn.style.background = '#4F46E5'; });
  }

  const fixAllBtn = card.querySelector('.og-sr-fix-all') as HTMLButtonElement | null;
  if (fixAllBtn) {
    fixAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const everything = groups.flatMap(g => g.issues);
      applyIssueSet(element, everything);
      hideTooltip();
    });
    fixAllBtn.addEventListener('mouseenter', () => { fixAllBtn.style.background = '#f0f0ff'; });
    fixAllBtn.addEventListener('mouseleave', () => { fixAllBtn.style.background = 'white'; });
  }

  const skipBtn = card.querySelector('.og-sr-skip') as HTMLButtonElement | null;
  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isLast) showSentenceReview(allIssues, element, idx + 1, groups);
      else hideTooltip();
    });
    skipBtn.addEventListener('mouseenter', () => { skipBtn.style.background = '#f8f9fa'; });
    skipBtn.addEventListener('mouseleave', () => { skipBtn.style.background = 'white'; });
  }

  const prevBtn = card.querySelector('.og-sr-prev') as HTMLButtonElement | null;
  if (prevBtn && !isFirst) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSentenceReview(allIssues, element, idx - 1, groups);
    });
  }

  const nextBtn = card.querySelector('.og-sr-next') as HTMLButtonElement | null;
  if (nextBtn && !isLast) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSentenceReview(allIssues, element, idx + 1, groups);
    });
  }

  const closeOnOutsideClick = (e: MouseEvent) => {
    if (!card.contains(e.target as Node)) {
      hideTooltip();
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 100);

  document.body.appendChild(card);
  currentTooltip = card;
}

/* ────────────────────────────────────────────────────────────
   INPUT / TEXTAREA MIRROR & BADGE
──────────────────────────────────────────────────────────── */
function showInputMirror(element: HTMLElement, issues: Issue[]) {
  destroyInputMirror();
  inputMirrorTarget = element;

  const overlay = document.createElement('div');
  overlay.className = 'opengrammar-input-mirror';
  overlay.style.cssText = `
    position: fixed; pointer-events: none;
    z-index: 2147483645; overflow: hidden;
    background: transparent; border-radius: inherit;
  `;

  const content = document.createElement('div');
  content.className = 'opengrammar-input-mirror-content';
  content.style.cssText = `
    position: absolute; top: 0; left: 0;
    width: max-content; min-width: 100%;
    color: inherit;
    white-space: ${element.tagName === 'TEXTAREA' ? 'pre-wrap' : 'pre'};
    word-break: break-word;
  `;

  copyTypographyStyles(element, overlay, content);
  content.innerHTML = buildMirrorMarkup(getElementText(element), issues);
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  const input = element as HTMLInputElement | HTMLTextAreaElement;
  const origColor = input.dataset.ogOriginalColor || window.getComputedStyle(input).color;
  input.dataset.ogOriginalColor = origColor;
  input.style.color = 'transparent';
  input.style.webkitTextFillColor = 'transparent';
  input.style.caretColor = origColor;

  const sync = () => syncInputMirrorScroll(element);
  input.addEventListener('scroll', sync, { passive: true });
  cleanupInputMirror = () => {
    input.removeEventListener('scroll', sync);
    input.style.color = input.dataset.ogOriginalColor || '';
    input.style.webkitTextFillColor = '';
  };

  inputMirrorOverlay = overlay;
  inputMirrorContent = content;
  positionInputMirror(element);
  syncInputMirrorScroll(element);
}

function showInputBadge(element: HTMLElement, issues: Issue[]) {
  document.querySelectorAll('.opengrammar-badge').forEach((el) => el.remove());

  const rect      = element.getBoundingClientRect();
  const badge     = document.createElement('div');
  badge.className = 'opengrammar-badge';
  const hasErrors = issues.some(i => i.type === 'grammar' || i.type === 'spelling');

  badge.style.cssText = `
    position: fixed;
    left: ${rect.right - 32}px; top: ${rect.top + 6}px;
    min-width: 22px; height: 22px; padding: 0 5px;
    background: ${hasErrors ? '#e53935' : '#f59e0b'};
    color: white;
    border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
    z-index: 2147483646;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    transition: transform 0.15s;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  badge.textContent = issues.length.toString();

  badge.addEventListener('mouseenter', () => { badge.style.transform = 'scale(1.12)'; });
  badge.addEventListener('mouseleave', () => { badge.style.transform = 'scale(1)'; });
  badge.addEventListener('mousedown', (e) => e.preventDefault());
  badge.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault();
    if (issues.length > 0) showSentenceReview(issues, element, 0);
  });

  document.body.appendChild(badge);
}

function copyTypographyStyles(element: HTMLElement, overlay: HTMLElement, content: HTMLElement) {
  const styles = window.getComputedStyle(element);
  const target = element as HTMLInputElement | HTMLTextAreaElement;
  const rect   = element.getBoundingClientRect();
  overlay.style.left   = `${rect.left}px`;
  overlay.style.top    = `${rect.top}px`;
  overlay.style.width  = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.borderRadius = styles.borderRadius;
  content.style.font          = styles.font;
  content.style.fontFamily    = styles.fontFamily;
  content.style.fontSize      = styles.fontSize;
  content.style.fontWeight    = styles.fontWeight;
  content.style.lineHeight    = styles.lineHeight;
  content.style.letterSpacing = styles.letterSpacing;
  content.style.textTransform = styles.textTransform;
  content.style.textAlign     = styles.textAlign;
  content.style.padding       = styles.padding;
  content.style.color         = target.dataset.ogOriginalColor || styles.color;
}

function positionInputMirror(element: HTMLElement) {
  if (!inputMirrorOverlay) return;
  const rect = element.getBoundingClientRect();
  inputMirrorOverlay.style.left   = `${rect.left}px`;
  inputMirrorOverlay.style.top    = `${rect.top}px`;
  inputMirrorOverlay.style.width  = `${rect.width}px`;
  inputMirrorOverlay.style.height = `${rect.height}px`;
}

function syncInputMirrorScroll(element: HTMLElement) {
  if (!inputMirrorContent) return;
  const input = element as HTMLInputElement | HTMLTextAreaElement;
  inputMirrorContent.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`;
}

function buildMirrorMarkup(text: string, issues: Issue[]): string {
  if (!issues.length) return escapeHtmlPreservingWhitespace(text);
  const sorted = [...issues].sort((a, b) => a.offset - b.offset);
  let cursor = 0;
  const parts: string[] = [];
  for (const issue of sorted) {
    const start = Math.max(0, Math.min(issue.offset, text.length));
    const end   = Math.max(start, Math.min(issue.offset + issue.length, text.length));
    if (cursor < start) parts.push(escapeHtmlPreservingWhitespace(text.slice(cursor, start)));
    const c = getC(issue.type);
    parts.push(
      `<span style="color:${c.line};background:${c.bg};border-bottom:2px wavy ${c.line};border-radius:2px;">${escapeHtmlPreservingWhitespace(text.slice(start, end) || issue.original)}</span>`,
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(escapeHtmlPreservingWhitespace(text.slice(cursor)));
  return parts.join('');
}

function getElementText(element: HTMLElement): string {
  return element.tagName === 'TEXTAREA'
    ? (element as HTMLTextAreaElement).value
    : (element as HTMLInputElement).value;
}

function destroyInputMirror() {
  cleanupInputMirror?.(); cleanupInputMirror = null;
  inputMirrorOverlay?.remove(); inputMirrorOverlay = null;
  inputMirrorContent = null; inputMirrorTarget = null;
}

/* ────────────────────────────────────────────────────────────
   APPLY / IGNORE / HIDE
──────────────────────────────────────────────────────────── */
function hideTooltip() {
  currentTooltip?.remove(); currentTooltip = null;
  uiActive = false;
}

function applySuggestion(element: HTMLElement, issue: Issue, highlightEl: HTMLElement) {
  void chrome.runtime.sendMessage({
    type: 'TRACK_ANALYTICS_EVENT',
    eventType: 'suggestions_applied',
    payload: { count: 1, domain: window.location.hostname },
  });

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const text  = input.value;
    // Validate the offset still points at the original text (it may have
    // shifted from earlier accepts); re-find locally or drop instead of
    // slicing the wrong characters.
    const span = resolveInString(text, issue.offset, issue.length, issue.original);
    if (!span) return;
    input.value = text.substring(0, span.start) + issue.suggestion + text.substring(span.end);
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (element.isContentEditable) {
    // No DOM mutation for highlights anymore, so highlightEl is irrelevant here.
    // Map-based, validated replacement (rebases or drops if text changed).
    if (applyContentEditableFix(element, issue)) {
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  void highlightEl;
}

function ignoreIssue(issue: Issue, highlightEl: HTMLElement) {
  void chrome.runtime.sendMessage({
    type: 'TRACK_ANALYTICS_EVENT',
    eventType: 'suggestions_ignored',
    payload: { count: 1, domain: window.location.hostname },
  });

  chrome.storage.sync.get(['ignoredIssues'], (result) => {
    const ignoredIssues = normalizeIgnoredIssues(result.ignoredIssues);
    const issueId = `${issue.type}-${issue.offset}-${issue.original}`;
    if (!ignoredIssues.some((e) => e.id === issueId)) {
      ignoredIssues.push({ id: issueId, type: issue.type, original: issue.original, suggestion: issue.suggestion, ignoredAt: Date.now() });
      chrome.storage.sync.set({ ignoredIssues });
    }
  });

  // Drop this issue and re-render the remaining overlay underlines (no DOM
  // mutation of the editor — the underline lives in our overlay).
  issue.ignored = true;
  if (overlayTarget) {
    overlayIssues = overlayIssues.filter((i) => i !== issue);
    renderOverlayUnderlines(overlayTarget, overlayIssues);
  }
  if (highlightEl.classList?.contains('opengrammar-badge')) highlightEl.remove();
}

function normalizeIgnoredIssues(value: unknown): IgnoredIssue[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === 'string') return { id: entry, type: 'grammar' as const, original: entry, suggestion: '', ignoredAt: Date.now() };
    if (entry && typeof entry === 'object' && 'id' in entry && 'type' in entry && 'original' in entry && 'suggestion' in entry) return entry as IgnoredIssue;
    return null;
  }).filter(Boolean) as IgnoredIssue[];
}

/* ────────────────────────────────────────────────────────────
   GLOBAL CSS INJECTION (keyframes + font)
──────────────────────────────────────────────────────────── */
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes og-fade-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes og-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .opengrammar-tooltip, .opengrammar-rephrase-panel {
      -webkit-font-smoothing: antialiased;
    }
  `;
  document.head.appendChild(style);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHighlightContainer);
} else {
  initHighlightContainer();
}
