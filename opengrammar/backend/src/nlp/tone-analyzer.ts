import type { WritingContext } from '../rules/context-filter.js';

/**
 * ════════════════════════════════════════════════════════
 *  Tone Analyzer — ToneAnalyzer
 *  Detects the emotional/professional tone of text.
 *  Rule-based Tier 1 (free, instant, no API).
 * ════════════════════════════════════════════════════════
 */

export interface ToneSignal {
  type: 'hedging' | 'passive_aggression' | 'apology_filler' | 'negativity' | 'formality_mismatch' | 'confidence_killer' | 'aggressive' | 'positive';
  phrase: string;
  offset: number;
  suggestion: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ToneResult {
  dominant: 'assertive' | 'uncertain' | 'formal' | 'informal' | 'negative' | 'aggressive' | 'friendly' | 'neutral';
  score: number;        // 0–100: 100 = very confident/clear
  signals: ToneSignal[];
  tips: string[];
}

// ─── Hedging words/phrases ───
const HEDGING_WORDS = [
  'maybe', 'perhaps', 'possibly', 'probably', 'apparently',
  'i think', 'i guess', 'i suppose', 'i believe', 'i feel like',
  'sort of', 'kind of', 'somewhat', 'rather', 'fairly',
  'might', 'could', 'may', 'seem', 'seems', 'seemed', 'appears',
  'it seems', 'it appears', 'it looks like',
  'if i understand correctly', 'correct me if i\'m wrong',
  'roughly', 'approximately', 'more or less', 'in a way', 'as it were',
];

// ─── Passive-aggressive phrases ───
const PASSIVE_AGGRESSION_PATTERNS = [
  /\bas (I|we) (said|mentioned|noted|indicated|pointed out|explained|stated)\b/i,
  /\bper my (last|previous|earlier|recent|prior)\b/i,
  /\bas per\b/i,
  /\bgoing forward\b/i,
  /\bnot sure if you (saw|noticed|read|received)\b/i,
  /\bjust (a (gentle|friendly|quick|small) )?(reminder|heads?[ -]?up|note|fyi)\b/i,
  /\bfriendly reminder\b/i,
  /\bhoping you (can|could|will|would|might)\b/i,
  /\bplease (do|kindly) advise\b/i,
];

// ─── Apology fillers (weakening phrases) ───
const APOLOGY_FILLER_PATTERNS = [
  /\bjust (wanted|checking|following|wondering|hoping|reaching)\b/i,
  /\bsorry (to (bother|bug|trouble|disturb)|for (the (inconvenience|trouble|delay|confusion)))\b/i,
  /\bif that'?s? (okay|alright|fine|good|acceptable|convenient)\b/i,
  /\bif (you) (don'?t|do) mind\b/i,
  /\bdoes that make sense\b/i,
  /\bif that makes sense\b/i,
  /\bam I making sense\b/i,
  /\bhope this (helps|is helpful|is okay|is fine|finds you well)\b/i,
  /\bjust (a|an) (idea|thought|suggestion|question)\b/i,
  /\bfeel free to\b/i,
  /\bwhenever you get a chance\b/i,
  /\bno rush (but|however|though|,)\b/i,
];

// ─── Confidence killers ───
const CONFIDENCE_KILLER_PATTERNS = [
  /\bhopefully\b/i,
  /\bthis (probably|might|may|could) (not )?(work|help|be|make)\b/i,
  /\bi (might be|could be|may be) wrong\b/i,
  /\bnot sure if\b/i,
  /\bnot 100% sure\b/i,
  /\bi'?m no expert\b/i,
  /\btake it (with a grain of salt|or leave it)\b/i,
  /\bdon'?t quote me\b/i,
  /\byou (may|might|could|can) disagree\b/i,
];

// ─── Informal/slang (flagged in formal contexts) ───
const INFORMAL_PATTERNS = [
  /\bgonna\b/i, /\bwanna\b/i, /\bgotta\b/i, /\bkinda\b/i, /\bsorta\b/i,
  /\byeah\b/i, /\bnope\b/i, /\byep\b/i, /\bbtw\b/i, /\bfyi\b/i,
  /\blol\b/i, /\bomg\b/i, /\bwtf\b/i, /\bidk\b/i, /\bimo\b/i,
  /\bidk\b/i, /\bimo\b/i, /\btbh\b/i, /\bngl\b/i, /\biykyk\b/i,
  /\bCHERRS?\b/i, /\bcheers\b/i,
];

// ─── Aggressive phrases ───
const AGGRESSIVE_PATTERNS = [
  /\byou (always|never|constantly|consistently|repeatedly) (fail|forget|ignore|miss|avoid|dismiss|neglect)\b/i,
  /\bthis is (unacceptable|ridiculous|absurd|outrageous|disgusting)\b/i,
  /\bI demand\b/i,
  /\byou (must|have to|need to) (immediately|now|right now|at once)\b/i,
  /\bwhy (haven'?t|hasn'?t|didn'?t|don'?t|won'?t) you\b/i,
  /\bI'?m (not happy|very (unhappy|upset|disappointed|frustrated|angry))\b/i,
];

function findInText(text: string, pattern: RegExp): { phrase: string; offset: number } | null {
  const match = text.match(pattern);
  if (!match || match.index === undefined) return null;
  return { phrase: match[0], offset: match.index };
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

/**
 * Analyze the tone of text based on rule signals.
 * Returns a ToneResult with detected signals and recommendations.
 */
export function analyzeTone(text: string, context?: WritingContext): ToneResult {
  const lowerText = text.toLowerCase();
  const signals: ToneSignal[] = [];
  const tips: string[] = [];

  // ─── Count hedging ───
  const hedgeCount = HEDGING_WORDS.filter((w) => lowerText.includes(w)).length;
  if (hedgeCount >= 2) {
    const firstHedge = HEDGING_WORDS.find((w) => lowerText.includes(w)) || '';
    const offset = lowerText.indexOf(firstHedge);
    signals.push({
      type: 'hedging',
      phrase: firstHedge,
      offset,
      suggestion: `Replace hedging language with direct statements. Instead of "${firstHedge}", use assertive phrasing.`,
      severity: hedgeCount >= 4 ? 'warning' : 'info',
    });
    tips.push(
      `Your text contains ${hedgeCount} hedging expressions. Try replacing "I think/maybe/perhaps" with direct statements for a more confident tone.`,
    );
  }

  // ─── Passive aggression ───
  for (const pattern of PASSIVE_AGGRESSION_PATTERNS) {
    const found = findInText(text, pattern);
    if (found) {
      signals.push({
        type: 'passive_aggression',
        phrase: found.phrase,
        offset: found.offset,
        suggestion: `"${found.phrase}" can sound passive-aggressive. Consider a more direct alternative.`,
        severity: 'warning',
      });
      tips.push('Avoid phrases that may sound passive-aggressive (e.g., "as I mentioned", "per my last email"). Be direct instead.');
      break; // one tip per category
    }
  }

  // ─── Apology fillers ───
  const apologyCount = countMatches(text, APOLOGY_FILLER_PATTERNS);
  if (apologyCount >= 1) {
    const found = APOLOGY_FILLER_PATTERNS.map((p) => findInText(text, p)).find(Boolean);
    if (found) {
      signals.push({
        type: 'apology_filler',
        phrase: found.phrase,
        offset: found.offset,
        suggestion: `Remove "${found.phrase}" — it weakens your message unnecessarily.`,
        severity: 'info',
      });
      tips.push('Apology fillers like "just wanted to", "sorry to bother", or "if that\'s okay" undermine your confidence. Remove them for a stronger message.');
    }
  }

  // ─── Confidence killers ───
  const confKillCount = countMatches(text, CONFIDENCE_KILLER_PATTERNS);
  if (confKillCount >= 1) {
    const found = CONFIDENCE_KILLER_PATTERNS.map((p) => findInText(text, p)).find(Boolean);
    if (found) {
      signals.push({
        type: 'confidence_killer',
        phrase: found.phrase,
        offset: found.offset,
        suggestion: `"${found.phrase}" undermines your authority. State your point directly.`,
        severity: 'info',
      });
    }
  }

  // ─── Negativity overload ───
  const negatives = (text.match(/\b(can'?t|won'?t|never|not|don'?t|doesn'?t|didn'?t|couldn'?t|wouldn'?t|shouldn'?t|haven'?t|hasn'?t|hadn'?t|no\s+one|nobody|nothing|nowhere|neither|nor)\b/gi) || []).length;
  if (negatives >= 4) {
    signals.push({
      type: 'negativity',
      phrase: `${negatives} negative expressions`,
      offset: 0,
      suggestion: 'Consider reframing some negative statements as positive alternatives.',
      severity: negatives >= 7 ? 'warning' : 'info',
    });
    tips.push(`Your text has ${negatives} negative expressions. Reframing some as positive ("...will work if..." instead of "...won't work unless...") creates a more constructive tone.`);
  }

  // ─── Formality mismatch (only flag in email/document context) ───
  if (context === 'email' || context === 'document' || !context) {
    const informalCount = countMatches(text, INFORMAL_PATTERNS);
    if (informalCount >= 1) {
      const found = INFORMAL_PATTERNS.map((p) => findInText(text, p)).find(Boolean);
      if (found) {
        signals.push({
          type: 'formality_mismatch',
          phrase: found.phrase,
          offset: found.offset,
          suggestion: `"${found.phrase}" is too informal for ${context === 'email' ? 'email' : 'formal writing'}. Use more formal language.`,
          severity: 'warning',
        });
        tips.push('Informal words or abbreviations detected. Consider using formal language in this context.');
      }
    }
  }

  // ─── Aggressive tone ───
  const aggressiveCount = countMatches(text, AGGRESSIVE_PATTERNS);
  if (aggressiveCount >= 1) {
    const found = AGGRESSIVE_PATTERNS.map((p) => findInText(text, p)).find(Boolean);
    if (found) {
      signals.push({
        type: 'aggressive',
        phrase: found.phrase,
        offset: found.offset,
        suggestion: `"${found.phrase}" sounds aggressive. Try a more constructive phrasing.`,
        severity: 'error',
      });
      tips.push('Your text may sound aggressive. Focus on the issue, not the person, and use collaborative language.');
    }
  }

  // ─── Determine dominant tone ───
  const dominant = determineDominantTone(signals, hedgeCount, negatives, aggressiveCount);

  // ─── Compute clarity score ───
  const score = computeScore(signals, hedgeCount, negatives, aggressiveCount);

  return { dominant, score, signals, tips };
}

function determineDominantTone(
  signals: ToneSignal[],
  hedgeCount: number,
  negatives: number,
  aggressiveCount: number,
): ToneResult['dominant'] {
  if (aggressiveCount >= 2) return 'aggressive';
  if (signals.some((s) => s.type === 'aggressive')) return 'aggressive';
  if (negatives >= 7) return 'negative';
  if (hedgeCount >= 4) return 'uncertain';
  if (signals.some((s) => s.type === 'formality_mismatch')) return 'informal';
  if (signals.some((s) => s.type === 'passive_aggression')) return 'aggressive';
  if (hedgeCount >= 2 || signals.some((s) => s.type === 'confidence_killer')) return 'uncertain';
  if (signals.length === 0) return 'assertive';
  return 'neutral';
}

function computeScore(
  signals: ToneSignal[],
  hedgeCount: number,
  negatives: number,
  aggressiveCount: number,
): number {
  let score = 100;
  score -= hedgeCount * 8;       // each hedge word -8 pts
  score -= negatives * 3;        // each negative -3 pts
  score -= aggressiveCount * 15; // aggressive is bad -15 pts
  score -= signals.filter((s) => s.severity === 'warning').length * 10;
  score -= signals.filter((s) => s.severity === 'error').length * 20;
  score -= signals.filter((s) => s.severity === 'info').length * 5;
  return Math.max(0, Math.min(100, score));
}
