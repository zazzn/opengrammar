/**
 * Minimal-change diff for correction cards.
 *
 * Why this exists: the card used to strike through the WHOLE original
 * sentence and print the WHOLE suggestion. For a one-comma fix that's
 * confusing noise (and for a no-op suggestion it strikes text identical
 * to the "fix"). This renders only the actual change with a few words of
 * context, the way Grammarly / MS Editor / Google Docs do.
 */

export type DiffOp = { kind: 'eq' | 'del' | 'ins'; text: string };

/** Tokenize keeping whitespace and each punctuation mark as its own token. */
function tokenize(s: string): string[] {
  return s.match(/\s+|[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*|[^\sA-Za-z0-9]/g) || [];
}

/** Normalize for "is this actually different?" — ignores cosmetic-only deltas. */
export function normalizeForCompare(s: string): string {
  return (s || '')
    .normalize('NFC')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True only if the suggestion is a real, actionable change. */
export function hasMeaningfulDiff(original: string, suggestion: string): boolean {
  if (suggestion == null || suggestion === '') return false;
  return normalizeForCompare(original) !== normalizeForCompare(suggestion);
}

/** LCS over a token array → diff ops. */
function lcsDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  // DP table of LCS lengths
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  const push = (kind: DiffOp['kind'], text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.kind === kind) last.text += text;
    else ops.push({ kind, text });
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('eq', a[i]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      push('del', a[i]!);
      i++;
    } else {
      push('ins', b[j]!);
      j++;
    }
  }
  while (i < n) push('del', a[i++]!);
  while (j < m) push('ins', b[j++]!);
  return ops;
}

/** Char-level diff used to refine a single replaced word (recieve→receive). */
function charDiff(a: string, b: string): DiffOp[] {
  return lcsDiff(a.split(''), b.split(''));
}

/**
 * Diff two strings at word granularity, refining lone word↔word
 * replacements down to character level so only changed letters light up.
 */
export function diffWords(original: string, suggestion: string): DiffOp[] {
  const ops = lcsDiff(tokenize(original), tokenize(suggestion));
  const refined: DiffOp[] = [];
  for (let k = 0; k < ops.length; k++) {
    const cur = ops[k]!;
    const next = ops[k + 1];
    if (
      cur.kind === 'del' &&
      next &&
      next.kind === 'ins' &&
      /^[A-Za-z0-9']+$/.test(cur.text.trim()) &&
      /^[A-Za-z0-9']+$/.test(next.text.trim()) &&
      cur.text.length <= 24 &&
      next.text.length <= 24
    ) {
      for (const op of charDiff(cur.text, next.text)) refined.push(op);
      k++; // consumed the paired ins
    } else {
      refined.push(cur);
    }
  }
  return refined;
}

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/** Trim long unchanged runs to a few words of context with an ellipsis. */
function truncateEq(text: string, side: 'lead' | 'mid' | 'trail'): string {
  const MAX = 36;
  if (text.length <= MAX) return text;
  if (side === 'lead') return '…' + text.slice(-MAX);
  if (side === 'trail') return text.slice(0, MAX) + '…';
  return text.slice(0, MAX / 2) + '…' + text.slice(-MAX / 2);
}

/**
 * Render the change as one inline line: struck red deletions, green
 * insertions, neutral (truncated) context. Punctuation insertions get a
 * subtle caret so a lone comma can't be missed.
 */
export function renderInlineDiffHTML(original: string, suggestion: string): string {
  const ops = diffWords(original, suggestion);
  const lastIdx = ops.length - 1;
  let html = '';
  ops.forEach((op, idx) => {
    if (op.kind === 'eq') {
      const side = idx === 0 ? 'lead' : idx === lastIdx ? 'trail' : 'mid';
      html += `<span style="color:#6b6b70;">${esc(truncateEq(op.text, side))}</span>`;
    } else if (op.kind === 'del') {
      html += `<span style="color:#b91c1c;background:#fee2e2;border-radius:3px;padding:0 2px;text-decoration:line-through;text-decoration-color:#ef4444;">${esc(op.text)}</span>`;
    } else {
      const punctOnly = /^[^\sA-Za-z0-9]+$/.test(op.text.trim());
      const caret = punctOnly
        ? '<span style="color:#059669;font-size:0.8em;vertical-align:-0.1em;">▾</span>'
        : '';
      html += `${caret}<span style="color:#065f46;background:#d1fae5;border-radius:3px;padding:0 2px;font-weight:700;">${esc(op.text)}</span>`;
    }
  });
  return html;
}

/**
 * A concise, imperative "what's wrong" headline derived from the diff,
 * so the card leads with the specific fix instead of a grammar lecture.
 * Returns null if no good summary (caller falls back to the rule reason).
 */
export function summarizeChange(original: string, suggestion: string): string | null {
  const ops = diffWords(original, suggestion).filter((o) => o.kind !== 'eq');
  if (ops.length === 0) return null;
  const ins = ops.filter((o) => o.kind === 'ins');
  const del = ops.filter((o) => o.kind === 'del');
  const insText = ins.map((o) => o.text).join('');
  const delText = del.map((o) => o.text).join('');

  const isPunct = (t: string) => /^[^\sA-Za-z0-9]+$/.test(t.trim());
  const NAMES: Record<string, string> = {
    ',': 'comma', '.': 'period', '?': 'question mark', '!': 'exclamation mark',
    ';': 'semicolon', ':': 'colon', "'": 'apostrophe', '"': 'quotation mark',
    '-': 'hyphen', '—': 'dash',
  };

  // Pure punctuation insertion (the reported case: missing comma)
  if (del.length === 0 && ins.length && isPunct(insText)) {
    const name = NAMES[insText.trim()] || 'punctuation';
    return `Add a ${name}`;
  }
  // Pure punctuation deletion
  if (ins.length === 0 && del.length && isPunct(delText)) {
    const name = NAMES[delText.trim()] || 'punctuation';
    return `Remove the extra ${name}`;
  }
  // Apostrophe added inside a word (dont → don't)
  if (ins.length && insText.replace(/[^']/g, '') && /^[A-Za-z']+$/.test(insText)) {
    return 'Missing apostrophe';
  }
  // Capitalization-only
  if (
    del.length &&
    ins.length &&
    delText.toLowerCase() === insText.toLowerCase()
  ) {
    return 'Fix capitalization';
  }
  // Single word swap
  if (del.length === 1 && ins.length === 1 && !/\s/.test(delText) && !/\s/.test(insText)) {
    return `Replace “${delText}” with “${insText}”`;
  }
  return null;
}
