# Proactive Proofreader Testing

OpenGrammar needs testing that looks like real writing, not only isolated words.
The current goal is to expose whether the workflow feels useful before we tune
more rules.

## Interactive Playground

Path:

`opengrammar/extension/public/playground/qa.html`

Run the extension dev server or build/preview, then open the playground over an
HTTP origin so the installed extension content script can run against it.

Suggested local flow:

```bash
cd opengrammar/extension
npm run dev
```

Open:

`http://localhost:5173/playground/qa.html`

Load the unpacked extension from:

`opengrammar/extension/dist`

The page includes:

- forum reply textarea
- email compose subject/body
- contenteditable tech notes
- seeded scenarios for casual forum posts, email, tech notes, slang, and
  protected spans
- browser spellcheck toggle
- diagnostics snapshot panel for copying test context into issues or notes

## What To Watch

For each scenario, check:

- Local underlines appear quickly for deterministic issues.
- The AI review badge appears even when local finds no issues.
- Configured LLM sentence review finds context-only issues.
- Protected spans are not underlined or changed.
- Accept applies only when the current text still matches the suggestion span.
- Skip and dismiss do not cause repeated annoyance.
- Polish/Formal/Casual stays inside the viewport.
- Chrome native spellcheck does not visually fight OGrammar too much.

## Suggested Release Gates

- Protected text leakage: 0.
- LLM calls from protected-only fields: 0.
- Local detection p95 under normal typing: under 50 ms.
- AI review request should debounce after typing pause, target 900-1500 ms.
- False positives tracked per 1,000 clean words by category.
- No corpus regression without explicit approval.
- Block releases on harmful rewrite or privacy regression.

## Next Test Work

Add generated corpora for:

- messy forum replies
- customer emails
- technical notes and stack traces
- protected text and commands
- casual/slang posts
- clean control samples

Then add browser automation around the playground:

- type into each field
- wait for local underline
- click AI review
- accept/skip suggestions
- verify text changes and protected spans
- capture screenshots for visual regressions
