import type { Issue } from '../types';

type Route = NonNullable<Issue['route']>;

const LOW_CONTEXT_SHORT_WORD_MAX = 3;
// Minimum character-retention (charOverlap) for a non-transposition edit to be
// eligible for the destructive one-click quick-fix route. Sits below every
// verified real typo (≥0.83) and above every verified jargon/name/brand
// false-positive (≤0.80), so it cleanly separates the two.
const QUICKFIX_OVERLAP_MIN = 0.82;
const HIGH_CONFIDENCE_OVERRIDES = new Set(['address', 'had', 'the']);
const CONTRACTION_LIKE_TYPOS = /^(?:dont|doesnt|didnt|isnt|arent|wasnt|werent|cant|couldnt|shouldnt|wouldnt|wont|havent|havnt|hasnt|hadnt|im|ive|id|ill|youre|youve|youll|theyre|theyve|theyll|thats|whats|lets)$/i;

function bare(text: string): string {
  return text.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function isPlainWord(text: string): boolean {
  return /^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(text);
}

function sortedChars(text: string): string {
  return [...text.toLowerCase()].sort().join('');
}

function longestCommonSubsequence(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = new Array(n + 1).fill(0);
  let cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, cur[j - 1]!);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n]!;
}

// Character-retention ratio (longest common subsequence over the longer word).
// A genuine typo keeps almost all of its letters in order (recieved→received
// ≈ 0.88, gramar→grammar ≈ 0.86); an unknown token "fixed" to an unrelated real
// word does not (kubelet→sublet ≈ 0.71, cheque→cheese ≈ 0.67, Niamh→Name = 0.6).
function charOverlap(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (!x || !y) return 0;
  return longestCommonSubsequence(x, y) / Math.max(x.length, y.length);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n]!;
}

// All candidate replacements for a spelling issue, best-first: the chosen
// suggestion followed by any "Other suggestions: …" parsed out of the reason.
function spellingOptions(issue: Issue): string[] {
  const options: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const option = raw.trim();
    if (!option || option === issue.original) return;
    const key = option.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(option);
  };
  if (issue.suggestion) add(issue.suggestion);
  const m = /Other suggestions?:\s*([^.]+)/i.exec(issue.reason || '');
  if (m?.[1]) for (const option of m[1].split(',')) add(option);
  return options;
}

function spellingOptionCount(issue: Issue): number {
  return spellingOptions(issue).length;
}

function isPunctuationOrCaseOnly(issue: Issue): boolean {
  const o = issue.original || '';
  const s = issue.suggestion || '';
  return !!s && o !== s && bare(o) === bare(s);
}

function isHighConfidenceSpelling(issue: Issue): boolean {
  const original = (issue.original || '').trim();
  const suggestion = (issue.suggestion || '').trim();
  if (!original || !suggestion || original === suggestion) return false;
  if (!isPlainWord(original) || !isPlainWord(suggestion)) return false;
  if (/^[A-Z0-9]{2,}$/.test(original)) return false;

  const distance = levenshtein(original.toLowerCase(), suggestion.toLowerCase());
  if (
    HIGH_CONFIDENCE_OVERRIDES.has(suggestion.toLowerCase()) &&
    original.length >= LOW_CONTEXT_SHORT_WORD_MAX &&
    distance <= 2
  ) {
    return true;
  }
  if (original.length <= LOW_CONTEXT_SHORT_WORD_MAX) return false;
  if (CONTRACTION_LIKE_TYPOS.test(original) && !suggestion.includes("'")) return false;
  if (CONTRACTION_LIKE_TYPOS.test(original) && suggestion.includes("'") && distance <= 1) {
    return true;
  }
  const transposition = sortedChars(original) === sortedChars(suggestion);
  const optionCount = spellingOptionCount(issue);

  // A transposition/anagram is the cheapest, most common real typo (recieved,
  // borwn, teh): trust it and skip the guards below. For every other edit, gate
  // the destructive quick-fix route on signals that separate a genuine typo
  // from an unknown word (name/brand/jargon) being rewritten to an unrelated
  // real word — those belong in non-destructive sentence review, not one-click.
  if (!transposition) {
    // Capitalized token whose fix changes more than case ⇒ unknown proper noun
    // (Niamh→Name, Okafor→Orator, Supabase→Separate, Caddyfile→Caddie).
    if (/^[A-Z][a-z]+$/.test(original) && bare(original) !== bare(suggestion)) {
      return false;
    }
    // Too few shared characters ⇒ unrelated real word, not a spelling fix
    // (kubelet→sublet, fsync→franc, cheque→cheese, autoscaler→automaker).
    if (charOverlap(original, suggestion) < QUICKFIX_OVERLAP_MIN) {
      return false;
    }
    // A rival candidate at least as close to the original as the chosen one ⇒
    // the top pick is a guess (mergd→merge vs merged, reviewd→review vs
    // reviewed): route to sentence review rather than auto-applying.
    if (
      optionCount > 1 &&
      spellingOptions(issue)
        .slice(1)
        .some((o) => levenshtein(original.toLowerCase(), o.toLowerCase()) <= distance)
    ) {
      return false;
    }
  }

  if (transposition && original.length >= 5) return true;
  if (distance <= 2 && original.length >= 5) return true;
  if (distance <= 3 && original.length >= 7 && optionCount <= 3) return true;
  return false;
}

function routeIssue(issue: Issue): { route: Route; reason: string; confidence?: number } {
  if (!issue.suggestion || issue.suggestion === issue.original) {
    return { route: 'suppress', reason: 'no actionable replacement', confidence: 0 };
  }

  if (issue.type === 'spelling') {
    if (isHighConfidenceSpelling(issue)) {
      return { route: 'quick-fix', reason: 'high-confidence local spelling fix', confidence: 0.96 };
    }
    return { route: 'sentence-review', reason: 'spelling needs sentence context', confidence: 0.55 };
  }

  if (issue.type === 'grammar') {
    if (isPunctuationOrCaseOnly(issue)) {
      return { route: 'quick-fix', reason: 'mechanical punctuation/case fix', confidence: 0.94 };
    }
    return { route: 'sentence-review', reason: 'grammar needs sentence context', confidence: 0.65 };
  }

  return { route: 'sentence-review', reason: 'clarity/style belongs in sentence review', confidence: 0.5 };
}

export function applyIssuePolicy(issues: Issue[]): Issue[] {
  return issues
    .map((issue) => {
      const policy = routeIssue(issue);
      return {
        ...issue,
        route: policy.route,
        routeReason: policy.reason,
        confidence: policy.confidence ?? issue.confidence,
      };
    })
    .filter((issue) => issue.route !== 'suppress');
}
