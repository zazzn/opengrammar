# Suggestion Testing Run

Last updated: 2026-06-01

This records the first executed pass of the suggestion/ignore-list testing plan.

## Parallel Workstreams

Three subagents were assigned sidecar audits while the main thread created and ran the test harness:

- Protected/ignore-list audit: reviewed protected span coverage and proposed missing categories.
- Suggestion-routing audit: reviewed quick-fix vs sentence-review vs suppress decisions.
- UI/model audit: reviewed Ollama picker behavior, pull behavior, and slow-load review-card risks.

The main thread owned executable artifacts, integration of findings, and verification.

## New Test Artifacts

- Corpus: `/home/zazzn/opengrammar/opengrammar/extension/test-data/suggestion-corpus.json`
- Runner: `/home/zazzn/opengrammar/opengrammar/extension/scripts/test-suggestion-corpus.mjs`
- NPM command: `npm run test:suggestions`

The corpus currently has 68 cases and checks:

- protected span coverage
- no-issue ignore behavior
- quick-fix routing
- sentence-review routing
- known-gap tracking
- manual UI/model cases

Known gaps are expected failures that should remain visible without breaking the build. Enforced failures should be treated as regressions.

## Code Changes From This Run

- Added full Ollama/model-tag protection for tags such as `qwen2.5:7b`, `qwen3:latest`, and `qwen2.5-coder:7b` in `/home/zazzn/opengrammar/opengrammar/extension/src/shared/protectedText.ts`.
- Expanded command trigger matching so `Try ollama pull ...` is treated like command-like text.
- Added `teh -> the` as a common spelling override in `/home/zazzn/opengrammar/opengrammar/extension/src/background/harperEngine.ts`.
- Adjusted quick-fix policy so safe high-confidence override suggestions like `teh -> the` can be quick fixes in `/home/zazzn/opengrammar/opengrammar/extension/src/background/issuePolicy.ts`.

## Current Results

Latest suggestion corpus run:

```text
Suggestion corpus: 68 cases, 142 checks
Pass: 112  Known gaps: 30  Failures: 0
```

Bucket summary:

```text
bad-local-suggestion         pass= 0 gap= 2 fail= 0
ignore                       pass=17 gap= 0 fail= 0
protected-span               pass=48 gap= 0 fail= 0
protected-span-failure       pass=16 gap=28 fail= 0
quick-fix                    pass=22 gap= 0 fail= 0
sentence-review              pass= 7 gap= 0 fail= 0
ui-confusing                 pass= 2 gap= 0 fail= 0
```

Existing regression checks:

```text
npm run simulate:protected  -> passed, 10 cases
npm run simulate:inline     -> passed, 0 enforced failures, 2 known limitations
npm run build               -> passed
```

Latest Ollama benchmark:

```text
Recommended by benchmark: qwen2.5:7b
```

The latest local benchmark still recommends `qwen2.5:7b`: it tied the top weighted score and was much faster than the other top-scoring models.

## Current Known Gaps

Bad local suggestion/context gaps:

- `the leaves turned borwn in autumn` still quick-fixes to `born`; should be `brown` or sentence-review.
- `I havnt tested it yet` routes to sentence-review but the local candidate is still `haunt`; LLM should provide `haven't`.

Protected-span gaps now captured in the corpus:

- Docker/image tags: `postgres:16-alpine`
- Unscoped package install args: `tailwindcss`, `autoprefixer`
- Windows paths with spaces
- UNC paths
- `%APPDATA%` and `$HOME` paths
- Shell/admin command chains: `sudo systemctl ... && journalctl ...`
- BBCode quote blocks
- Lowercase automotive shorthand: `2jz-gte`, `vvti`, `na-t`
- Keyboard shortcuts: `Ctrl+Shift+P`, `Win+R`
- Dates/times/time zones
- Phone numbers
- Currency and percent expressions
- CSS custom properties, hex colors, and class selectors
- Log lines and timestamps
- Street addresses

UI/model manual cases captured:

- Model dropdown hides code models and labels `qwen2.5:7b` recommended.
- Popup auto-switches away from hidden/unavailable model.
- Pull button installs `qwen2.5:7b` when missing.
- Cold-load sentence review card remains visible.
- Failed/timeout model calls show retry/close instead of disappearing.
- Small form fields keep the assistant bubble out of the way.

## Commands To Reproduce

```bash
cd /home/zazzn/opengrammar/opengrammar/extension

npm run test:suggestions
npm run simulate:protected
npm run simulate:inline
npm run benchmark:ollama
npm run build
```

## Next Improvement Queue

1. Add protected rules for the 28 protected-span known gaps.
2. Improve context ranking or route policy for `borwn` in “turned brown in autumn”.
3. Add candidate shaping for `havnt -> haven't` so sentence review gets the right target.
4. Add cancellation/close affordance to the checking card while waiting on long Ollama calls.
5. Guard against overlapping `CORRECT_TEXT` callbacks updating stale review cards.
6. Expand the LLM benchmark corpus before changing the model recommendation again.
7. Run the manual UI/model checklist in Chrome after reloading `/home/zazzn/opengrammar/opengrammar/extension/dist`.
