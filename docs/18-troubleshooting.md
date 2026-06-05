# Troubleshooting

Fixes for common issues with the **OGrammar browser extension**. For desktop-app issues,
see [OGrammar Desktop](31-desktop-app.md).

---

## Quick checks

If something isn't working, start here:

1. **Reload the extension** — `chrome://extensions/` → click the reload icon on OGrammar.
2. **Refresh the page** — `F5` / `Ctrl+R`.
3. **Confirm it's enabled** — and that the current site isn't in your disabled list
   (Options → Site settings).

---

## No underlines appear

**Symptoms:** you type text with mistakes but see no red (or blue-dotted) underlines.

**Causes & fixes:**

- **Extension disabled** — click the icon and make sure OGrammar is on.
- **Site disabled** — Options → Site settings → check the current domain isn't disabled.
- **Non-editable target** — OGrammar checks `<input>`, `<textarea>`, and
  `[contenteditable]` fields. It can't check PDFs, images, or non-editable text.
- **Page needs a reload** — reload after enabling the extension or changing settings.
- **Check the page console** — `F12` → Console for errors.

> Remember: red/blue **Harper** underlines appear even with **no API key**. If you see
> red underlines but no blue-dotted ones, that's expected unless you've configured an AI
> provider.

---

## AI suggestions don't appear

**Symptoms:** Harper underlines work, but the LLM context layer (blue-dotted) never shows.

The LLM tier is optional and needs a provider key.

- **Check provider, model, and key** — Options → confirm the **Provider** and **Model**
  are set and the **API key** has no stray spaces. Key prefixes:
  - Groq: `gsk_`
  - OpenAI: `sk-`
  - OpenRouter: `sk-or-`
- **Ollama / Custom** — confirm the **base URL** is reachable:
  - Ollama: `http://localhost:11434/v1`, with Ollama running (`ollama serve`).
  - Custom: your endpoint's OpenAI-compatible `/v1` base.
- **Rate limits** — free tiers are capped (e.g. Groq). If you hit a limit, wait or switch
  providers. Harper keeps working regardless.

### Test your key directly

```bash
# Groq (use a current model name from console.groq.com/docs/models)
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer gsk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"test"}]}'

# OpenAI
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"test"}]}'
```

A `401`/`invalid_api_key` means the key is wrong; a `model_not_found` means the model name
is stale — pick a current one.

---

## Rewrite isn't working

**Symptoms:** the rewrite bubble doesn't appear, or rewriting errors out.

- **Select editable text first** — the rewrite bubble appears next to a selection inside
  an editable field.
- **AI provider required** — rewriting uses the LLM tier; set a provider/key in Options.
- **Reload the page** if the bubble doesn't show after selecting.

---

## Slow performance

- **Long text** — very large fields take longer; the LLM tier adds provider latency.
- **Use a faster provider** — Groq is typically fastest for the LLM tier.
- **Local Ollama too large** — pick a smaller model for your hardware (see
  [07-ai-providers.md](07-ai-providers.md) and the
  [model benchmark](25-local-llm-model-benchmark.md)).
- **Use Harper only** — clear the AI provider/key to run purely on-device (fast, offline).

---

## False positives

**Symptoms:** correct words (names, technical terms, jargon) are flagged.

- **Add to dictionary** — click the word's card → **Add to dictionary**, or bulk-add in
  Options → Custom dictionary.
- **Tune categories** — Options → Writing preferences lets you disable categories (e.g.
  Style & tone) globally.

> OGrammar's residual false-positive work is tracked in the
> [false-positive audit](24-og-rewrite-false-positive-audit.md).

---

## Settings won't save

- **Storage permission** — `chrome://extensions/` → OGrammar → Details → confirm storage
  isn't blocked.
- **Reset** — Options → Data → reset to defaults, then reconfigure. Export first if you
  want a backup.

---

## Extension crashes or won't open

- **Reload it** — `chrome://extensions/` → reload OGrammar.
- **Check the console** — right-click the popup → Inspect → Console.
- **Rebuild** — from the repo root:
  ```bash
  cd opengrammar/extension
  rm -rf dist node_modules
  bun install
  bun run build
  ```
  Then reload it on the extensions page.
- **Try a clean profile** — to rule out conflicts with other extensions.

---

## Still stuck?

Gather this before asking for help (never share your API key):

- Extension version (`chrome://extensions/`) and browser version
  (`chrome://settings/help`).
- Console errors (`F12` → Console).
- The provider and model you selected.

Then search or open a [GitHub issue](https://github.com/swadhinbiswas/opengrammar/issues),
or ask in [Discussions](https://github.com/swadhinbiswas/opengrammar/discussions).

---

## Related

- [Quick start](01-quick-start.md)
- [Browser setup](04-browser-extension-setup.md)
- [AI providers](07-ai-providers.md)
- [FAQ](19-faq.md)
