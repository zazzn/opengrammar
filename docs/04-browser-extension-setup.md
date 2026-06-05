# Browser Extension Setup

Install and configure the **OGrammar browser extension** on Chromium browsers
(Chrome, Brave, Edge). This is **product 1** of two — for OS-wide checking on
Windows, see [OGrammar Desktop](31-desktop-app.md).

The extension is loaded **unpacked** from a local build (it is not yet on the
Chrome Web Store), so you build it once and load the `dist/` folder.

---

## Supported browsers

| Browser | Status |
|---------|--------|
| **Google Chrome** (88+) | Supported |
| **Brave** (1.20+) | Supported |
| **Microsoft Edge** (88+) | Supported |
| Other Chromium browsers (Opera, Vivaldi) | Should work via "Load unpacked" (untested) |
| **Firefox / Safari** | Not yet — WebExtensions ports are on the [roadmap](../ROADMAP.md) |

---

## Build the extension

From the repository root:

```bash
cd opengrammar/extension
bun install        # Bun is preferred; Node 18+ also works
bun run build      # production build → dist/
```

This produces a `dist/` folder containing the built extension. Rebuild after pulling
changes (`bun run dev` gives you a watch build during development).

---

## Load it in your browser

The steps are the same for Chrome, Brave, and Edge — only the address differs.

1. Open the extensions page:
   - Chrome: `chrome://extensions/`
   - Brave: `brave://extensions/`
   - Edge: `edge://extensions/`
2. Enable **Developer mode** (toggle, top-right; left sidebar on Edge).
3. Click **Load unpacked**.
4. Select the `opengrammar/extension/dist` folder.
5. The OGrammar icon appears in your toolbar.

**Pin it (optional):** click the puzzle-piece (Extensions) icon and pin OGrammar so
the icon is always visible.

---

## Configure

OGrammar works immediately with the local **Harper** engine — no key required. To
enable the optional **LLM tier** (context/sentence review and tone rewriting), add a
provider key:

1. Right-click the OGrammar icon → **Options**.
2. Choose a **Provider**:
   - **Groq** — fast, has a free tier
   - **OpenAI** — high quality, paid
   - **DeepSeek**, **OpenRouter**, **Together** — alternatives
   - **Ollama** — local/offline, no key
   - **Custom** — any OpenAI-compatible endpoint
3. Enter your **API key** (skip for Ollama), then pick a **Model**.
4. For **Ollama** or **Custom**, set the **base URL** of your endpoint.

The extension calls your chosen provider directly with your key — **there is no
backend service to run or configure**. See [07-ai-providers.md](07-ai-providers.md)
for per-provider setup and model recommendations.

---

## Verify it works

1. Open any text box (Gmail, Google Docs, Notion, a web editor).
2. Type a mistake, e.g. `i recieved teh package`.
3. A **red underline** marks the issue. Click it and apply the fix.
4. If you added an AI key, contextual/sentence suggestions appear as a separate
   **blue-dotted** layer on top of Harper's.

---

## Extension features

### Toolbar popup
Click the icon for a quick popup: enable/disable, issue count, and shortcuts to
**Options** and **Statistics**.

### Options page
Right-click the icon → **Options**:

- **General** — enable OGrammar, check-as-you-type, **Autocorrect** (opt-in).
- **AI** — provider, API key, model, custom base URL.
- **Writing preferences** — toggle issue categories (grammar, spelling, punctuation,
  style/tone, clarity).
- **Site settings** — disable OGrammar on specific domains.
- **Custom dictionary** — add words OGrammar should never flag; import/export.
- **Ignored issues** — review and clear dismissed suggestions.
- **Data** — export/import settings, reset to defaults.

### Underlines

| Color | Source | Meaning |
|-------|--------|---------|
| **Red (solid)** | Harper (local) | Spelling / grammar / punctuation / capitalization / style |
| **Blue (dotted)** | LLM tier (optional) | Context / sentence-level suggestions |

LLM findings are merged with Harper's and de-duplicated — **Harper wins on overlap**.

---

## Updating

This is a locally-loaded extension, so it does not auto-update. To update:

```bash
cd opengrammar/extension
bun run build
```

Then reload it on the extensions page (click the reload icon on the OGrammar card).

---

## Troubleshooting

**No icon?** Open the extensions page, confirm OGrammar is enabled, and pin it via the
puzzle-piece menu.

**No underlines?** Confirm the extension is enabled and the site isn't in your disabled
list, then reload the page. Check the page console (F12) for errors.

**AI suggestions not appearing?** Verify your provider/model and API key in Options. For
Ollama/Custom, confirm the base URL is reachable.

See [18-troubleshooting.md](18-troubleshooting.md) for the full guide.

---

## Related

- [Using OGrammar](09-using-opengrammar.md) — daily usage
- [AI providers](07-ai-providers.md) — provider setup
- [OGrammar Desktop](31-desktop-app.md) — OS-wide checking on Windows
