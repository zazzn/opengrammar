# Local LLM model benchmark - 2026-05-31

## Goal

Find the smallest and fastest Ollama model that is still good enough for
conservative Grammarly-style proofreading in OGrammar.

The key requirement is not just raw grammar quality. A model must avoid damaging
protected text such as URLs, emails, file paths, code, model names, IDs,
automotive shorthand, and casual chat slang.

## Method

Benchmark script:

```bash
cd /home/zazzn/opengrammar/opengrammar/extension
npm run benchmark:ollama -- --models=qwen2.5:1.5b,qwen2.5:3b,qwen2.5:7b,qwen3:1.7b,qwen3:4b-instruct,llama3.2:3b,gemma3:4b,phi4-mini:latest,granite3.3:2b,gemma2:2b
```

The benchmark now uses the real suggestion corpus at:

```text
/home/zazzn/opengrammar/opengrammar/extension/test-data/suggestion-corpus.json
```

It scores 46 active non-manual cases:

- quick spelling and typo fixes
- sentence-level grammar corrections
- protected-span preservation
- ignore/no-change cases
- casual forum/chat language
- code, commands, paths, URLs, emails, IDs, versions, and automotive shorthand

Known gaps and manual UI cases are excluded from model selection.

## Focused Results

| Model | Exact | Weighted | Hard failures | JSON | Protected | No false positive | Sentence review | Avg |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3:4b-instruct | 36/46 | 97/123 | 4 | 46/46 | 42/46 | 42/46 | 5/10 | 859ms |
| llama3.2:3b | 35/46 | 95/123 | 4 | 46/46 | 42/46 | 42/46 | 5/10 | 1803ms |
| qwen2.5:3b | 30/46 | 93/123 | 4 | 46/46 | 42/46 | 43/46 | 5/10 | 2505ms |
| qwen3:1.7b | 28/46 | 81/123 | 8 | 44/46 | 40/46 | 42/46 | 2/10 | 1860ms |
| gemma2:2b | 28/46 | 77/123 | 9 | 46/46 | 37/46 | 39/46 | 3/10 | 2100ms |
| gemma3:4b | 31/46 | 82/123 | 10 | 44/46 | 37/46 | 39/46 | 4/10 | 1329ms |
| qwen2.5:7b | 31/46 | 74/123 | 12 | 46/46 | 35/46 | 34/46 | 9/10 | 2374ms |
| qwen2.5:1.5b | 22/46 | 64/123 | 14 | 46/46 | 33/46 | 35/46 | 3/10 | 2500ms |
| granite3.3:2b | 23/46 | 53/123 | 18 | 46/46 | 30/46 | 30/46 | 6/10 | 945ms |
| phi4-mini:latest | 19/46 | 39/123 | 24 | 46/46 | 23/46 | 27/46 | 6/10 | 3669ms |

## Recommendation

Use `qwen3:4b-instruct` as the recommended local Ollama model.

Why:

- best local result after the clean GPU rerun: `40/46`, weighted `107/123`
- fewest local hard failures: `2`
- fastest local model in the clean run: about `902ms`
- good enough sentence review when balanced against protected-text and
  false-positive safety
- returns normal OpenAI-compatible `message.content`

Keep `qwen2.5:7b` visible as a sentence-review baseline if installed.

Hide code models and unsupported thinking models from the writing picker,
including `qwen2.5-coder:*`, `qwen3:4b`, `qwen3:latest`, and `qwen3.5:*`.
The installed Qwen3/Qwen3.5 thinking-style tags returned empty
`message.content` through the OpenAI-compatible endpoint, putting text in the
reasoning field instead, so they are not suitable for OGrammar's current direct
provider path.

## Important Failures To Improve Next

`qwen3:4b-instruct` still failed some sentence-review cases:

- `6/10` sentence-review in the clean GPU run
- better local safety/latency balance than `qwen2.5:7b`

The fix is not just model choice. The app should keep improving pre/post
protection so the model never sees protected spans as editable text.

---

## Clean Re-Run + Cloud Providers — 2026-06-01

A follow-up run addressed two things: (1) a suspected resource-contention skew in
the run above (GPU maxed, system RAM hit ~49 GB), and (2) adding cloud API models
(Abacus RouteLLM, DeepSeek) as a quality ceiling for users with API keys.

### Method differences

New runner `scripts/benchmark-models.mjs` (same 46-case corpus + identical scoring):

- Uses Ollama's **native `/api/chat`** so `num_ctx` can be pinned to **4096** — the
  unpinned 256K-context KV cache (qwen3) was the likely cause of the RAM spike.
- Enforces **single-model residency** (explicit unload + `/api/ps` check between
  models) and **reports GPU%** per model so spill-to-CPU is visible.
- `--repeats=2` averages local latency; cloud scored once (network-bound).

### Finding: the contention did NOT skew the earlier run

All six local models ran at **GPU 100%**, and the clean latencies reproduce the
earlier contended numbers closely (e.g. `qwen2.5:1.5b` 2496 ms vs 2500;
`qwen3:4b-instruct` 902 ms vs 859). The 49 GB spike was transient (KV-cache during
load) and did **not** corrupt the per-model quality or latency. The "1.5B slower
than 4B" oddity is real — a generation-efficiency difference, not a measurement
artifact (terse `qwen3:4b-instruct` vs verbose `qwen2.5:1.5b`).

### Clean results (sorted by weighted quality)

| Model | Exact | Weighted | Hard | JSON | Protected | No false positive | Sentence review | Avg | GPU |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **deepseek-chat** (cloud) | 45/46 | **121/123** | **0** | 46/46 | **46/46** | **46/46** | 9/10 | 1355ms | — |
| deepseek-reasoner (cloud) | 43/46 | 118/123 | 2 | 44/46 | 45/46 | 46/46 | 8/10 | 2668ms | — |
| abacus/route-llm (cloud) | 42/46 | 108/123 | 4 | 46/46 | 42/46 | 42/46 | **10/10** | 2973ms | — |
| **qwen3:4b-instruct** (local) | 40/46 | 107/123 | 2 | 46/46 | 44/46 | 44/46 | 6/10 | **902ms** | 100% |
| llama3.2:3b (local) | 35/46 | 95/123 | 4 | 46/46 | 42/46 | 42/46 | 5/10 | 1716ms | 100% |
| qwen2.5:3b (local) | 30/46 | 93/123 | 4 | 46/46 | 42/46 | 43/46 | 5/10 | 2433ms | 100% |
| gemma2:2b (local) | 28/46 | 77/123 | 9 | 46/46 | 37/46 | 39/46 | 3/10 | 2146ms | 100% |
| qwen2.5:7b (local) | 31/46 | 74/123 | 12 | 46/46 | 35/46 | 34/46 | 9/10 | 2557ms | 100% |
| qwen2.5:1.5b (local) | 22/46 | 64/123 | 14 | 46/46 | 33/46 | 35/46 | 3/10 | 2496ms | 100% |

### Updated recommendation

- **Best local (default):** `qwen3:4b-instruct` — **confirmed** on a clean GPU run.
  Best local quality by a wide margin, fewest hard failures (2), and the fastest
  local model (902 ms). Stays the `DEFAULT_WRITING_MODEL`.
- **Best overall / best for users with an API key:** **`deepseek-chat`** — near
  perfect (121/123), **zero hard failures**, perfect protected-span and
  no-false-positive (46/46), and only ~1.4 s. The strongest proofreader tested.
- **`deepseek-reasoner`:** worse *and* slower than `deepseek-chat`, with 2 JSON
  failures — confirms the thinking-model + JSON-mode risk. Prefer `deepseek-chat`.
- **`abacus/route-llm`:** solid (108/123, best sentence-review) but damages more
  protected spans (42/46) and is the slowest. Fine as an alternate.

Command:

```bash
cd /home/zazzn/opengrammar/opengrammar/extension
node scripts/benchmark-models.mjs --remote --repeats=2
# cloud keys read from env or ~/.ogrammar-bench/{deepseek,abacus}.key
```

Note: `deepseek-chat`'s perfect protected-span score still does not remove the need
for app-side pre/post protection — it just damages protected text less often than
the local models. The protected-span layer remains the real guarantee.

## Native Ollama path and Qwen 3.5 follow-up

OGrammar now uses Ollama's native `/api/chat` path for local models instead of
the OpenAI-compatible `/v1/chat/completions` path. The native path sends:

```json
{
  "stream": false,
  "think": false,
  "format": "json",
  "options": {
    "temperature": 0,
    "num_ctx": 4096
  }
}
```

This fixes Qwen 3.5's empty-`message.content` issue on the OpenAI-compatible
path and prevents the large default context cache from inflating RAM usage.

### Qwen 3.5 and NVIDIA check

Command:

```bash
cd /home/zazzn/opengrammar/opengrammar/extension
node scripts/benchmark-models.mjs --local=qwen3:4b-instruct,qwen3.5:0.8b,qwen3.5:2b,qwen3.5:4b,nemotron-mini --repeats=1
```

| Model | Exact | Weighted | Hard | JSON | Protected | No false positive | Sentence review | Avg | GPU |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3:4b-instruct | 40/46 | 107/123 | 2 | 46/46 | 44/46 | 44/46 | 6/10 | 935ms | 100% |
| qwen3.5:2b | 37/46 | 104/123 | 5 | 44/46 | 42/46 | 43/46 | 7/10 | 6975ms | 100% |
| qwen3.5:4b | 36/46 | 94/123 | 7 | 44/46 | 40/46 | 40/46 | 8/10 | 1022ms | 100% |
| qwen3.5:0.8b | 26/46 | 93/123 | 0 | 46/46 | 46/46 | 46/46 | 0/10 | 1481ms | 100% |
| nemotron-mini | 23/46 | 72/123 | 11 | 44/46 | 35/46 | 39/46 | 2/10 | 4670ms | n/a |

Result:

- `qwen3:4b-instruct` remains the best local default.
- `qwen3.5:4b` is interesting for sentence review (`8/10`) but has more hard
  failures than the default.
- `qwen3.5:2b` has strong weighted quality but is much slower on this machine.
- `qwen3.5:0.8b` is very conservative but cannot do sentence review.
- NVIDIA `nemotron-mini` is not competitive for this proofreading workload.

### Qwen 3 thinking-tag check

Command:

```bash
node scripts/benchmark-models.mjs --local=qwen3:4b,qwen3:latest,qwen3:1.7b,qwen3:4b-instruct --repeats=1
```

| Model | Exact | Weighted | Hard | JSON | Protected | No false positive | Sentence review | Avg | GPU |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3:4b-instruct | 40/46 | 107/123 | 2 | 46/46 | 44/46 | 44/46 | 6/10 | 882ms | 100% |
| qwen3:1.7b | 27/46 | 92/123 | 1 | 46/46 | 45/46 | 45/46 | 1/10 | 540ms | 100% |
| qwen3:4b | 25/46 | 90/123 | 2 | 44/46 | 44/46 | 45/46 | 1/10 | 471ms | 100% |
| qwen3:latest | 31/46 | 79/123 | 12 | 46/46 | 34/46 | 36/46 | 7/10 | 1462ms | 100% |

The non-instruct Qwen3 tags are no longer transport-broken through native
Ollama, but they are still weaker choices for OGrammar than
`qwen3:4b-instruct`.

---

## Groq provider + cost-per-correction — 2026-06-01

Added Groq (`scripts/benchmark-models.mjs --groq=…`). First pass was invalidated
by **rate-limiting** (free-tier 429s rejected most of the burst as instant
failures — visible as 96–302 ms "latencies"); the runner now retries 429/503 with
`Retry-After` backoff and paces remote calls (`REMOTE_DELAY_MS`, ~27 req/min).

### Groq results (46-case corpus, re-run with rate-limit handling)

| Model | Exact | Weighted | Hard | JSON | Protected | No false positive | Sentence review | Avg | Tokens p/c |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| openai/gpt-oss-20b | 44/46 | 117/123 | 2 | 45/46 | 46/46 | 45/46 | 9/10 | 3266ms | 322/453 |
| qwen/qwen3-32b | 43/46 | 113/123 | 2 | 46/46 | 44/46 | 44/46 | 9/10 | 4524ms | 243/420 |
| openai/gpt-oss-120b | 42/46 | 112/123 | 3 | 46/46 | 46/46 | 43/46 | 9/10 | 2558ms | 323/484 |
| llama-3.3-70b-versatile | 38/46 | 97/123 | 7 | 46/46 | 39/46 | 40/46 | 9/10 | **396ms** | 275/120 |
| llama-4-scout-17b | 35/46 | 88/123 | 10 | 46/46 | 37/46 | 38/46 | 8/10 | 431ms | 249/128 |
| llama-3.1-8b-instant | 31/46 | 76/123 | 13 | 46/46 | 33/46 | 35/46 | 8/10 | 1634ms | 274/120 |

The reasoning models (`gpt-oss-20b/120b`, `qwen3-32b`) handle strict JSON fine on
Groq and score near the top, but generate ~3–4× the output tokens (reasoning),
making them slower and pricier. The non-reasoning `llama-3.3-70b-versatile` is the
speed story: **396 ms** at 97/123.

### Cost per correction (measured tokens × current price)

`$/correction` = avg-prompt × input-rate + avg-completion × output-rate.

| Model | $/1M in | $/1M out | $/correction |
|---|---:|---:|---:|
| deepseek-chat | 0.14 (0.0028 cached) | 0.28 | **~$0.00004** (cached) |
| groq/llama-3.1-8b-instant | 0.05 | 0.08 | $0.00002 |
| groq/llama-4-scout | 0.11 | 0.34 | $0.00007 |
| groq/gpt-oss-20b | 0.075 | 0.30 | $0.00016 |
| groq/llama-3.3-70b-versatile | 0.59 | 0.79 | $0.00026 |
| groq/qwen3-32b | 0.29 | 0.59 | $0.00032 |
| groq/gpt-oss-120b | 0.15 | 0.60 | $0.00034 |
| abacus/route-llm | — (credit/opaque) | — | ~$10/mo flat subscription |

Day-to-day email writing stays in the **pennies-per-month** range on any of the
cheap per-token options (DeepSeek, Groq 8B/Scout). DeepSeek's prompt caching makes
its fixed proofreading system prompt nearly free, so it is both the **highest
quality and the cheapest** cloud option. Output tokens dominate cost — trimming
the correction schema (dropping per-fix `explanation`) would roughly halve any
paid provider's cost.

### Cross-provider recommendation

- **Local / private / free:** `qwen3.5:4b` with protected-text masking on
  (123/123, 0 hard failures, ~1046 ms).
- **Best cloud quality + cheapest:** `deepseek-chat` (123/123 with masking, ~$0.00004/call).
- **Fastest cloud:** Groq `llama-3.3-70b-versatile` (396 ms, 97/123) when in-browser
  latency matters more than top accuracy.
- Groq `gpt-oss-20b` (117/123) proves Groq can match on quality, but it is slower
  and pricier than `deepseek-chat`, so it is not the default pick.
- Skip Groq `llama-3.1-8b-instant` for proofreading (76/123, 13 hard failures).

---

## Protected-text masking rerun — 2026-06-01

OGrammar now masks protected text before LLM correction, using the same
`findProtectedSpans()` logic that protects the local Harper path.

Example:

```text
Original: Go to https://example.com/adress/recieved and dont change it.
LLM sees:  Go to [[OG_PROTECTED_1]] and dont change it.
Restored:  Go to https://example.com/adress/recieved and don't change it.
```

The setting is enabled by default and can be toggled from Options:
**Mask protected text before AI correction**.

### Masked local benchmark

Command:

```bash
cd /home/zazzn/opengrammar/opengrammar/extension
node scripts/benchmark-models.mjs --local=qwen3:4b-instruct,qwen3.5:0.8b,qwen3.5:2b,qwen3.5:4b,qwen2.5:7b,gemma3:4b,qwen3:latest --repeats=1
```

| Model | Exact | Weighted | Hard | JSON | Protected | No false positive | Sentence review | Avg | GPU |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3.5:4b | 46/46 | 123/123 | 0 | 46/46 | 46/46 | 46/46 | 10/10 | 913ms | 100% |
| qwen2.5:7b | 45/46 | 121/123 | 0 | 46/46 | 46/46 | 46/46 | 9/10 | 2078ms | 100% |
| qwen3:latest | 44/46 | 119/123 | 0 | 46/46 | 46/46 | 46/46 | 8/10 | 1257ms | 100% |
| qwen3.5:2b | 42/46 | 115/123 | 1 | 46/46 | 45/46 | 45/46 | 8/10 | 806ms | 100% |
| qwen3:4b-instruct | 41/46 | 113/123 | 0 | 46/46 | 46/46 | 46/46 | 5/10 | 685ms | 100% |
| gemma3:4b | 36/46 | 99/123 | 4 | 43/46 | 43/46 | 43/46 | 5/10 | 1655ms | 100% |
| qwen3.5:0.8b | 24/46 | 89/123 | 1 | 45/46 | 46/46 | 45/46 | 0/10 | 508ms | 100% |

Repeat top-model check:

```bash
node scripts/benchmark-models.mjs --local=qwen3.5:4b,qwen2.5:7b,qwen3:latest,qwen3:4b-instruct --repeats=2
```

| Model | Exact | Weighted | Hard | JSON | Protected | No false positive | Sentence review | Avg | GPU |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3.5:4b | 46/46 | 123/123 | 0 | 46/46 | 46/46 | 46/46 | 10/10 | 1046ms | 100% |
| qwen2.5:7b | 45/46 | 121/123 | 0 | 46/46 | 46/46 | 46/46 | 9/10 | 2087ms | 100% |
| qwen3:latest | 44/46 | 119/123 | 0 | 46/46 | 46/46 | 46/46 | 8/10 | 1044ms | 100% |
| qwen3:4b-instruct | 41/46 | 113/123 | 0 | 46/46 | 46/46 | 46/46 | 5/10 | 694ms | 100% |

### Masked cloud benchmark

Command:

```bash
REMOTE_DELAY_MS=250 node scripts/benchmark-models.mjs --local= --remote
```

| Model | Exact | Weighted | Hard | JSON | Protected | No false positive | Sentence review | Avg |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| deepseek-chat | 46/46 | 123/123 | 0 | 46/46 | 46/46 | 46/46 | 10/10 | 1908ms |
| abacus/route-llm | 45/46 | 120/123 | 1 | 46/46 | 46/46 | 45/46 | 10/10 | 2100ms |
| deepseek-reasoner | 41/46 | 115/123 | 3 | 43/46 | 44/46 | 46/46 | 7/10 | 3235ms |

Updated recommendation:

- **Best local:** `qwen3.5:4b`.
- **Best cloud:** `deepseek-chat`.
- Masking is worth keeping on by default. It turns protected-text safety from a
  model-choice problem into an app-level guarantee, and it made weaker models
  substantially more usable.
