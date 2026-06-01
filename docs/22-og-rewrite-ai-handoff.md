# OGrammar AI Handoff - og-rewrite

Last updated: 2026-06-01

This note is for another AI or developer taking over the current OpenGrammar/OGrammar work. It summarizes the active repo, exact paths, what was changed, test results, and the remaining work.

## Active Repo

- Active checkout: `/home/zazzn/opengrammar`
- Branch: `og-rewrite`
- GitHub repo: `zazzn/opengrammar`
- Extension package: `/home/zazzn/opengrammar/opengrammar/extension`
- Load unpacked extension from: `/home/zazzn/opengrammar/opengrammar/extension/dist`
- Do not use `/mnt/c/Users/zazzn/opengrammar` for this work. That Windows-mounted path was empty during this session.

The current implementation path is backendless for the browser extension. The extension service worker calls providers directly from the background script. The repo still contains `opengrammar/backend`, and older docs mention backend deployment, but the active work described here is in `opengrammar/extension`.

## User Goal

Build a hybrid Grammarly-style browser proofreader:

- Local rule/spell engine only for fast, low-risk mechanical detection.
- Protect non-prose spans before showing or applying corrections.
- Use an LLM for context-sensitive sentence-level correction.
- Preserve protected spans exactly.
- Return no correction when confidence is low.
- Show changed spans clearly in the UI.
- Avoid one-word suggestions when sentence context is required.
- Make the popup model picker recommend models that actually work well for proofreading.

## Current Working Tree

At handoff time, the working tree intentionally contains uncommitted changes.

Modified files:

- `/home/zazzn/opengrammar/opengrammar/extension/package.json`
- `/home/zazzn/opengrammar/opengrammar/extension/scripts/simulate-inline.mjs`
- `/home/zazzn/opengrammar/opengrammar/extension/src/background/harperEngine.ts`
- `/home/zazzn/opengrammar/opengrammar/extension/src/background/index.ts`
- `/home/zazzn/opengrammar/opengrammar/extension/src/background/llmClient.ts`
- `/home/zazzn/opengrammar/opengrammar/extension/src/content/highlighter.ts`
- `/home/zazzn/opengrammar/opengrammar/extension/src/content/index.ts`
- `/home/zazzn/opengrammar/opengrammar/extension/src/options/index.html`
- `/home/zazzn/opengrammar/opengrammar/extension/src/popup/popup.tsx`
- `/home/zazzn/opengrammar/opengrammar/extension/src/types.ts`

New files:

- `/home/zazzn/opengrammar/opengrammar/extension/scripts/benchmark-ollama-writing-models.mjs`
- `/home/zazzn/opengrammar/opengrammar/extension/scripts/simulate-protected.mjs`
- `/home/zazzn/opengrammar/opengrammar/extension/src/background/issuePolicy.ts`
- `/home/zazzn/opengrammar/opengrammar/extension/src/shared/ollamaModels.ts`
- `/home/zazzn/opengrammar/opengrammar/extension/src/shared/protectedText.ts`
- `/home/zazzn/opengrammar/docs/22-og-rewrite-ai-handoff.md`

Use this command to confirm current state:

```bash
git -C /home/zazzn/opengrammar status --short
```

## Work Completed

### Protected Text Filtering

Main file:

- `/home/zazzn/opengrammar/opengrammar/extension/src/shared/protectedText.ts`

Added shared protected-span detection for:

- URLs, domains, localhost, IPv4/IPv6, git remotes
- Emails
- Markdown links
- Inline code, fenced code, BBCode code/pre blocks, HTML code/pre/script/style
- Windows, Unix, and relative file paths
- Dotted tech filenames like `package-lock.json`, `.env.local`, `vite.config.ts`
- Packages and import-like names such as `@vitejs/plugin-react`, `node:fs`, `react-dom/client`
- Commands such as `npm run build`, `ollama pull`, `docker ...`
- Config assignments, JSON pairs, env keys
- API keys, hashes, UUIDs, tickets, PR numbers
- Version strings, measurements, automotive shorthand like `2JZ`, `NA-T`, `700hp`
- Usernames, hashtags
- Chat slang and casual phonetic phrases like `lol`, `whadda`, `whaddya`, `Whaddada`, `gonna`, `gotta`, `wanna`, `yall`
- Proper nouns and code-style tokens

This protects both inline Harper issues and LLM correction validation.

### Local Issue Routing

Main file:

- `/home/zazzn/opengrammar/opengrammar/extension/src/background/issuePolicy.ts`

Purpose:

- Route safe mechanical issues to `quick-fix`.
- Route ambiguous/context-sensitive issues to `sentence-review`.
- Suppress risky or protected suggestions.

This was added to stop cases like weak one-word suggestions from becoming clickable quick fixes.

### Harper Integration Updates

Main file:

- `/home/zazzn/opengrammar/opengrammar/extension/src/background/harperEngine.ts`

Notable work:

- Common typo override for `adress -> address`.
- Works with the issue policy and protected span filter in the background script.

### Background LLM Correction Flow

Main files:

- `/home/zazzn/opengrammar/opengrammar/extension/src/background/index.ts`
- `/home/zazzn/opengrammar/opengrammar/extension/src/background/llmClient.ts`

Completed:

- `CHECK_GRAMMAR` now runs Harper, filters protected spans, applies issue policy, and returns routed issues.
- `CORRECT_TEXT` sends whole text/sentence context to the configured LLM and expects structured JSON.
- LLM correction prompt is conservative: fix only objective errors, preserve meaning/tone, do not normalize casual speech, preserve protected fragments exactly, return no correction on low confidence.
- Added validation so unsafe LLM output is rejected if protected fragments change or the correction looks too broad.
- Added Qwen3 `/no_think` control for proofreading latency.
- Added request timeout handling so slow model calls fail cleanly instead of hanging indefinitely.
- Added Ollama native pull support with `OLLAMA_PULL`.
- Added error propagation from failed correction calls so the content UI can show retry/error state.

### Popup Model Picker

Main files:

- `/home/zazzn/opengrammar/opengrammar/extension/src/popup/popup.tsx`
- `/home/zazzn/opengrammar/opengrammar/extension/src/shared/ollamaModels.ts`

Completed:

- Popup filters installed Ollama models to writing-capable models.
- Hides code/embed/vision/math/safety models from the normal model dropdown.
- Shows how many hidden models were excluded.
- Auto-switches away from a hidden or unavailable model to the best visible writing model.
- Adds a `Pull qwen2.5:7b` button if the recommended writing model is not installed.
- Keeps existing Ollama scan, test, unload, and keep-alive controls.

Recommendation result:

- `qwen2.5:7b` is the current recommended model based on local benchmark results, not assumption.
- `qwen3:latest` remains a good alternate but was slower and scored lower on weighted correction quality.
- `gemma2:2b` is fast but missed real grammar/capitalization corrections.
- `qwen2.5-coder:7b` was tested directly and did not beat `qwen2.5:7b`; it is hidden because it is a code model.

### Content UI / Review Card

Main file:

- `/home/zazzn/opengrammar/opengrammar/extension/src/content/highlighter.ts`

Completed:

- Assistant bubble no longer covers compact/small fields as aggressively. It positions outside small inputs where possible.
- Sentence splitting now respects protected spans so URLs/domains do not split the sentence.
- Whole-sentence review uses one coherent LLM correction instead of merging fragment suggestions.
- Review card highlights changed words in the original sentence and keeps detailed diff behind "View the changes".
- Slow Ollama loading no longer makes the OGrammar review window disappear silently.
- Loading card now updates from "Checking your writing" to slow-load messaging.
- If the model fails or times out, the card stays visible with Retry/Close.
- If no confident sentence-level change is returned, the card shows a no-change message instead of disappearing.

### Content Entry Filter

Main file:

- `/home/zazzn/opengrammar/opengrammar/extension/src/content/index.ts`

Completed:

- Single-token protected/non-prose fields are skipped to avoid correcting things like URLs, config keys, package names, and slang-only fields.

### Options Page

Main file:

- `/home/zazzn/opengrammar/opengrammar/extension/src/options/index.html`

Completed:

- Updated the local model guide to reflect the benchmark-driven `qwen2.5:7b` recommendation.
- Notes that Qwen3 should use non-thinking mode for proofreading latency.
- Notes that code/embed/vision variants are hidden from the popup model picker.

## Benchmark Results

Benchmark command:

```bash
cd /home/zazzn/opengrammar/opengrammar/extension
npm run benchmark:ollama
```

Installed models observed:

- `qwen2.5:7b`
- `gemma2:9b`
- `mistral:7b`
- `qwen2.5-coder:7b`
- `qwen3:latest`
- `llama3.1:8b-instruct-q8_0`
- `llama3.1:8b`
- `gemma2:2b`

Normal benchmark skipped non-writing models:

- `qwen2.5-coder:7b`

Weighted benchmark result:

```text
qwen2.5:7b                   6/8 weighted=10/12 avg=2448ms load=5102ms
gemma2:9b                    6/8 weighted=10/12 avg=5991ms load=5976ms
llama3.1:8b-instruct-q8_0    6/8 weighted=10/12 avg=7800ms load=9573ms
gemma2:2b                    6/8 weighted=8/12  avg=1583ms load=2643ms
qwen3:latest                 6/8 weighted=8/12  avg=5897ms load=3774ms
llama3.1:8b                  4/8 weighted=8/12  avg=2780ms load=6284ms
mistral:7b                   3/8 weighted=5/12  avg=1099ms load=5842ms
```

Recommended by benchmark:

```text
qwen2.5:7b
```

Direct excluded-model check:

```bash
npm run benchmark:ollama -- --models=qwen2.5-coder:7b --include-excluded
```

Result:

```text
qwen2.5-coder:7b 6/8 weighted=10/12 avg=2786ms load=4795ms
```

It did not beat `qwen2.5:7b`, and it still rewrote protected-looking technical/casual spans, so it remains hidden from the normal writing model picker.

## Verification Already Run

From `/home/zazzn/opengrammar/opengrammar/extension`:

```bash
npm run benchmark:ollama
npm run build
npm run simulate:protected
npm run simulate:inline
```

Results:

- `npm run build` passed.
- `npm run simulate:protected` passed: protected-text checks passed, 10 cases.
- `npm run simulate:inline` passed enforced checks with 0 enforced failures and 0 false positives.
- `simulate:inline` still reports 2 known limitations:
  - `the leaves turned borwn in autumn` still chooses `born` because bigram context is insufficient.
  - `i havnt tested it yet` still gets bad Harper candidates because Harper does not offer `haven't`.

Build output path:

- `/home/zazzn/opengrammar/opengrammar/extension/dist`

After each build, the user must manually reload the unpacked extension in Chrome from:

```text
/home/zazzn/opengrammar/opengrammar/extension/dist
```

Browser automation cannot safely navigate `chrome://extensions` for the user, so manual reload is expected.

## Research Notes

Primary sources checked:

- Ollama API docs: `https://github.com/ollama/ollama/blob/main/docs/api.md`
- Qwen3 docs: `https://github.com/QwenLM/Qwen3`
- Qwen2.5 release notes: `https://qwenlm.github.io/blog/qwen2.5/`

Findings:

- Ollama supports native `/api/pull` with `stream: false`, which is used by `ollamaPull`.
- Qwen3 supports thinking/non-thinking control. The extension injects `/no_think` for Qwen3 proofreading calls.
- Qwen2.5 general language models are distinct from Qwen2.5-Coder and Qwen2.5-Math specialist models.

## Testing Plan For Suggestion And Ignore Improvements

Build a real-world corpus of 50 to 100 cases and add failures into scripts over time.

Required categories:

- Normal spelling: `recieved`, `definately`, `adress`
- Context spelling: `there/their/they're`, `its/it's`, `your/you're`
- Casual/chat text: `lol`, `whadda`, `Whaddada`, `gonna`, `ya`, `noob`
- Technical text: URLs, domains, file paths, commands, package names
- Automotive/forum text: `2JZ`, `NA-T`, `700hp`, `VVTI`, `6spd`
- Capitalization: sentence starts, standalone `i`, product names
- Bad local suggestions: `havnt -> haunt`
- Whole-sentence fixes with multiple errors
- No-change cases

For each case, record:

```text
Input:
Expected behavior:
Actual underline:
Actual popup suggestion:
Actual LLM correction:
Should be: quick-fix / sentence-review / ignore
Pass/fail:
Notes:
```

Failure buckets:

- `bad-local-suggestion`
- `needs-context`
- `bad-llm-correction`
- `overcorrection`
- `protected-span-failure`
- `ui-confusing`

Expected output after testing:

- Add to protected/ignore rules
- Route to sentence review instead of quick-fix
- Prompt/model failures needing tuning

## Known Issues / Watch Points

- `qwen2.5:7b` can still raw-suggest changes like `Whaddada -> Whadda ya` or `700hp -> 700 hp`, but app-level protected span validation should block these from being shown/applied where protected spans are detected.
- The protected list will need expansion from real user examples. Do not try to manually enumerate every possible string; add broad but controlled protected-span patterns.
- Do not allow ambiguous one-word spell suggestions to bypass sentence review.
- Keep quick-fix limited to high-confidence mechanical fixes.
- Keep LLM correction mode conservative. Tone/polish should remain explicit user actions.
- The popup model ranking is not permanent truth. Re-run `npm run benchmark:ollama` when model list, prompts, or protected rules change.
- Existing docs about backend deployment may not reflect the active backendless extension path.

## Suggested Next Steps

1. Reload the extension from `/home/zazzn/opengrammar/opengrammar/extension/dist` and manually test the popup model list.
2. Confirm `qwen2.5-coder:7b` is hidden and `qwen2.5:7b` is labeled recommended.
3. Test slow Ollama loading by unloading the model, then opening sentence review on a forum text field.
4. Confirm the review card stays visible during cold model load and shows retry/error on failure.
5. Start building the 50 to 100 case suggestion/ignore corpus.
6. Add new failing cases to `simulate-protected.mjs`, `simulate-inline.mjs`, and `benchmark-ollama-writing-models.mjs`.
7. Commit once manual Chrome testing confirms the current behavior.

## Common Commands

```bash
cd /home/zazzn/opengrammar/opengrammar/extension

npm run build
npm run simulate:protected
npm run simulate:inline
npm run benchmark:ollama
npm run benchmark:ollama -- --models=qwen2.5-coder:7b --include-excluded
```

Check Ollama models:

```bash
curl -s http://localhost:11434/api/tags
```

Check repo state:

```bash
git -C /home/zazzn/opengrammar status --short
git -C /home/zazzn/opengrammar diff --stat
```
