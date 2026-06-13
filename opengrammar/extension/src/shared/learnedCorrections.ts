// Pure, platform-agnostic core of the LLM-taught "learned corrections" store.
//
// NO chrome / DOM deps (only `import type`) so the SAME matcher drives the live
// content pipeline, the background, and the self-learning benchmark
// (scripts/bench-selflearn.mjs). This is the "Option A" learning loop: when the
// proactive LLM makes a high-conviction correction the local engine missed, we
// remember original->suggestion here; afterwards the LOCAL engine applies it
// instantly (offline, no LLM round-trip) — so the tool self-improves on exactly
// the mistakes the LLM taught it. Mirrored in Rust for the desktop app.
import type { Issue } from '../types';

/** Token = a word, possibly with internal apostrophes/hyphens (don't, well-known). */
const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;

/** ONE shared normalizer (ASCII-lower + strip anything but letters/apostrophe), so
 *  the JS and Rust sides key the store identically — their Unicode casefolding
 *  differs, and ASCII-only keeps them in lockstep. */
export function normalizeLearnKey(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, '');
}

/** normalized original -> the learned replacement (surface form, e.g. "received"). */
export type LearnedMap = Map<string, string>;

/** Carry the surface word's leading capital onto the replacement so a learned
 *  lowercase target doesn't de-capitalize a sentence-initial word: "Recieved"
 *  would otherwise become "received"; we emit "Received". */
function matchLeadingCase(surface: string, target: string): string {
  const c = surface[0];
  if (c && c === c.toUpperCase() && c !== c.toLowerCase() && target) {
    return target[0]!.toUpperCase() + target.slice(1);
  }
  return target;
}

/**
 * Scan `text` for word tokens that have a learned correction and emit a quick-fix
 * Issue for each occurrence whose surface form actually differs from the
 * (case-matched) target. Pure & synchronous; offsets index into `text`.
 */
export function findLearnedCorrections(text: string, learned: LearnedMap): Issue[] {
  if (learned.size === 0) return [];
  const out: Issue[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const surface = m[0];
    const raw = learned.get(normalizeLearnKey(surface));
    if (!raw) continue;
    const target = matchLeadingCase(surface, raw);
    if (target === surface) continue;
    const offset = m.index ?? 0;
    out.push({
      id: `learned-${offset}-${surface}-${target}`,
      type: 'spelling',
      original: surface,
      suggestion: target,
      reason: `Learned correction: ${surface} → ${target}.`,
      offset,
      length: surface.length,
      confidence: 0.97,
      priority: 2,
      source: 'learned',
      route: 'quick-fix',
      routeReason: 'learned from a prior LLM correction',
    });
  }
  return out;
}
