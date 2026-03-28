import type { IgnoredIssue, Issue } from '../types';

let currentTooltip: HTMLElement | null = null;
let currentRephrasePanel: HTMLElement | null = null;
let highlightContainer: HTMLElement | null = null;
let assistantBubble: HTMLElement | null = null;
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

  issues.forEach((issue, idx) => {
    if (issue.ignored) return;
    try { wrapTextWithHighlight(element, issue, idx); }
    catch (e) { console.debug('Highlight failed:', e); }
  });
}

function wrapTextWithHighlight(root: HTMLElement, issue: Issue, issueIndex: number) {
  const textNodes: Node[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node);

  let charCount = 0;
  const c = getC(issue.type);

  for (const textNode of textNodes) {
    const nodeLength = textNode.textContent?.length || 0;
    const nodeStart = charCount;
    const nodeEnd = charCount + nodeLength;

    if (issue.offset < nodeEnd && issue.offset + issue.length > nodeStart) {
      const startInNode = Math.max(0, issue.offset - nodeStart);
      const endInNode   = Math.min(nodeLength, issue.offset + issue.length - nodeStart);

      if (startInNode < endInNode && textNode.parentNode) {
        const makeSpan = (): HTMLElement => {
          const span = document.createElement('span');
          span.className = 'opengrammar-highlight';
          span.style.cssText = `
            background: ${c.bg};
            border-bottom: 2px wavy ${c.line};
            cursor: pointer;
            padding-bottom: 1px;
            border-radius: 2px;
            transition: background 0.1s;
          `;
          span.dataset.issue = JSON.stringify(issue);
          span.dataset.index = issueIndex.toString();
          span.addEventListener('mouseenter', () => { span.style.background = c.hover; });
          span.addEventListener('mouseleave', () => { span.style.background = c.bg; });
          span.addEventListener('click', (e) => {
            e.stopPropagation(); e.preventDefault();
            showTooltip(span, issue, root);
          });
          return span;
        };

        try {
          const range = document.createRange();
          range.setStart(textNode, startInNode);
          range.setEnd(textNode, endInNode);
          const span = makeSpan();
          range.surroundContents(span);
        } catch {
          const text = textNode.textContent || '';
          const parent = textNode.parentNode;
          if (parent) {
            const frag = document.createDocumentFragment();
            if (text.substring(0, startInNode)) frag.appendChild(document.createTextNode(text.substring(0, startInNode)));
            const span = makeSpan();
            span.textContent = text.substring(startInNode, endInNode);
            frag.appendChild(span);
            if (text.substring(endInNode)) frag.appendChild(document.createTextNode(text.substring(endInNode)));
            parent.replaceChild(frag, textNode);
          }
        }
      }
    }
    charCount = nodeEnd;
  }
}

export function clearHighlights() {
  document.querySelectorAll('.opengrammar-highlight, .opengrammar-success').forEach((el) => {
    const parent = el.parentNode;
    if (parent) { parent.replaceChild(document.createTextNode(el.textContent || ''), el); parent.normalize(); }
  });
  document.querySelectorAll('.opengrammar-badge').forEach((el) => el.remove());
  destroyInputMirror();
  assistantBubble?.remove(); assistantBubble = null;
  currentTooltip?.remove(); currentTooltip = null;
  currentRephrasePanel?.remove(); currentRephrasePanel = null;
  uiActive = false;
}

export function refreshFloatingDecorations() {
  if (inputMirrorOverlay && inputMirrorTarget) positionInputMirror(inputMirrorTarget);
  if (inputMirrorContent && inputMirrorTarget) syncInputMirrorScroll(inputMirrorTarget);
  document.querySelectorAll('.opengrammar-badge').forEach((badge) => {
    if (!inputMirrorTarget) return;
    const rect = inputMirrorTarget.getBoundingClientRect();
    (badge as HTMLElement).style.left = `${rect.right - 35}px`;
    (badge as HTMLElement).style.top  = `${rect.top + 5}px`;
  });
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
    right: 24px; bottom: 24px;
    display: inline-flex; align-items: center; justify-content: center;
    width: 52px; height: 52px; padding: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
    box-shadow: 0 2px 14px rgba(79,70,229,0.45), 0 1px 4px rgba(0,0,0,0.12);
    z-index: 2147483646;
    cursor: pointer; pointer-events: auto;
    border: none; outline: none;
    transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s ease;
  `;

  const hasErrors = issues.some(i => i.type === 'grammar' || i.type === 'spelling');
  const badgeBg = hasErrors ? '#e53935' : '#f59e0b';

  bubble.innerHTML = `
    <span style="position:relative;display:flex;align-items:center;justify-content:center;">
      <!-- Quill pen icon — OpenGrammar brand -->
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M20 4C15 4 10 7 8 12L4 20l8-4c5-2 8-7 8-12z"
          fill="white" opacity="0.92"/>
        <path d="M8 12 L4 20" stroke="rgba(255,255,255,0.55)" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M5 18l2 2 4-5" stroke="white" stroke-width="1.6"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span style="
        position:absolute; top:-5px; right:-7px;
        min-width:18px; height:18px; padding:0 4px;
        border-radius:999px; background:${badgeBg}; color:white;
        font-size:10px; font-weight:700;
        display:inline-flex; align-items:center; justify-content:center;
        border:2px solid white;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        box-shadow:0 1px 4px rgba(0,0,0,0.25);
      ">${issues.length}</span>
    </span>
  `;

  bubble.addEventListener('mouseenter', () => {
    bubble.style.transform = 'scale(1.1)';
    bubble.style.boxShadow = '0 4px 20px rgba(79,70,229,0.6), 0 2px 8px rgba(0,0,0,0.15)';
  });
  bubble.addEventListener('mouseleave', () => {
    bubble.style.transform = 'scale(1)';
    bubble.style.boxShadow = '0 2px 12px rgba(79,70,229,0.5), 0 1px 4px rgba(0,0,0,0.12)';
  });
  bubble.addEventListener('mousedown', (e) => e.preventDefault());
  bubble.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      showIssuePanel(bubble, issues, element, 0, () => undefined);
      return;
    }
    const first = document.querySelector('.opengrammar-highlight') as HTMLElement | null;
    if (first) showTooltip(first, issues[0]!, element);
  });

  document.body.appendChild(bubble);
  assistantBubble = bubble;
}

/* ────────────────────────────────────────────────────────────
   GRAMMARLY-STYLE TOOLTIP CARD (inline highlight → click)
──────────────────────────────────────────────────────────── */
function showTooltip(anchor: HTMLElement, issue: Issue, element: HTMLElement) {
  uiActive = true;
  currentTooltip?.remove();
  currentRephrasePanel?.remove();
  currentRephrasePanel = null;

  const anchorRect = anchor.getBoundingClientRect();
  const c = getC(issue.type);

  // Smart positioning: below anchor by default, flip if too close to bottom
  let top = anchorRect.bottom + window.scrollY + 8;
  if (top + 300 > window.innerHeight + window.scrollY)
    top = anchorRect.top + window.scrollY - 310;
  const left = Math.max(12, Math.min(anchorRect.left + window.scrollX - 8, window.innerWidth - 346));

  const card = document.createElement('div');
  card.className = 'opengrammar-tooltip';
  card.style.cssText = `
    position: absolute;
    left: ${left}px; top: ${top}px;
    width: 334px;
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
    showRephrasePanel(card, issue, element);
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
  currentTooltip = card;
}

/* ────────────────────────────────────────────────────────────
   REPHRASE PANEL (slides below tooltip card)
──────────────────────────────────────────────────────────── */
function showRephrasePanel(tooltipCard: HTMLElement, issue: Issue, element: HTMLElement) {
  currentRephrasePanel?.remove();

  const cardRect  = tooltipCard.getBoundingClientRect();
  const panel     = document.createElement('div');
  panel.className = 'opengrammar-rephrase-panel';
  panel.style.cssText = `
    position: absolute;
    left: ${cardRect.left + window.scrollX}px;
    top: ${cardRect.bottom + window.scrollY + 6}px;
    width: 334px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.14), 0 1px 6px rgba(0,0,0,0.07);
    border: 1px solid rgba(0,0,0,0.07);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
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
            applySuggestion(element, { ...issue, original: issue.original, suggestion: text }, anchor as HTMLElement);
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

    } catch (err) {
      content.innerHTML = `
        <div style="padding:16px;text-align:center;font-size:13px;color:#dc2626;">
          Failed to get suggestions. Check your API key and backend connection.
        </div>
      `;
    }
  }

  // anchor reference for use button
  const anchor = document.querySelector('.opengrammar-tooltip') as HTMLElement;
}

function decodeHtmlEntities(str: string): string {
  const d = document.createElement('div');
  d.innerHTML = str;
  return d.textContent || '';
}

/* ────────────────────────────────────────────────────────────
   ISSUE PANEL (for input/textarea badge)
   Grammarly-style: nav arrows + same card design
──────────────────────────────────────────────────────────── */
function showIssuePanel(
  anchor: HTMLElement,
  issues: Issue[],
  element: HTMLElement,
  currentIndex: number,
  onIndexChange: (n: number) => void,
) {
  uiActive = true;
  currentTooltip?.remove();

  const issue      = issues[currentIndex]!;
  const anchorRect = anchor.getBoundingClientRect();
  const c          = getC(issue.type);

  const panel = document.createElement('div');
  panel.className = 'opengrammar-tooltip';

  let top = anchorRect.bottom + 10;
  if (top + 300 > window.innerHeight) top = anchorRect.top - 310;

  panel.style.cssText = `
    position: fixed;
    left: ${Math.max(10, Math.min(anchorRect.left - 140, window.innerWidth - 346))}px;
    top: ${top}px;
    width: 334px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.14), 0 1px 6px rgba(0,0,0,0.07);
    border: 1px solid rgba(0,0,0,0.07);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px; overflow: hidden;
    animation: og-fade-in 0.12s ease;
  `;

  const hasMultiple = issues.length > 1;

  panel.innerHTML = `
    <!-- Navigation bar -->
    <div style="
      display:flex; align-items:center; justify-content:space-between;
      padding: 10px 14px;
      background: #fafafa;
      border-bottom: 1px solid #f0f0f0;
    ">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="
          display:inline-flex;align-items:center;justify-content:center;
          width:8px;height:8px;border-radius:50%;background:${c.line};
          flex-shrink:0;
        "></span>
        <span style="font-size:13px;font-weight:600;color:#1c1c1e;">
          ${issues.length} suggestion${issues.length !== 1 ? 's' : ''}
        </span>
      </div>
      ${hasMultiple ? `
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="og-prev-btn" style="
          width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          background:white;border:1px solid #e5e5ea;border-radius:7px;
          cursor:${currentIndex === 0 ? 'default' : 'pointer'};
          opacity:${currentIndex === 0 ? '0.35' : '1'};
          font-size:16px;color:#3c3c43;transition:background 0.1s;
        ">‹</button>
        <span style="font-size:12px;color:#8e8e93;min-width:30px;text-align:center;">
          ${currentIndex + 1}/${issues.length}
        </span>
        <button class="og-next-btn" style="
          width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          background:white;border:1px solid #e5e5ea;border-radius:7px;
          cursor:${currentIndex >= issues.length - 1 ? 'default' : 'pointer'};
          opacity:${currentIndex >= issues.length - 1 ? '0.35' : '1'};
          font-size:16px;color:#3c3c43;transition:background 0.1s;
        ">›</button>
      </div>` : ''}
    </div>

    <!-- Issue body -->
    <div style="padding: 11px 14px 9px; border-bottom: 1px solid #f0f0f0;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:600;color:${c.line};text-transform:uppercase;letter-spacing:0.5px;">
          ${getTypeLabel(issue.type)}
        </span>
        <span style="width:3px;height:3px;border-radius:50%;background:#ccc;display:inline-block;"></span>
        <span style="font-size:12px;color:#8e8e93;">${getCategoryLabel(issue.type)}</span>
      </div>
      <p style="margin:0;font-size:13px;color:#3c3c43;line-height:1.5;">${escapeHtml(issue.reason)}</p>
    </div>

    <!-- Diff -->
    <div style="padding: 11px 14px; background:#fafafa; display:flex;flex-direction:column;gap:7px;">
      <div style="
        display:flex;align-items:flex-start;gap:8px;
        background:#fff0f0;border-radius:7px;padding:8px 10px;
        border-left:3px solid #e53935;
      ">
        <span style="font-size:14px;color:#b91c1c;text-decoration:line-through;word-break:break-word;line-height:1.4;">
          ${escapeHtml(issue.original)}
        </span>
      </div>
      <div style="display:flex;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M4 10l4 4 4-4" stroke="#aaa" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="og-suggestion-click" style="
        display:flex;align-items:flex-start;gap:8px;
        background:#EEF2FF;border-radius:7px;padding:8px 10px;
        border-left:3px solid #4F46E5;
        cursor:pointer;transition:background 0.12s;
      ">
        <span style="font-size:14px;color:#3730A3;font-weight:600;word-break:break-word;line-height:1.4;">
          ${escapeHtml(issue.suggestion)}
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div style="display:flex;border-top:1px solid #f0f0f0;">
      <button class="og-apply-btn" style="
        flex:1;padding:11px 16px;
        background:#4F46E5;color:white;
        border:none;cursor:pointer;
        font-size:13px;font-weight:600;
        border-radius:0 0 0 12px;
        font-family:inherit;
        transition:background 0.12s;
        display:flex;align-items:center;justify-content:center;gap:5px;
      ">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="white">
          <path d="M6.5 11.5L2.5 7.5l1.06-1.06 2.94 2.93 5.94-5.93 1.06 1.06z"/>
        </svg>
        Accept
      </button>
      <button class="og-ignore-btn" style="
        flex:1;padding:11px 16px;
        background:white;color:#5f6368;
        border:none;border-left:1px solid #f0f0f0;
        cursor:pointer;font-size:13px;font-weight:500;
        border-radius:0 0 12px 0;
        font-family:inherit;transition:background 0.12s;
      ">Dismiss</button>
    </div>
  `;

  panel.addEventListener('mousedown', (e) => e.preventDefault());

  const applyBtn  = panel.querySelector('.og-apply-btn') as HTMLButtonElement;
  const ignoreBtn = panel.querySelector('.og-ignore-btn') as HTMLButtonElement;
  const suggClick = panel.querySelector('.og-suggestion-click') as HTMLElement;

  if (suggClick) {
    suggClick.addEventListener('click', (e) => { e.stopPropagation(); applySuggestion(element, issue, anchor); hideTooltip(); });
    suggClick.addEventListener('mouseenter', () => { suggClick.style.background = '#E0E7FF'; });
    suggClick.addEventListener('mouseleave', () => { suggClick.style.background = '#EEF2FF'; });
  }
  applyBtn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); applySuggestion(element, issue, anchor); hideTooltip(); });
  applyBtn.addEventListener('mouseenter', () => { applyBtn.style.background = '#4338CA'; });
  applyBtn.addEventListener('mouseleave', () => { applyBtn.style.background = '#4F46E5'; });

  ignoreBtn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); ignoreIssue(issue, anchor); hideTooltip(); });
  ignoreBtn.addEventListener('mouseenter', () => { ignoreBtn.style.background = '#f8f9fa'; });
  ignoreBtn.addEventListener('mouseleave', () => { ignoreBtn.style.background = 'white'; });

  if (hasMultiple) {
    const prevBtn = panel.querySelector('.og-prev-btn') as HTMLButtonElement | null;
    const nextBtn = panel.querySelector('.og-next-btn') as HTMLButtonElement | null;
    if (prevBtn && currentIndex > 0) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ni = currentIndex - 1;
        onIndexChange(ni);
        showIssuePanel(anchor, issues, element, ni, onIndexChange);
      });
    }
    if (nextBtn && currentIndex < issues.length - 1) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ni = currentIndex + 1;
        onIndexChange(ni);
        showIssuePanel(anchor, issues, element, ni, onIndexChange);
      });
    }
  }

  const closeOnOutsideClick = (e: MouseEvent) => {
    if (!panel.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
      hideTooltip();
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 100);

  document.body.appendChild(panel);
  currentTooltip = panel;
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
  let currentIssueIndex = 0;

  badge.addEventListener('mouseenter', () => { badge.style.transform = 'scale(1.12)'; });
  badge.addEventListener('mouseleave', () => { badge.style.transform = 'scale(1)'; });
  badge.addEventListener('mousedown', (e) => e.preventDefault());
  badge.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault();
    if (issues.length > 0) {
      showIssuePanel(badge, issues, element, currentIssueIndex, (ni) => { currentIssueIndex = ni; });
    }
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
    input.value = text.substring(0, issue.offset) + issue.suggestion + text.substring(issue.offset + issue.length);
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (element.isContentEditable) {
    const textNode = document.createTextNode(issue.suggestion);
    if (highlightEl.parentNode) {
      highlightEl.parentNode.replaceChild(textNode, highlightEl);
      textNode.parentNode?.normalize();
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
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

  if (highlightEl.classList.contains('opengrammar-highlight')) {
    const parent = highlightEl.parentNode;
    if (parent) { parent.replaceChild(document.createTextNode(highlightEl.textContent || ''), highlightEl); parent.normalize(); }
  }
  if (highlightEl.classList.contains('opengrammar-badge')) highlightEl.remove();
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
