# 🗺️ OGrammar Roadmap

OGrammar is a privacy-first, local-first writing assistant in **two products** — a
**browser extension** and a **Windows desktop app** — sharing one Harper + LLM engine.
This roadmap reflects the current state of the *fork* (see [`NOTICE`](NOTICE)); it is a
living document.

> For what the products are, see [docs/30-products-overview.md](docs/30-products-overview.md).

---

## ✅ Shared engine (shipped)

- [x] **Harper** as the local engine (replaced the upstream RegEx/dictionary engine) —
  spelling, grammar, punctuation, capitalization, style, on-device.
- [x] **LLM context tier** (BYOK): OpenAI, DeepSeek, Groq, OpenRouter, Together, Ollama.
- [x] **Merge/de-dup** of LLM findings with Harper (Harper wins on overlap).
- [x] **Confidence routing** — quick-fix (high-confidence mechanical) vs. sentence-review.
- [x] **Protected-text masking** before LLM calls.
- [x] **Engine parity** — desktop `ograms-engine` (Rust) ports the extension's LLM core.
- [x] Local n-gram context re-ranker; encrypted API-key storage.

---

## 🧩 Browser Extension

**Shipped**
- [x] Manifest V3 (React + Vite); local-first; key in `chrome.storage`; no backend DB.
- [x] Inline underlines for inputs, textareas, and rich/contenteditable editors.
- [x] **Proactive sentence review** + non-destructive review card.
- [x] **Autocomplete** (context-aware next-words).
- [x] **Tone rewriting** + custom prompts.
- [x] Writing statistics; custom dictionary; per-site disable.
- [x] **Autocorrect** *(opt-in)* — high-confidence auto-apply with revert-learning
  (persisted via `chrome.storage.sync`).
- [x] Options page; multi-provider; optional self-hosted backend (Hono edge) + Docker.

**In progress / planned**
- [ ] Robustness in complex contenteditable editors (ongoing).
- [ ] Better Google Docs coverage.
- [ ] Firefox / Safari (WebExtensions) ports.

---

## 🖥️ Desktop App (Windows) — **shipped**

> Previously listed as "Phase 4 / planned" upstream; it is now **built and shipping on Windows.**

**Shipped**
- [x] Native Rust app (no Electron): `ograms-engine` + `ograms-hotkey`.
- [x] Reads the focused field via UI Automation (skips password fields; not a keylogger).
- [x] Global hotkey (`Ctrl+Alt+J`) one-shot full correction.
- [x] **Proactive monitoring + true OS overlay underlines** (red Harper / blue-dotted LLM),
  whole-word clickable, tracking window moves.
- [x] **Click-to-fix card** — kicker + reason + candidates + Dismiss; light-dismiss;
  on-screen clamping (flips above the word near the bottom edge).
- [x] **Autocorrect** *(opt-in)* — iPhone-style, freshly-typed only, revert-learning ledger.
- [x] **LLM rewrite pill** — Polish / Formalize / Casual with a **preview → Apply/Cancel**.
- [x] System tray (state icon + Pause/Settings/Quit); skinned pure-Win32 settings window.
- [x] Per-app exclusion (browsers excluded by default); DPAPI-encrypted key; autostart.
- [x] Per-monitor-V2 DPI; correct on mixed-resolution monitors.

**In progress / planned**
- [ ] **Phase 2 deeper capture** — Electron/IA2 activation + privacy gate for apps with
  limited UIA accessibility.
- [ ] **Selection-scoped rewrite** — rewrite only highlighted text (today: whole field).
- [ ] Residual false-positive guards (proper-noun / capitalization edge cases).
- [ ] Packaging + installer + code signing; auto-update.
- [ ] macOS / Linux exploration.

---

## 🤝 How to help

Pick an item above, read [CONTRIBUTING.md](CONTRIBUTING.md), branch, and open a PR.
Bugs/ideas → GitHub Issues / Discussions.

---

*This roadmap describes the fork. The original OpenGrammar roadmap and history remain with
the [upstream project](https://github.com/swadhinbiswas/opengrammar).*
