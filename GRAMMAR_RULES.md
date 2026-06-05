# 📚 Contributing Grammar & Style Rules

We want OGrammar to catch the mistakes that matter while staying fast and private. This
guide explains how grammar checking works now and how you can help improve it.

## How Rules Work

OGrammar uses a **two-tier engine** (shared by the browser extension and the desktop app):

1. **Harper (local, instant):** on-device spelling, grammar, punctuation, capitalization,
   and style via the [Harper](https://writewithharper.com) engine — no network, no key.
2. **LLM tier (optional, BYOK):** whole-sentence/context review and tone rewriting via your
   own provider key. Its findings are merged with Harper's and de-duplicated (Harper wins on
   overlap).

There is **no backend and no standalone RegEx rule file** — the legacy rule-based engine was
replaced by Harper. The logic lives in the extension at
`opengrammar/extension/src/background/`:

- `harperEngine.ts` — wraps the Harper WASM engine (the local checks)
- `issuePolicy.ts` — routes/filters issues (`quick-fix` vs `sentence-review` vs `suppress`)
- `llmClient.ts` — the LLM prompt and result-normalisation logic

The desktop app mirrors this in Rust (`desktop/ograms-engine/src/llm.rs`). See
[docs/13-architecture.md](docs/13-architecture.md) for the full picture.

## How to Contribute

You don't need to be an expert developer to help!

### Option 1: Suggest a Rule (Non-Developers)
If you know a common mistake OGrammar misses (or a false positive it raises):
1. Go to the **Issues** tab.
2. Choose the **"Grammar Rule Suggestion"** template.
3. Provide the incorrect text, the correction, and the reason.

### Option 2: Submit a Pull Request (Developers)
1. Decide which tier the change belongs in — a local mechanical check (Harper-side handling
   in `harperEngine.ts` / routing in `issuePolicy.ts`) or context/sentence behaviour
   (`llmClient.ts`).
2. Make the change. If you touch the LLM prompt, routing, or protected-text rules, **mirror
   it in the desktop engine** (`desktop/ograms-engine/src/llm.rs`) to keep parity.
3. Run `bun x tsc --noEmit` in `opengrammar/extension` (and `cargo test` for desktop changes).
4. Submit your PR with a clear description and an example before/after.

## Categories We Care About

- **Common misspellings** (e.g., "recieve" → "receive")
- **Confused words** (e.g., "affect" vs "effect")
- **Redundant phrases** (e.g., "at this point in time" → "now")
- **Style & clarity** (e.g., trimming excessive "very")
- **Punctuation & spacing** (commas, apostrophes, double spaces)

---

**Thank you for helping us make OGrammar better for everyone!**
