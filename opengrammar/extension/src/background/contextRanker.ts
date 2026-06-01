// Background-SW glue for the inline context re-ranker. All scoring logic
// lives in contextRankerCore.ts (pure, shared with the Node regression
// harness). This file only does the chrome/fetch model loading + warm-up.
import {
  parseModel,
  rankCandidates,
  rankSpellCandidates,
  type NgramModel,
} from './contextRankerCore';

let modelPromise: Promise<NgramModel | null> | null = null;

function loadModel(): Promise<NgramModel | null> {
  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        const url = chrome.runtime.getURL('ngram/model.bin');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const model = parseModel(await res.arrayBuffer());
        console.log(`[ngram] context model ready (V=${model.V}, B=${model.bi.size})`);
        return model;
      } catch (e) {
        console.warn('[ngram] model load failed; context ranking disabled:', e);
        return null;
      }
    })();
  }
  return modelPromise;
}

/** Warm the model ahead of first use (called alongside Harper warm-up). */
export async function warmContextModel(): Promise<void> {
  await loadModel();
}

/**
 * Re-rank Harper spelling candidates by neighbour context (see
 * contextRankerCore.rankCandidates). Async wrapper that supplies the
 * lazily-loaded model.
 */
export async function rankByContext(
  text: string,
  offset: number,
  length: number,
  original: string,
  cands: string[],
): Promise<string[]> {
  if (cands.length <= 1) return cands.slice();
  const m = await loadModel();
  return rankCandidates(m, text, offset, length, original, cands);
}

/**
 * Rank a Hunspell/SymSpell candidate pool by neighbour context
 * (contextRankerCore.rankSpellCandidates). Use for an externally-generated pool
 * with no meaningful prior order; full-scores and sorts every candidate.
 */
export async function rankSpellByContext(
  text: string,
  offset: number,
  length: number,
  original: string,
  cands: string[],
): Promise<string[]> {
  if (cands.length <= 1) return cands.slice();
  const m = await loadModel();
  return rankSpellCandidates(m, text, offset, length, original, cands);
}
