# 🗺️ OGrammar Roadmap

OGrammar is a privacy-first, local-first writing-assistant **browser extension** built on
one Harper + LLM engine. This roadmap reflects the current state of the *fork* (see
[`NOTICE`](NOTICE)); it is a living document.

---

## ✅ Engine (shipped)

- [x] **Harper** as the local engine (replaced the upstream RegEx/dictionary engine) —
  spelling, grammar, punctuation, capitalization, style, on-device.
- [x] **LLM context tier** (BYOK): OpenAI, DeepSeek, Groq, OpenRouter, Together, Ollama.
- [x] **Merge/de-dup** of LLM findings with Harper (Harper wins on overlap).
- [x] **Confidence routing** — quick-fix (high-confidence mechanical) vs. sentence-review.
- [x] **Protected-text masking** before LLM calls.
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
- [x] Options page; multi-provider; calls LLM providers directly (no backend).

**In progress / planned**
- [ ] Robustness in complex contenteditable editors (ongoing).
- [ ] Better Google Docs coverage.
- [ ] Firefox / Safari (WebExtensions) ports.
- [ ] Residual false-positive guards (proper-noun / capitalization edge cases).

---

## 🤝 How to help

Pick an item above, read [CONTRIBUTING.md](CONTRIBUTING.md), branch, and open a PR.
Bugs/ideas → GitHub Issues / Discussions.

---

*This roadmap describes the fork. The original OpenGrammar roadmap and history remain with
the [upstream project](https://github.com/swadhinbiswas/opengrammar).*
