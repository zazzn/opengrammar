# OGrammar — Two Products

OGrammar now ships as **two distinct products** that share one grammar/LLM engine
but run in completely different places:

| | **1. Browser Extension** | **2. Desktop App** |
|---|---|---|
| **Where it runs** | Chrome / Brave / Edge (Manifest V3) | Windows, OS-wide (any native text field) |
| **Tech** | TypeScript + React + Vite | Rust (native, no Electron) |
| **Covers** | Web apps — Gmail, Google Docs, Notion, Reddit, web editors | Notepad, Word, Slack desktop, native chat/IDE fields, anywhere you type |
| **Source** | `opengrammar/extension/` | `desktop/` (`ograms-engine` + `ograms-hotkey`) |
| **Status** | Shipping | Shipping (Windows) |

They are **de-conflicted**: the desktop app **excludes browsers by default**, so the
extension owns the browser and the desktop app owns everything else. Run both for
end-to-end coverage of everywhere you write.

---

## What they share

Both products run the **same two-tier engine**:

1. **Harper (local, instant):** the [Harper](https://writewithharper.com) grammar/
   spell engine runs 100% on-device — no network, no account. Catches spelling,
   grammar, punctuation, capitalization, and style issues immediately.
2. **LLM context tier (optional, BYOK):** plug in your own API key (OpenAI, DeepSeek,
   Groq, OpenRouter, Together, or local Ollama) for context/sentence-level review.
   The model's findings are **merged with Harper's, de-duplicated (Harper wins on
   overlap)**, and shown as a separate layer.

The LLM correction logic — the system prompt, the structured-correction
normaliser, the diff fallback, and protected-text masking — is **kept at parity**
across both products. The desktop's `ograms-engine` (Rust) is a direct port of the
extension's LLM core, so a fix in one is mirrored in the other.

**Privacy is identical in spirit:** local-first, bring-your-own-key, no telemetry
of your text, and the key is stored encrypted at rest (extension: `chrome.storage`;
desktop: Windows DPAPI in `%APPDATA%\OGrammar`).

---

## 1. Browser Extension

A Grammarly-style assistant inside the browser. Highlights:

- **Inline underlines** in inputs, textareas, and rich/contenteditable editors.
- **Quick-fix vs. sentence-review routing:** high-confidence mechanical fixes
  (capitalization, punctuation, small-edit spelling) are offered as one-click
  quick-fixes; everything contextual is shown in a non-destructive **review card**.
- **Proactive sentence review** (LLM tier) layered on top of Harper.
- **Autocomplete** — context-aware next-words as you type.
- **Tone rewriting** — formal / casual / professional / concise / etc.
- **Autocorrect** *(opt-in)* — auto-applies only high-confidence fixes as you type,
  with **revert-learning**: undo a fix and that word is never auto-corrected again
  (persisted via `chrome.storage.sync`, so it follows you across signed-in profiles).
- Writing statistics, custom dictionary, per-site disable, protected-text masking.

→ Setup: [04-browser-extension-setup.md](04-browser-extension-setup.md) ·
Usage: [09-using-opengrammar.md](09-using-opengrammar.md)

## 2. Desktop App (OS-wide)

A native Windows proofreader that works in **any** focused text field via UI
Automation — not just the browser. Highlights:

- **True OS overlay underlines** — a transparent, click-through layered window draws
  red (Harper) and blue-dotted (LLM) underlines directly under the flagged words in
  whatever app you're typing in. They track the window as it moves.
- **Click-to-fix card** — click an underlined word for a card with the issue kicker,
  the "why", and candidate corrections (or an AI suggestion). Click outside to dismiss.
- **Autocorrect** *(opt-in)* — the same iPhone-style behavior as the extension:
  auto-applies high-confidence fixes on freshly-typed text, with revert-learning.
- **LLM rewrite pill** — a "Rewrite" pill at the field corner → **Polish / Formalize /
  Casual** → shows a **preview** of the rewritten text with Apply / Cancel (nothing is
  applied until you approve it).
- **Global hotkey** (`Ctrl+Alt+J`) — one-shot full correction of the focused field.
- **System tray** with state icon + pause/settings/quit, and a skinned pure-Win32
  **settings window** (provider, model, dialect, API key, per-app exclusions, autostart).
- **Per-app exclusion** — browsers excluded by default (extension owns them); add any
  app you don't want checked.
- Per-monitor DPI aware; works across mixed-resolution monitors.

→ Detail: [31-desktop-app.md](31-desktop-app.md) · README: [`desktop/README.md`](../desktop/README.md)

---

## Which one do I use?

- **In the browser?** The **extension**.
- **In a native app** (Word, Notepad, Slack desktop, a chat box, an IDE comment)? The
  **desktop app**.
- **Both installed?** You get everywhere — and they won't step on each other, because
  the desktop app yields browser windows to the extension.

---

*Fork note: OGrammar is a modified fork of [OpenGrammar](https://github.com/swadhinbiswas/opengrammar)
(Apache-2.0). See [`NOTICE`](../NOTICE) for the list of modifications.*
