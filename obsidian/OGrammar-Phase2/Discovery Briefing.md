---
tags: [ogrammar, phase-2, discovery]
owner: Discovery
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

I now have a complete, factual picture. Here is the briefing.

---

# OGrammar — Extension & Web Discovery Briefing (Phase 2, Goal 1)

## 1. Manifest & Chrome Web Store review surface
`extension/manifest.json` — Manifest V3, **name "OGrammar", version 0.9.0**, description: *"Your privacy-first, open-source writing assistant. Check grammar, spelling, and style everywhere on the web."*
- **permissions:** `storage`, `activeTab`, `scripting` (all low-risk, justifiable).
- **host_permissions:** `<all_urls>` — the big review-friction item. CWS requires a written justification ("checks text in any editable field on any site"); pairs with three content scripts also matched on `<all_urls>` + `all_frames:true`. Expect manual review and a strict privacy-disclosure step.
- **content_scripts:** generic `src/content/index.ts` on all URLs, plus site-specific `google-docs.ts` (docs.google.com) and `gmail.ts` (mail.google.com).
- **background:** ES-module service worker `src/background/index.ts`, `type:"module"`.
- **CSP:** `script-src 'self' 'wasm-unsafe-eval'` — needed for the Harper WASM engine; allowed in MV3 but a reviewer flag to anticipate.
- **action/popup:** `src/popup/index.html`; **options_ui** `src/options/index.html` (`open_in_tab`). Icons 16/48/128 declared (present in `extension/public/`).
- **web_accessible_resources:** WASM, n-gram `model.bin`, SymSpell `frequency_dictionary_en_82_765.txt` exposed to `<all_urls>`.
- Built via Vite + `@crxjs`; output already in `extension/dist/`. License Apache-2.0.

## 2. Current branding (what to make "completely different")
`extension/public/icon.svg` is literally commented *"OpenGrammar Logo — Quill + checkmark in indigo circle"*: a **white quill pen on an indigo→violet gradient circle (#4F46E5 → #7C3AED)** with a small `#EEF2FF` checkmark badge.
- **Color system everywhere is Indigo/Violet.** `popup.css` header comment: *"OpenGrammar Popup — Indigo brand."* Tokens `--og-primary #4F46E5`, `--og-accent #7C3AED`, neutrals, issue colors (grammar red `#E53935`, style blue, clarity amber). Font: **Inter** (Google Fonts). Vibe self-described as *"Notion, Figma, Linear — clean & premium."* The popup uses a Grammarly-style **score ring + issue chips + AI card** layout.
- `options.css` uses a slightly different blue (`--primary #2563eb`) — inconsistent with the indigo popup.
- `index.html` (repo root, 42 KB) is the old **"OpenGrammar"** landing — warm paper bg (`#fdfbf7`), same indigo/violet primary, animated blur orbs, grid pattern, dark-mode toggle, Inter + JetBrains Mono. Still authored by "Swadhin Biswas" with `og:image` pointing at the **upstream swadhinbiswas/opengrammar** repo and old title "OpenGrammar — The Free, Privacy-First Writing Assistant."
- `docs/index.html` (80 KB) is the **OGrammar** doc-site: blue→violet rounded-square checkmark logo, "v0.9" badge, sidebar nav, Inter/JetBrains Mono.
**Net:** existing identity = indigo/violet gradient + quill/checkmark + Inter. The new brand must diverge on all three axes (hue family, logo metaphor, type).

## 3. User-facing features worth marketing (from src/content + src/background)
Background handles 20+ message types: `CHECK_GRAMMAR`, `REWRITE_TEXT` (tone), `REPHRASE_TEXT`, `AUTOCOMPLETE_TEXT`, `CORRECT_TEXT`, analytics, writing-history, Ollama status/pull/unload.
- **Local-first grammar/spell/style** via Harper WASM + SymSpell + n-gram model — runs with **no network**.
- **Inline highlighting** (`highlighter.ts`, ~3k LOC) with floating decorations + selection bubble; **autocorrect** of high-conviction fixes; **ghost-text autocomplete** (`autocomplete.ts`).
- **Writing score ring**, issue chips by category, **tone rewrite / rephrase**, learned-corrections store, per-domain analytics, writing history.
- **Bring-your-own-AI**, OpenAI-compatible: providers in `types.ts` = OpenAI, OpenRouter, Groq, Together, **Ollama (local)** and more — privacy framing ("your key, your data") is the core pitch.
- Deep integrations for **Google Docs and Gmail**.

## 4. Exists vs. missing for store launch
**Exists:** working MV3 build (`dist/`), icons 16/48/128, popup+options UI, content/background logic, doc-site, README, Apache-2.0 LICENSE.
**Missing/blocking:**
- **No privacy policy** anywhere (`grep` found none) — **mandatory** for CWS given `<all_urls>`.
- **No store listing assets**: no marketing tiles, no promo images, no screenshots sized for CWS (only a stray `screenshot-2026-04-22…png` at repo root).
- **No permission-justification copy** drafted for review.
- **Branding still "OpenGrammar"/indigo**: root `index.html` carries upstream author + `og:image`; options vs popup color mismatch — all to be replaced under the new identity.
- New logo/icon set (16/48/128 + 440×280 + 1280×800 promo) and new color/type system not yet created.

Key paths: `extension/manifest.json`, `extension/public/icon.svg`, `extension/src/popup/{popup.css,popup.tsx,index.html}`, `extension/src/options/{options.css,options.tsx}`, `extension/src/content/{index.ts,highlighter.ts,autocomplete.ts,autocorrect.ts,gmail.ts,google-docs.ts}`, `extension/src/background/index.ts`, `extension/src/types.ts`, `index.html` (root landing), `docs/index.html`.

========================================

I now have a complete picture. Here is the briefing.

---

# OGrammar Desktop + Engine — Discovery Briefing (macOS port)

NOTE: repo paths below are rooted at `~/opengrammar/` in WSL. The desktop tree lives at `~/opengrammar/desktop/` (one level above the `opengrammar/opengrammar` extension dir). Workspace = two crates: `ograms-engine` (portable) + `ograms-hotkey` (Windows-only shell).

## 1. How the Windows client works (`desktop/ograms-hotkey/src/`)

**`windows_app.rs` (2582 lines) — the monitor.** A single message-loop thread owns a `MonitorState` with one `TrackedTarget` (the focused field).
- **Find/read the focused field:** `refresh_focus()` (line 504) calls `UIAutomation::get_focused_element()`, rejects `is_password()` and non-text elements (`is_readable_text_element`, line 2263: needs a `UIValuePattern` or `UITextPattern`), and skips excluded apps by process image name (`process_image_name` via `QueryFullProcessImageNameW`). Text is read by `read_focused_text` (line 2306) / `read_element_text_lossy` (line 2268): try `UIValuePattern.get_value()` first, else `UITextPattern` selection/document range `.get_text(-1)`.
- **Polling/edit detection:** a 450 ms `SetTimer` (`POLL_INTERVAL`) plus a `SetWinEventHook(EVENT_OBJECT_FOCUS)` focus hook, plus an optional UIA `TextChanged` event subscription (`subscribe_text_changed`, line 1253). `poll_and_maybe_lint()` (line 575) snapshots text, debounces 600 ms, then lints.
- **Apply path:** `apply_correction` (line 2343) / `apply_full_rewrite` (1758) / `apply_single_fix` (1916). Strategy: `UIValuePattern.set_value()` when available (clean, no clipboard), else **clipboard paste** — select the span via `UITextRange.select()` (or `Ctrl+A`), snapshot clipboard, `SetClipboardData`, `SendInput` Ctrl+V, restore clipboard. Caret offsets via `caret_char_offset` (1780).
- **Underline geometry:** `compute_issue_rects` (2136) converts UTF-16 offsets into screen rects via `TextPattern` `MoveEndpointByUnit(Character)` + `GetBoundingRectangles()` (a `SAFEARRAY` of f64 quads).
- **Three tiers:** Harper (instant, red solid) → proactive LLM on a worker thread (`spawn_llm_review`, posts `WM_LLM_RESULT`, blue dotted, Harper wins overlaps) → optional autocorrect (`try_autocorrect`, 1821; deferred, idle-gated, revert-learning).

**`overlay.rs` (297)** — one `WS_EX_LAYERED | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW | WS_EX_TOPMOST` popup spanning the virtual screen, backed by a 32-bit premultiplied-ARGB DIB pushed with `UpdateLayeredWindow(ULW_ALPHA)`. Click-through is done in `WM_NCHITTEST` (returns `HTTRANSPARENT` except over a word box → `HTCLIENT`), not `WS_EX_TRANSPARENT`. Underlines are drawn pixel-by-pixel into the DIB.

**`tray.rs` (353)** — `Shell_NotifyIcon` tray, runtime-generated colored-dot `HICON`s, `TrackPopupMenu` Pause/Settings/Quit. `PAUSED` atomic. **`pill.rs` (842)** — the no-activate "Rewrite" pill + suggestion card (`CreateWindowExW` BUTTON children, `WH_MOUSE_LL` light-dismiss hook, posts `WM_OVERLAY_APPLY/DISMISS/CONTEXT/DICTIONARY`). **`suggestion.rs` (430)** — builds `DrawnIssue` card content (kicker/reason/candidates). **`config.rs` (326)** — `%APPDATA%\OGrammar\config.json` + **DPAPI-encrypted `apikey.bin`** (`CryptProtectData`), autostart via HKCU `...\Run` registry key, provider base-URL resolution.

## 2. The portable engine (`desktop/ograms-engine/src/`) — reusable on macOS as-is

`lib.rs` re-exports `check_text`, `check_text_with_options`, `lint`, `apply_safe_corrections`, `EngineOptions`, `SpellEngine`, `Issue`, plus the LLM surface. **These modules are pure Rust, zero OS dependency, 100% reusable on macOS:**
- `harper_engine.rs` (642) — `harper-core` 2.0 + the orchestration (Combined tier, sentence-cap, safe-autofix). Emits **both char and UTF-16 offsets**.
- `symspell.rs` (155), `context.rs` (356, OGN1 n-gram binary parser + ranking), `learned.rs` (158), `conviction.rs` (423, the quick-fix/sentence-review routing), `protected.rs` (268).
- `llm.rs` (1022) + `ollama.rs` (150) — OpenAI-compatible HTTP via **`ureq`**, all behind `#[cfg(feature = "net")]`. The pure parsing/prompt/offset logic is non-net; the network calls (`chat_completion`, `llm_review`, `llm_rewrite`) are the only I/O and are platform-agnostic HTTP. **No rework needed.**
- The Windows client consumes the engine via `engine_data.rs` (71), which `include_bytes!`-embeds the extension's freq dictionary + `model.bin`, materializes them to `config_dir()`, and builds `EngineOptions` (Combined tier). **This file is portable** if `config_dir()` is repointed.

## 3. Win32 dependencies with NO macOS equivalent — must be reworked

Everything in `ograms-hotkey` is `#[cfg(windows)]`-gated and needs a Cocoa/AppKit rewrite. The macOS mapping:
- **UIA → Accessibility API (AXUIElement).** `get_focused_element`→`AXUIElementCreateSystemWide`+`kAXFocusedUIElementAttribute`; `get_value`→`kAXValueAttribute`; rects→`kAXBoundsForRangeParameterizedAttribute`/`AXValueGetValue`; focus hook→`AXObserver`/`kAXFocusedUIElementChangedNotification`. Requires the user to grant **Accessibility permission** (System Settings → Privacy).
- **Layered overlay (`UpdateLayeredWindow`, `WM_NCHITTEST`) →** a borderless transparent `NSWindow` (`NSWindowStyleMask.borderless`, `ignoresMouseEvents`, `.statusBar`/`.floating` level, `isOpaque=false`) drawing via Core Graphics; per-rect mouse passthrough via `ignoresMouseEvents` toggling or hit-region tracking.
- **`Shell_NotifyIcon` tray →** `NSStatusItem`. **Cards/pill (`CreateWindowExW`) →** `NSPanel` (nonactivating). **Global hotkey (`RegisterHotKey`) →** Carbon `RegisterEventHotKey` or `NSEvent` global monitor. **Clipboard/`SendInput` Ctrl+V →** `NSPasteboard` + `CGEvent` Cmd+V.
- **DPAPI key storage → macOS Keychain.** **HKCU `Run` autostart → `SMAppService`/LaunchAgent plist.** `%APPDATA%` → `~/Library/Application Support/OGrammar`.

## 4. Doc findings relevant to a macOS port

`docs/29-os-wide-grammar-checking-research.md`: confirms the **two-layer pattern** (thin per-OS hook + cross-platform engine/overlay) and explicitly names the macOS path: **AXUIElement + Input Monitoring**, citing WordWand (macOS AX-only read→fix→write). Same **honest dead zones** apply on macOS: terminals, secure/password fields, sandboxed apps, and **Electron with accessibility off by default** (the #1 risk — Claude Desktop/VS Code) — so the **hotkey-+-clipboard fallback is mandatory** and is the lowest-common-denominator that works everywhere. `docs/31-desktop-app.md`: documents the shipped 3-tier UX (red Harper / blue LLM / opt-in autocorrect / rewrite pill / click-to-fix card) the Mac client should mirror, and confirms the engine is shared and the apply path is "select span → set_value or clipboard-paste."

**GOAL-2 fit:** the no-admin/no-dmg constraint is favorable — nothing here needs an installer or admin. A macOS build needs only **Accessibility + Input Monitoring permission grants** (user-level, no admin) and can run as a plain unsigned `.app`/binary from `~/Applications`; autostart via a per-user LaunchAgent. The entire `ograms-engine` crate compiles unchanged; only a new `ograms-mac` (or cfg-gated module mirroring `ograms-hotkey`) needs writing.
