# ograms-engine

The native grammar + LLM engine for **OGrammar Desktop** (see
[`../README.md`](../README.md) and [`../../docs/30-products-overview.md`](../../docs/30-products-overview.md)).
As a **library** it also provides the LLM correction core — the system prompt,
structured-correction normaliser, diff fallback, protected-text masking, and the
tone-`llm_rewrite` engine — kept at parity with the extension's LLM logic and consumed by
the `ograms-hotkey` app. As a **CLI** (below) it runs the local Harper checker.

The default mode runs `harper-core` with the same local-checking lint toggles as
`extension/src/background/harperEngine.ts`:

- `FillerWords`, `RepeatedWords`, `DiscourseMarkers`: enabled
- `Readability`, `LongSentences`, `BoringWords`: disabled

The engine emits JSON issues with character offsets and UTF-16 offsets.

## CLI

```sh
cargo run --release -- --text "I recieved teh package."
echo "I recieved teh package." | target/release/ograms-engine
```

Flags:

```sh
--dialect american|british|canadian|australian
--spell-engine harper|symspell|combined
--dictionary-path ../../opengrammar/extension/public/dict/frequency_dictionary_en_82_765.txt
--context-model-path ../../opengrammar/extension/public/ngram/model.bin
--no-protect
```

`--spell-engine harper` is the default and preserves the native Harper behavior.

Protected-text filtering is enabled by default. It drops Harper issues whose
character span overlaps URLs, paths, code-like tokens, secrets, versions/IDs,
commands, chat slang, and other spans mirrored from the extension's
`protectedText.ts`. Use `--no-protect` to disable this filter for A/B parity
runs.

`--spell-engine symspell` still uses Harper for detection, but replaces spelling
lint suggestions with Norvig/SymSpell-style edit-distance candidates from the
frequency dictionary, ranked by the optional n-gram context model.

`--spell-engine combined` uses Harper suggestions first, appends unique SymSpell
candidates, and lets the context ranker promote a challenger only when the model
has a clear win. If the dictionary or model path is missing, it falls back to the
available Harper-only behavior.

## Parity Harness

The parity harness reads:

- `opengrammar/extension/test-data/suggestion-corpus.json`
- `opengrammar/extension/scripts/fp-harness.mjs` corpus formats
- `opengrammar/extension/scripts/.fp-corpora/*.json`

It pipes each sentence to the native engine, parses the JSON output, and reports:

- `MATCHES`: native output satisfied the extension corpus expectation.
- `REGRESSIONS`: the extension corpus expected a catch or correction that native missed.
- `IMPROVEMENTS`: native flagged an expected-error case that has no explicit local issue, or beat a known-gap expectation.
- `FALSE POSITIVES`: native emitted any issue for text marked clean/protected.

Run from `desktop/ograms-engine`:

```sh
cargo build --release
node scripts/parity-check.mjs --spell-engine harper
node scripts/parity-check.mjs --spell-engine symspell
node scripts/parity-check.mjs --spell-engine combined
```

When the binary already exists:

```sh
node scripts/parity-check.mjs --skip-build --spell-engine combined
node scripts/parity-check.mjs --skip-build --spell-engine harper --no-protect
```

For a debug binary:

```sh
node scripts/parity-check.mjs --skip-build --binary target/debug/ograms-engine --spell-engine harper
```

Add `--json` to include the full machine-readable result payload after the text
summary.
