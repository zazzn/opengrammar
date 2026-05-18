import type { IgnoredIssue, Issue } from '../types';
import { buildTextMap, offsetToRange, resolveInString, resolveSpan } from './textMap';
import { diffWords, renderInlineDiffHTML, summarizeChange } from './diff';
import { applyFix } from './editorAdapter';
import { stripQuotedBBCode } from './textExtractor';
import { getApiKey } from '../shared/apiKeyStore';

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
// Cache LLM whole-text corrections by (quote-stripped) source text so
// reopening / navigating the review panel doesn't refetch.
const correctionCache = new Map<string, string>();

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
// Red is reserved for spelling. Grammar = amber/yellow. Clarity = blue,
// style = purple — so the four categories are visually distinct.
const COLORS = {
  spelling: { line: '#e53935', bg: 'rgba(229,57,53,0.10)',  hover: 'rgba(229,57,53,0.20)',  dot: '#e53935' },
  grammar:  { line: '#f5a623', bg: 'rgba(245,166,35,0.12)', hover: 'rgba(245,166,35,0.24)', dot: '#f5a623' },
  clarity:  { line: '#1565c0', bg: 'rgba(21,101,192,0.09)', hover: 'rgba(21,101,192,0.18)', dot: '#1565c0' },
  style:    { line: '#7c3aed', bg: 'rgba(124,58,237,0.10)', hover: 'rgba(124,58,237,0.20)', dot: '#7c3aed' },
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

/**
 * Inline layer = MECHANICAL fixes only: spelling, plus the small/local
 * grammar fixes that are deterministic (punctuation, capitalization,
 * apostrophes, a/an, doubled words, single short-token swaps). Anything
 * clause-level (real grammar, clarity, style) is NOT underlined — it is
 * reachable only via the Grammar/Tone (AI review) button.
 */
function isMechanical(i: Issue): boolean {
  if (i.ignored) return false;
  if (i.type === 'spelling') return true;
  if (i.type === 'clarity' || i.type === 'style') return false;
  const o = (i.original || '').trim();
  const s = (i.suggestion || '').trim();
  if (!s || o === s) return false;
  const bare = (x: string) => x.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (bare(o) === bare(s)) return true; // only punctuation / case / spacing
  if (!/\s/.test(o) && !/\s/.test(s) && o.length <= 14 && s.length <= 18) return true;
  const ops = diffWords(o, s).filter((op) => op.kind !== 'eq');
  const changed = ops.map((op) => op.text).join('');
  return ops.length <= 2 && changed.length <= 14;
}

export function highlightIssues(element: HTMLElement, issues: Issue[]) {
  initHighlightContainer();
  clearHighlights();
  if (!issues || issues.length === 0) return;

  // ONE indicator: the AI Grammar/Tone review button (opens the LLM
  // whole-text review). It's the only floating control now.
  showAssistantBubble(element, issues);

  const mechanical = issues.filter(isMechanical);
  if (mechanical.length === 0) {
    overlayTarget = null;
    overlayIssues = [];
    return;
  }
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    renderInputUnderlines(element, mechanical);
  } else {
    // Contenteditable: overlay only — never mutate/recolor the host DOM.
    renderOverlayUnderlines(element, mechanical);
  }
}

function clearOverlayUnderlines() {
  highlightContainer
    ?.querySelectorAll('.opengrammar-underline')
    .forEach((e) => e.remove());
}

/**
 * Build one positioned squiggle from a viewport-space rect. Shared by the
 * contenteditable (Range) and input/textarea (measurement-mirror) paths so
 * both look and behave identically. Outer div is a transparent hit area
 * over the word; the wave is anchored just under the glyphs (not the
 * bottom of a tall line-box).
 */
function makeUnderlineDiv(
  r: { left: number; top: number; width: number; height: number },
  fs: number,
  c: { line: string },
  issue: Issue,
  element: HTMLElement,
): HTMLElement {
  const leadBelow = Math.max(0, Math.round((r.height - fs * 1.15) / 2));
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
  `;
  const wave = document.createElement('div');
  wave.style.cssText = `
    position: absolute; left: 0; width: 100%; height: 3px;
    bottom: ${leadBelow}px;
    background-image:
      linear-gradient(45deg, transparent 60%, ${c.line} 60%, ${c.line} 78%, transparent 78%),
      linear-gradient(-45deg, transparent 60%, ${c.line} 60%, ${c.line} 78%, transparent 78%);
    background-size: 6px 3px;
    background-repeat: repeat-x;
    pointer-events: none;
  `;
  u.appendChild(wave);
  u.title = issue.reason || '';
  u.addEventListener('mousedown', (e) => e.preventDefault());
  if (issue.type === 'spelling') {
    const open = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      showSpellingMenu(u, issue, element);
    };
    u.addEventListener('click', open);
    u.addEventListener('contextmenu', open);
  } else {
    // Mechanical grammar (punctuation/caps/apostrophe): one-issue card.
    u.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showTooltip(u, issue, element);
    });
  }
  return u;
}

/** Contenteditable: draw mechanical underlines from live Ranges. */
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
    const cEl =
      (range.startContainer.nodeType === 1
        ? (range.startContainer as Element)
        : range.startContainer.parentElement) || element;
    const fs = parseFloat(getComputedStyle(cEl).fontSize) || 16;
    const c = getC(issue.type);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width === 0 || r.height === 0) continue;
      highlightContainer.appendChild(makeUnderlineDiv(r, fs, c, issue, element));
    }
  }
}

/**
 * Input/textarea: measure issue rects with a HIDDEN style-cloned mirror
 * (visibility:hidden retains layout) and draw the same overlay squiggles.
 * The real field is NEVER recolored or hidden — fixes the "text invisible
 * for several seconds" bug.
 */
function renderInputUnderlines(element: HTMLElement, issues: Issue[]) {
  initHighlightContainer();
  clearOverlayUnderlines();
  destroyInputMirror();
  overlayTarget = element;
  overlayIssues = issues;
  const input = element as HTMLInputElement | HTMLTextAreaElement;
  inputMirrorTarget = element;

  const overlay = document.createElement('div');
  overlay.className = 'opengrammar-input-mirror';
  overlay.style.cssText = `
    position: fixed; visibility: hidden; pointer-events: none;
    z-index: -1; overflow: hidden; background: transparent;
  `;
  const content = document.createElement('div');
  content.className = 'opengrammar-input-mirror-content';
  content.style.cssText = `
    position: absolute; top: 0; left: 0;
    width: max-content; min-width: 100%;
    white-space: ${element.tagName === 'TEXTAREA' ? 'pre-wrap' : 'pre'};
    word-break: break-word;
  `;
  copyTypographyStyles(element, overlay, content);
  content.textContent = input.value; // single plain text node — measurement only
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  inputMirrorOverlay = overlay;
  inputMirrorContent = content;
  positionInputMirror(element);
  syncInputMirrorScroll(element);

  const sync = () => syncInputMirrorScroll(element);
  input.addEventListener('scroll', sync, { passive: true });
  cleanupInputMirror = () => input.removeEventListener('scroll', sync);

  if (!highlightContainer) return;
  const tnode = content.firstChild;
  if (!tnode) return;
  const len = (tnode.textContent || '').length;
  const fs = parseFloat(getComputedStyle(input).fontSize) || 16;
  const clip = input.getBoundingClientRect();
  for (const issue of issues) {
    if (issue.ignored) continue;
    const span = resolveInString(input.value, issue.offset, issue.length, issue.original);
    if (!span) continue;
    const range = document.createRange();
    try {
      range.setStart(tnode, Math.min(span.start, len));
      range.setEnd(tnode, Math.min(span.end, len));
    } catch {
      continue;
    }
    const c = getC(issue.type);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < clip.top || r.top > clip.bottom || r.right < clip.left || r.left > clip.right) {
        continue; // scrolled out of the field
      }
      highlightContainer.appendChild(makeUnderlineDiv(r, fs, c, issue, element));
    }
  }
}

/**
 * Apply a single correction to a contenteditable using the shared map.
 * Validates the span still matches `original` (rebasing if the user edited),
 * and drops the fix instead of corrupting text when it no longer matches.
 * Returns true if applied.
 */
function applyContentEditableFix(element: HTMLElement, issue: Issue): boolean {
  return applyFix(element, {
    original: issue.original,
    offset: issue.offset,
    length: issue.length,
    replacement: issue.suggestion,
  });
}

/** Replace one whole sentence span with the LLM-corrected text — same
 *  validated one-primitive path as every other apply. */
function replaceSentence(
  element: HTMLElement,
  origText: string,
  approxOffset: number,
  newText: string,
): boolean {
  return applyFix(element, {
    original: origText,
    offset: approxOffset,
    length: origText.length,
    replacement: newText,
  });
}

export function clearHighlights() {
  clearOverlayUnderlines();
  overlayTarget = null;
  overlayIssues = [];
  destroyInputMirror();
  assistantBubble?.remove(); assistantBubble = null;
  assistantTarget = null;
  currentSpellMenu?.remove(); currentSpellMenu = null;
  currentTooltip?.remove(); currentTooltip = null;
  currentRephrasePanel?.remove(); currentRephrasePanel = null;
  uiActive = false;
}

export function refreshFloatingDecorations() {
  positionAssistantBubble();
  // Re-measure underlines (rects are viewport-relative) for whichever field
  // type is active. One unified overlay path.
  if (overlayTarget && overlayIssues.length && overlayTarget.isConnected) {
    if (overlayTarget.tagName === 'INPUT' || overlayTarget.tagName === 'TEXTAREA') {
      renderInputUnderlines(overlayTarget, overlayIssues);
    } else {
      renderOverlayUnderlines(overlayTarget, overlayIssues);
    }
  }
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

  const headline =
    summarizeChange(issue.original, issue.suggestion) || getTypeLabel(issue.type);
  const diffHtml = renderInlineDiffHTML(issue.original, issue.suggestion);
  // Spelling/punctuation fixes are self-evident → collapse the rationale.
  // Clarity/style need persuading → show it.
  const whyOpen = issue.type === 'clarity' || issue.type === 'style';
  const showRephrase = issue.type === 'clarity' || issue.type === 'style';

  card.innerHTML = `
    <!-- Header: category chip + concise what's-wrong -->
    <div style="padding: 13px 16px 10px; border-bottom: 1px solid #f0f0f0;">
      <div style="display:flex; align-items:center; gap:7px; margin-bottom:5px;">
        <span style="width:7px;height:7px;border-radius:50%;background:${c.line};display:inline-block;"></span>
        <span style="font-size:11px;font-weight:700;color:${c.line};text-transform:uppercase;letter-spacing:0.5px;">${getTypeLabel(issue.type)}</span>
      </div>
      <div style="font-size:14px;font-weight:600;color:#1c1c1e;line-height:1.4;">
        ${escapeHtml(headline)}
      </div>
    </div>

    <!-- The single minimal-change line (click to accept) -->
    <div class="og-suggestion-click" style="
      padding: 12px 16px; background:#fafafa; cursor:pointer;
      transition:background 0.12s; border-bottom:1px solid #f0f0f0;
    ">
      <div style="font-size:14px; line-height:1.6; word-break:break-word;">
        ${diffHtml}
      </div>
      <div style="margin-top:6px;font-size:11px;color:#8e8e93;">Click to apply</div>
    </div>

    <!-- Why (collapsed for correctness, open for clarity/style) -->
    <details ${whyOpen ? 'open' : ''} style="border-bottom:1px solid #f0f0f0;">
      <summary style="padding:8px 16px;cursor:pointer;font-size:12px;color:#5f6368;font-weight:600;list-style:none;user-select:none;">Why?</summary>
      <div style="padding:0 16px 10px;font-size:13px;color:#3c3c43;line-height:1.5;">
        ${escapeHtml(issue.reason)}
      </div>
    </details>

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
        display: ${showRephrase ? 'flex' : 'none'}; align-items: center; justify-content: center; gap: 5px;
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
    suggClick.addEventListener('mouseenter', () => { suggClick.style.background = '#f0f0ff'; });
    suggClick.addEventListener('mouseleave', () => { suggClick.style.background = '#fafafa'; });
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
        chrome.storage.sync.get(['provider', 'model', 'backendUrl', 'customBaseUrl', 'ollamaUrl'], (r) => res(r as Record<string, string>))
      );
      const apiKey    = await getApiKey();
      const provider  = stored.provider  || 'groq';
      const model     = stored.model     || '';
      const backendUrl = stored.backendUrl || 'http://localhost:8787';
      const llmBaseUrl = provider === 'ollama'
        ? ((stored.ollamaUrl || 'http://localhost:11434').trim().replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1')
        : stored.customBaseUrl || undefined;

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
        body: JSON.stringify({ sentence: issue.original, goal, apiKey, provider, model, baseUrl: llmBaseUrl }),
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
  /** Whole-sentence original/corrected (LLM pivot path). */
  origText?: string;
  corrText?: string;
}

/** Split text into sentences, keeping each one's start offset. */
function splitSentences(s: string): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  const re = /[^.!?\n]*[.!?]+|\n+|[^.!?\n]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[0] === '') { re.lastIndex++; continue; }
    const seg = m[0];
    if (seg.trim().length === 0) continue;
    out.push({ start: m.index, end: m.index + seg.length, text: seg });
  }
  return out;
}

/**
 * Build review groups by diffing the original text against the LLM's
 * whole-text correction — one coherent rewrite, no offset-merging of
 * fragments. Pairs sentences by index; if the counts diverge (the model
 * merged/split sentences) it falls back to one whole-text group so we
 * never mis-pair and corrupt.
 */
function buildGroupsFromCorrection(original: string, corrected: string): SentenceGroup[] {
  const norm = (x: string) => x.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (norm(original) === norm(corrected)) return [];

  const o = splitSentences(original);
  const c = splitSentences(corrected);
  if (o.length === c.length && o.length > 0) {
    const groups: SentenceGroup[] = [];
    for (let i = 0; i < o.length; i++) {
      const ot = o[i]!.text.trim();
      const ct = c[i]!.text.trim();
      if (norm(ot) === norm(ct)) continue;
      groups.push({ start: o[i]!.start, end: o[i]!.end, issues: [], origText: ot, corrText: ct });
    }
    if (groups.length) return groups;
  }
  // Counts diverged → single whole-text group (still coherent).
  return [{ start: 0, end: original.length, issues: [], origText: original.trim(), corrText: corrected.trim() }];
}

/** Offline/no-LLM fallback: apply ONLY spelling fixes per sentence (safe,
 *  deterministic, single-word). Grammar needs the LLM, so it's left alone
 *  rather than risk the old fragment-merge garble. */
function buildSpellingOnlyGroups(text: string, allIssues: Issue[]): SentenceGroup[] {
  const spelling = allIssues.filter((i) => i.type === 'spelling' && !i.ignored);
  const base = getSentenceGroups(text, spelling);
  for (const g of base) {
    g.origText = text.slice(g.start, g.end).trim();
    let s = text.slice(g.start, g.end);
    for (const iss of [...g.issues].sort((a, b) => b.offset - a.offset)) {
      const rel = iss.offset - g.start;
      if (rel < 0 || rel + iss.length > s.length) continue;
      if (s.substr(rel, iss.length) !== iss.original) continue;
      s = s.slice(0, rel) + iss.suggestion + s.slice(rel + iss.length);
    }
    g.corrText = s.trim();
  }
  return base.filter((g) => g.origText !== g.corrText);
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

function showCheckingCard(element: HTMLElement) {
  uiActive = true;
  currentTooltip?.remove();
  injectStyles();
  const card = document.createElement('div');
  card.className = 'opengrammar-tooltip';
  card.style.cssText = `
    position: fixed; left:-9999px; top:-9999px; width: 300px;
    background:#fff; border-radius:12px; border:1px solid rgba(0,0,0,0.07);
    box-shadow:0 4px 32px rgba(0,0,0,0.14); z-index:2147483647;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    animation: og-fade-in 0.12s ease;
  `;
  card.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; padding:16px 18px;">
      <div style="width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#4F46E5;border-radius:50%;animation:og-spin 0.7s linear infinite;"></div>
      <span style="font-size:13px; color:#3c3c43;">Checking your writing…</span>
    </div>`;
  document.body.appendChild(card);
  const anchorEl = overlayTarget && overlayTarget.isConnected ? overlayTarget : element;
  placeFixedPanel(card, anchorEl.getBoundingClientRect(), 8);
  currentTooltip = card;
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

  // Quote-stripped source (length-preserving, so offsets still map to DOM).
  const text = stripQuotedBBCode(getFullText(element));

  // PIVOT: the corrected sentence comes from ONE coherent LLM rewrite of the
  // whole text (errors-only), then diffed — never an offset-merge of rule
  // fragments. Rule engine now only drives inline spelling underlines.
  if (!precomputed) {
    const proceed = (corrected: string, llm: boolean) => {
      const changed = (corrected || '').trim() !== text.trim();
      const g =
        llm && changed
          ? buildGroupsFromCorrection(text, corrected)
          : buildSpellingOnlyGroups(text, allIssues);
      if (g.length === 0) { hideTooltip(); return; }
      showSentenceReview(allIssues, element, 0, g);
    };
    const cached = correctionCache.get(text);
    if (cached !== undefined) { proceed(cached, cached.trim() !== text.trim()); return; }
    showCheckingCard(element);
    chrome.runtime.sendMessage({ type: 'CORRECT_TEXT', text }, (resp) => {
      const corrected = (resp && resp.corrected) || text;
      const llm = !!(resp && resp.llm);
      if (llm) correctionCache.set(text, corrected);
      proceed(corrected, llm);
    });
    return;
  }

  const groups = precomputed;
  if (groups.length === 0) { hideTooltip(); return; }
  const idx = Math.max(0, Math.min(groupIndex, groups.length - 1));
  const group = groups[idx]!;
  const total = groups.length;
  const isFirst = idx === 0;
  const isLast  = idx >= total - 1;

  const origText = (group.origText ?? text.slice(group.start, group.end)).trim();
  const corrText = (group.corrText ?? origText).trim();
  const diffNonEq = diffWords(origText, corrText).filter((o) => o.kind !== 'eq');
  const changeCount   = Math.max(1, Math.ceil(diffNonEq.length / 2));
  const totalFixes    = groups.length;
  const typeSummary   = summarizeChange(origText, corrText) || '';
  const originalHtml  = escapeHtml(origText);
  const correctedText = corrText;
  const changeListHtml = `<div style="font-size:13px; line-height:1.6; word-break:break-word;">${renderInlineDiffHTML(origText, corrText)}</div>`;

  const card = document.createElement('div');
  card.className = 'opengrammar-tooltip';
  card.style.cssText = `
    position: fixed;
    left: -9999px; top: -9999px;
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
      ">View the change${changeCount !== 1 ? 's' : ''}</summary>
      <div style="padding:2px 14px 10px;">${changeListHtml}</div>
    </details>

    <!-- Improve / tone rewrite (explicit button — never automatic) -->
    <div class="og-sr-improve" style="border-top:1px solid #f0f0f0; padding:9px 14px;">
      <button class="og-sr-improve-toggle" type="button" style="
        width:100%; display:flex; align-items:center; justify-content:center; gap:6px;
        background:#fff; border:1px solid #e5e5ea; border-radius:7px; padding:7px 10px;
        font-size:12px; font-weight:600; color:#4F46E5; cursor:pointer; font-family:inherit;
        transition:background 0.12s;
      ">✦ Improve sentence ▾</button>
      <div class="og-sr-improve-menu" style="display:none; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
      <div class="og-sr-improve-status" style="display:none; font-size:11px; color:#8e8e93; margin-top:7px; text-align:center;"></div>
    </div>

    <!-- Action buttons -->
    <div style="display:flex; border-top:1px solid #f0f0f0;">
      ${total > 1 ? `
      <button class="og-sr-fix-all" style="
        flex:1; padding:10px 8px;
        background:white; color:#4F46E5;
        border:none; border-right:1px solid #f0f0f0; cursor:pointer;
        font-size:11px; font-weight:700; line-height:1.35;
        font-family:inherit; transition:background 0.12s;
      ">Fix All<br><span style="font-weight:400; color:#8e8e93;">${totalFixes} sentence${totalFixes !== 1 ? 's' : ''}</span></button>` : ''}
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
    const ok = replaceSentence(element, origText, group.start, corrText);
    // Shift later groups by the length delta so their spans stay anchored.
    if (ok) {
      const delta = corrText.length - origText.length;
      if (delta !== 0) {
        for (let g = idx + 1; g < groups.length; g++) {
          groups[g]!.start += delta;
          groups[g]!.end += delta;
        }
      }
    }
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
      // Apply highest-offset first so earlier spans stay valid.
      const ordered = [...groups].sort((a, b) => b.start - a.start);
      for (const g of ordered) {
        replaceSentence(element, (g.origText ?? '').trim(), g.start, (g.corrText ?? '').trim());
      }
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

  // ── Improve: explicit, on-demand tone rewrite of THIS sentence ──────────
  // Whole-sentence LLM rewrite (the locked product model: tone/style is an
  // explicit button, never inline/automatic). Applied via the same
  // replaceSentence primitive as Accept.
  const improveToggle = card.querySelector('.og-sr-improve-toggle') as HTMLButtonElement | null;
  const improveMenu = card.querySelector('.og-sr-improve-menu') as HTMLElement | null;
  const improveStatus = card.querySelector('.og-sr-improve-status') as HTMLElement | null;
  if (improveToggle && improveMenu && improveStatus) {
    const TONES: [string, string][] = [
      ['polish', 'Polish'],
      ['formal', 'Formal'],
      ['professional', 'Professional'],
      ['concise', 'Concise'],
      ['detailed', 'Detailed'],
      ['friendly', 'Friendly'],
      ['casual', 'Casual'],
      ['persuasive', 'Persuasive'],
      ['neutral', 'Neutral'],
    ];
    for (const [tone, label] of TONES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.dataset.tone = tone;
      chip.textContent = label;
      chip.style.cssText = `
        flex:1 1 auto; min-width:72px; padding:6px 8px;
        background:#F5F3FF; color:#4F46E5; border:1px solid #DDD6FE;
        border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;
        font-family:inherit; transition:background 0.12s;
      `;
      chip.addEventListener('mouseenter', () => { chip.style.background = '#E0E7FF'; });
      chip.addEventListener('mouseleave', () => { chip.style.background = '#F5F3FF'; });
      improveMenu.appendChild(chip);
    }

    let improving = false;
    improveToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = improveMenu.style.display !== 'none';
      improveMenu.style.display = open ? 'none' : 'flex';
      improveToggle.textContent = open ? '✦ Improve sentence ▾' : '✦ Improve sentence ▴';
    });
    improveToggle.addEventListener('mouseenter', () => { improveToggle.style.background = '#f5f3ff'; });
    improveToggle.addEventListener('mouseleave', () => { improveToggle.style.background = '#fff'; });

    improveMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const chip = (e.target as HTMLElement).closest('[data-tone]') as HTMLElement | null;
      if (!chip || improving) return;
      const tone = chip.dataset.tone!;
      const label = chip.textContent || tone;
      improving = true;
      improveMenu.style.pointerEvents = 'none';
      improveMenu.style.opacity = '0.5';
      improveStatus.style.display = 'block';
      improveStatus.textContent = `Rewriting (${label})…`;
      chrome.runtime.sendMessage(
        { type: 'REWRITE_TEXT', text: origText, tone },
        (resp) => {
          const rewritten = resp && resp.rewritten ? String(resp.rewritten).trim() : '';
          if (!rewritten || rewritten === origText) {
            improving = false;
            improveMenu.style.pointerEvents = '';
            improveMenu.style.opacity = '';
            improveStatus.textContent =
              resp && resp.error ? 'Rewrite failed — check provider/API key.' : 'No change suggested.';
            return;
          }
          const ok = replaceSentence(element, origText, group.start, rewritten);
          improveStatus.textContent = ok ? 'Applied.' : 'Could not apply here.';
          if (ok) setTimeout(() => hideTooltip(), 250);
          else {
            improving = false;
            improveMenu.style.pointerEvents = '';
            improveMenu.style.opacity = '';
          }
        },
      );
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
  // Anchor the panel to the editor (not the viewport corner) so it sits
  // right by the text box; placeFixedPanel keeps it fully on-screen.
  const anchorEl = (overlayTarget && overlayTarget.isConnected ? overlayTarget : element);
  placeFixedPanel(card, anchorEl.getBoundingClientRect(), 8);
  currentTooltip = card;
}

/* ────────────────────────────────────────────────────────────
   INPUT / TEXTAREA MEASUREMENT MIRROR (geometry only — never visible,
   never recolors the field). Used by renderInputUnderlines().
──────────────────────────────────────────────────────────── */
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

  // One validated apply primitive for every field/editor type.
  applyFix(element, {
    original: issue.original,
    offset: issue.offset,
    length: issue.length,
    replacement: issue.suggestion,
  });
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
