# Spell-suggestion engine benchmark — 2026-06-06

## Goal

Two questions, decided on data rather than assumption:

1. **Engine parity.** The browser extension runs Harper + SymSpell + an n-gram
   context re-ranker; the Windows desktop runs **Harper only** by default (the
   SymSpell / n-gram code exists in `ograms-engine` but is dormant). Is the richer
   pipeline actually worth enabling on the desktop?
2. **LLM headroom.** Every sentence already goes through the LLM. How much better
   is the LLM than the local engine — i.e. how much could a "learn from the LLM"
   loop recover?

This is distinct from [25-local-llm-model-benchmark.md](25-local-llm-model-benchmark.md),
which measures **sentence-level proofreading** quality. This one measures
**isolated spelling-suggestion accuracy** (bare word, no context) — the regime
where the local engine is weakest and where the "halarious → hilarious" defect lived.

## Method

`extension/scripts/bench-spell.mjs` runs the **actual shipped modules**
(`spellSuggest.ts`, `contextRankerCore.ts`) so results can't drift from production.

Configs — all share Harper for *detection*; they differ only in suggestion gen+rank:

| | config | description |
|---|---|---|
| A | `harper` | Harper's own top suggestion (**current desktop default**) |
| B | `harper+ctx` | Harper candidates re-ranked by the n-gram model |
| C | `symspell+ctx` | SymSpell pool + n-gram re-rank (**current extension default**) |
| D | `C + tiering` | C plus edit-distance tiering ("solution #1") |

Corpora (`test-data/`):

- **synthetic** — single-edit typos generated from the 82k frequency dictionary
  (controlled, reproducible; biased toward the clean edits SymSpell handles well).
- **norvig** — `norvig-testset{1,2}.txt` (552 real typos).
- **spell-errors** — `norvig-spell-errors.txt` (~30k real typos; aggregates
  Wikipedia / Birkbeck / Aspell).

> ⚠️ The previous harnesses (`test-suggestion-corpus.mjs`, `simulate-inline.mjs`)
> only fed **Harper's** candidates into the ranker — they never call
> `spellSuggestions`. So earlier "no difference between the engines" conclusions
> never actually exercised SymSpell.

Metric: of the words Harper flags, how often the source word is the config's
top-1 / top-3 suggestion, over *detected* cases.

## Config results (55,483 cases)

| track | n | A harper | B +ctx | C symspell | D +tiering |
|---|---:|---|---|---|---|
| synthetic | 14,841 | 73.8 / 89.6 | 78.1 / 89.6 | **80.7 / 97.0** | 78.7 / 93.3 |
| norvig (real) | 552 | 75.9 / 87.7 | 75.0 / 87.7 | 70.7 / 90.4 | 75.7 / 90.4 |
| **spell-errors (real)** | 29,643 | 42.3 / 54.0 | 43.2 / 54.0 | 42.1 / 55.6 | **44.2 / 54.9** |
| **OVERALL** | 45,036 | 53.1 / 66.1 | 55.1 / 66.1 | 55.1 / 69.7 | **55.9 / 68.0** |

*(top-1 / top-3 %, over Harper-detected cases)*

### Findings

1. **Synthetic is misleading.** It hands SymSpell (C) a big win (80.7 vs 73.8) —
   but synthetic single-edits are exactly what edit-distance generation handles best.
2. **On real typos, all four configs are within ~2 points** (~42–44 % top-1).
   **SymSpell gives ≈ 0 real top-1 benefit over Harper-only.** This is the
   "benchmarks showed no difference" result — confirmed on 30k real typos, and the
   reason the desktop was originally kept Harper-only.
3. **Real top-3 ≈ 55 %** → the candidate generator *misses ~45 % of real typos
   entirely*. That's a generation ceiling no amount of ranking can fix.
4. **Solution #1 (D / edit-distance tiering)** is a marginal *real* win (+~2 top-1)
   and fixes `halarious→hilarious`, but naive Levenshtein tiering regresses
   synthetic and breaks transpositions (`recieve→relieve`). It needs
   Damerau-Levenshtein + *soft* tiering. Low priority.

## LLM headroom (100-case real-weighted sample, bare word, no context)

`LLM_TARGETS="ollama:qwen3.5:4b,ollama:qwen2.5:7b,deepseek:deepseek-chat"` —
Ollama via native `/api/chat` (`think:false` for qwen3* tags), DeepSeek via the
OpenAI-compatible endpoint (key from `$DEEPSEEK_API_KEY`).

| target | top-1 | rescue of C's failures | time |
|---|---:|---:|---:|
| C — local SymSpell (baseline) | 58.0 % | — | instant |
| ollama `qwen3.5:4b` | 60.0 % | 15/42 (36 %) | 17s |
| ollama `qwen2.5:7b` | 56.0 % | 14/42 (33 %) | 16s |
| **deepseek-chat** (cloud) | **73.0 %** | **21/42 (50 %)** | 100s |

### Findings

5. **DeepSeek recovers half (50 %) of the local engine's failures** — strong
   validation of "LLM as source of truth." A learn-from-LLM loop fed by DeepSeek
   could lift effective accuracy from ~58 % toward ~79 %.
6. **Small local models barely beat SymSpell on *bare words*** (qwen3.5:4b 60 %,
   qwen2.5:7b 56 % vs C 58 %). `qwen3.5:4b` does edge `qwen2.5:7b`, consistent with
   docs/25 ranking it the best local model.
7. **Caveat — bare word is the LLMs' worst case.** With sentence context (the
   production path), the proofreading models are far stronger: docs/25 has
   `qwen3.5:4b` and `deepseek-chat` both at **123/123** on the sentence-level
   corpus. So these bare-word numbers are a *floor* on LLM value, not a ceiling.

## Sentence-level results — the realistic test (the one that matters)

Bare words never happen in production — the engine and the LLM always see a full
sentence. So the real benchmark injects a **real human non-word typo** into a content
word of a real news sentence (Leipzig `eng_news_2020_10K`) and scores recovery **in
context**. `scripts/bench-spell-sentences.mjs`.

### Local, with context (2,000 sentences; Harper flagged the typo in 1,505)

| config | target typo fixed (top-1) |
|---|---:|
| A harper | 42.0 % |
| **C symspell+ctx** | **67.4 %** |

**This REVERSES the bare-word conclusion.** Bare-word starved C's n-gram context
ranker (so C ≈ A). With real context, **C beats Harper-only by 25 points** — the
extension's pipeline IS materially better, so **leveling the desktop up is justified.**

### LLM, with context (80-sentence sample; C = 80.0 % on this sample)

| target | top-1 | rescue of C's failures | latency¹ |
|---|---:|---:|---:|
| local C (SymSpell + n-gram) | — | — | **~5 ms** |
| ollama `qwen3:4b-instruct` | 88.8 % | 10/16 (63 %) | ~275 ms |
| ollama `qwen2.5:7b` | 90.0 % | 10/16 (63 %) | ~390 ms |
| **ollama `qwen3.5:4b`** (free, local) | **95.0 %** | **13/16 (81 %)** | ~415 ms |
| **deepseek-chat** (cloud) | **97.5 %** | **14/16 (88 %)** | ~1.1 s |
| **abacus/route-llm** (cloud) | **97.5 %** | **14/16 (88 %)** | ~1.3 s |
| gemini-2.5-flash (cloud) | n/a² | n/a | n/a |

¹ per-correction wall-clock. Local = full on-device pipeline; local-LLM = full sentence
generation incl. amortized model load; cloud = network round-trip. `gemini-2.0-flash` is
`limit:0` on this key; `gemini-2.5-flash` works but the free tier 429s a burst, so it's
re-running paced (verified correct on a single call).

**With context the LLMs are decisive** — they rescue **63–88 %** of the local engine's
failures (vs ~36–50 % bare-word). And **`qwen3.5:4b` (free, local) at 95 % / 81 % rescue
nearly matches the cloud models** — so a learn-from-LLM loop captures most of the
headroom even *without* a paid key.

**The latency gap is the architecture's whole rationale.** Local is **~5 ms** (instant —
fires inline on every keystroke), local LLMs are **~300–400 ms**, cloud LLMs are **~1 s+**.
So the LLM can only ever be the *deferred / background* tier and the teacher — never the
inline one. That is exactly how OGrammar is built (Harper inline; the LLM on the proactive
`CORRECT_TEXT` path), and why learning from the LLM into the instant local tier matters.

## Conclusions / decisions

- **LEVEL THE DESKTOP UP to SymSpell+n-gram.** With context, C (67.4 %) beats Harper-only
  (42.0 %) by 25 points. The earlier "no difference / don't level up" was a bare-word
  artifact (it neutralised the context ranker, which is C's whole point).
- **The learn-from-LLM loop is the big win** — with context the LLM rescues 63–88 % of
  the local engine's failures. **`qwen3.5:4b` (free, local) captures ~81 %**, nearly the
  cloud's 88 %, so the loop works without a paid key; use a cloud teacher
  (DeepSeek / Abacus, both 97.5 %) for the last few points when a key is present.
- **Always benchmark on SENTENCES, not bare words** — bare words inverted every conclusion.
- **Solution #1 (tiering):** still small; refine (Damerau + soft), low priority.
- **Local default model:** `qwen3.5:4b` (confirms docs/25).

## Reproduce

```bash
cd opengrammar/extension

# config tracks only (synthetic + real); ~7 min for the full real corpus:
node scripts/bench-spell.mjs 6000

# add the LLM headroom track (Ollama + DeepSeek), corpus capped for speed:
LLM_TARGETS="ollama:qwen3.5:4b,deepseek:deepseek-chat" MAX_SE=3000 LLM_SAMPLE=100 \
  node scripts/bench-spell.mjs 200
# DeepSeek key read from $DEEPSEEK_API_KEY (or a local key file)

# SENTENCE-level (the realistic test) — local + LLM (Ollama + cloud):
LLM_TARGETS="ollama:qwen3.5:4b,ollama:qwen3:4b-instruct,deepseek:deepseek-chat,abacus:route-llm,gemini:gemini-2.5-flash" \
  LLM_SAMPLE=80 REMOTE_DELAY_MS=4000 node scripts/bench-spell-sentences.mjs 2000
# cloud keys read from $DEEPSEEK_API_KEY / $ABACUS_API_KEY / $GEMINI_API_KEY
# REMOTE_DELAY_MS paces cloud calls (Gemini free tier 429s a burst otherwise)
```
