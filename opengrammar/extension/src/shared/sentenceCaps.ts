// Pure, platform-agnostic sentence-start capitalization detector.
//
// Direct port of the DESKTOP engine's `sentence_cap_positions`,
// `preceded_by_non_boundary`, and `SENTENCE_CAP_SKIP`
// (desktop/ograms-engine/src/harper_engine.rs). Parity is the whole point:
// Harper only flags the FIRST sentence (+ the pronoun "i"); 2nd+ sentences
// after `. ! ?` go unflagged. This finds the first lowercase letter of each
// sentence (text start, and after `. ! ?` + whitespace) that should be
// capitalized, skipping single-letter tokens before the dot (initials / e.g /
// i.e / U.S), known mid-sentence abbreviations, and decimals (`3.14`, no space
// after the dot).
//
// NO chrome / DOM deps (`import type` only) so the same detector can run in the
// live content pipeline AND headlessly in tests.
import type { Issue } from '../types';

/** Lowercase abbreviations after which the next word should NOT be capitalized
 *  (mid-sentence connectors). Titles like Dr./Mr. are intentionally absent — the
 *  word after them is usually a name that SHOULD be capitalized. */
const SENTENCE_CAP_SKIP = ['etc', 'vs', 'al', 'ie', 'eg'];

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

function isAsciiLowercase(ch: string): boolean {
  return ch >= 'a' && ch <= 'z';
}

function isAsciiAlphabetic(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

/**
 * True if the boundary before `start` is an abbreviation / initial, not a real
 * sentence end — so the following word must NOT be capitalized. Mirrors the
 * Rust `preceded_by_non_boundary`.
 */
function precededByNonBoundary(source: string, start: number): boolean {
  let j = start;
  while (j > 0 && isWhitespace(source[j - 1])) {
    j -= 1;
  }
  if (j === 0) {
    return false; // start of text — a genuine sentence start
  }
  while (j > 0 && (source[j - 1] === '.' || source[j - 1] === '!' || source[j - 1] === '?')) {
    j -= 1;
  }
  let word = '';
  let k = j;
  while (k > 0 && isAsciiAlphabetic(source[k - 1])) {
    word = source[k - 1].toLowerCase() + word;
    k -= 1;
  }
  if (word.length <= 1) {
    return true; // single letter: initial (J.) or e.g / i.e / U.S style
  }
  return SENTENCE_CAP_SKIP.includes(word);
}

/**
 * Indices into `text` of sentence-initial LOWERCASE letters that should be
 * capitalized: the first letter of the text, and the first letter after a
 * `. ! ?` followed by whitespace. Returns [index, uppercaseChar]. Conservative:
 * a boundary whose preceding token is a single letter (initials / e.g / i.e /
 * U.S) or a known mid-sentence abbreviation is skipped, and `3.14` never
 * triggers (no space after dot). Mirrors the Rust `sentence_cap_positions`.
 */
function sentenceCapPositions(text: string): Array<[number, string]> {
  const n = text.length;
  const out: Array<[number, string]> = [];
  let atSentenceStart = true;
  let idx = 0;
  while (idx < n) {
    const c = text[idx];
    if (atSentenceStart && !isWhitespace(c)) {
      if (isAsciiLowercase(c) && !precededByNonBoundary(text, idx)) {
        out.push([idx, c.toUpperCase()]);
      }
      atSentenceStart = false;
    }
    if (
      (c === '.' || c === '!' || c === '?') &&
      idx + 1 < n &&
      isWhitespace(text[idx + 1])
    ) {
      atSentenceStart = true;
    }
    idx += 1;
  }
  return out;
}

/**
 * Emit a quick-fix Issue for each sentence-initial lowercase letter that should
 * be capitalized (the desktop's mid-sentence cap detector, ported). Pure &
 * synchronous; offsets index into `text`.
 */
export function findSentenceCapitalizations(text: string): Issue[] {
  const out: Issue[] = [];
  for (const [idx, upper] of sentenceCapPositions(text)) {
    out.push({
      type: 'grammar',
      original: text[idx],
      suggestion: upper,
      offset: idx,
      length: 1,
      reason: 'This sentence does not start with a capital letter.',
      route: 'quick-fix',
      source: 'rule',
    });
  }
  return out;
}
