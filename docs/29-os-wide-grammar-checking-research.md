# OS-Wide Grammar Checking — Research & Architecture (Windows-first)

How to extend OGrammar beyond the browser so it catches typing in **any** app
(native Win32, and Electron apps like Claude Desktop / Codex / VS Code).
Synthesised from three parallel research agents (sources cited inline below).

## TL;DR

- A Chrome extension can **only** see web pages. OS-wide needs a **separate desktop
  companion** that hooks the OS.
- Every system-wide tool (Grammarly, espanso, WordWand) uses the **same two-layer
  pattern**: a thin **native OS-hook layer** (accessibility API to *read* text +
  caret; keystroke hook + injection to *write*) plus a cross-platform
  **engine/overlay layer**.
- **Recommended build: a Tauri app (Rust core + webview UI).** Huge win for us:
  **Harper is already native Rust (`harper-core`)** → no WASM. The LLM pipeline is
  just HTTP → trivially portable. The SymSpell dict + n-gram ranker port directly.
  The React **review card UI is reused as-is**; only the DOM-underline rendering is
  rewritten as a screen-space overlay.
- **The catch (and it's the exact thing you care about):** **Electron/Chromium
  accessibility is OFF by default.** Claude Desktop, Codex, and VS Code don't
  expose their text to the OS accessibility tree until something wakes it — and it
  has a perf cost and is version-dependent. This is the #1 risk and why a
  **keystroke-buffer fallback (espanso-style) is mandatory, not optional.**
- **Honest dead zones (true for Grammarly too):** terminals, password/secure
  fields, elevated/admin apps, games, old-Electron / custom-canvas editors.

## Why the extension can't do it
Browser extensions are sandboxed to web content. Native apps (and even other
Chromium *processes* like Electron apps) are invisible to it. OS-wide = a native
process using OS accessibility + input APIs.

## The universal architecture (what everyone does)
```
 NATIVE OS-HOOK LAYER (per-OS, thin)        ENGINE + OVERLAY (cross-platform)
 ─ read text+caret via accessibility   ─▶  ─ Harper + SymSpell + n-gram + LLM
 ─ focus events                             ─ decide corrections
 ─ write via keystroke/clipboard inject ◀─  ─ draw underlines + review card
```
**espanso** (Rust, MIT) is the textbook reference: per-OS `detect`/`inject` crates
behind traits, a platform-agnostic engine, launcher/daemon/worker processes.

## Windows mechanism (primary target)
1. **UI Automation (UIA)** — the engine for read + locate:
   - `get_focused_element` → `ValuePattern.get_value()` (simple fields) or
     `TextPattern` (rich/multiline).
   - Caret = a **degenerate (empty) text range** via `TextPattern2.GetCaretRange()`
     / `GetSelection()`.
   - **`GetBoundingRectangles()`** gives per-line **screen rects** for any range —
     this is what you draw underlines on (the native analogue of the DOM
     `getClientRects()` we use today).
   - Focus tracking via `SetWinEventHook(EVENT_OBJECT_FOCUS)`.
   - Rust: the **`uiautomation`** crate (safe wrapper over `windows-rs`).
2. **Layered click-through overlay** for underlines + cards: a transparent,
   always-on-top, `WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE` window.
   Tauri supports `transparent` + `alwaysOnTop` + `setIgnoreCursorEvents` (it only
   does **per-window** click-through, so use the proven ~60 Hz cursor-poll to flip
   click-through OFF only when the cursor is over a card/underline).
3. **Keystroke-buffer fallback** (`WH_KEYBOARD_LL` + `SendInput`) for surfaces with
   no UIA text (Electron-with-a11y-off, terminals). Maintain a rolling "word in
   progress" buffer; apply fixes via backspaces+retype or clipboard-paste.
4. **Apply a fix:** `ValuePattern.set_value` when available (no clipboard
   pollution), else clipboard-paste (espanso's battle-tested default for longer
   text, with per-app paste-shortcut quirks).
- **Skip TSF/IME** as the core (admin install, HKLM, per-process COM injection) and
  **skip MSAA-only**. Keep a thin **IAccessible2** fallback for older Chromium.

## The Electron problem (Claude Desktop / Codex / VS Code)
- Chromium a11y is disabled by default; only built lazily when assistive tech is
  detected or `--force-renderer-accessibility` is set. It's gated by Chromium
  `AXMode` flags — you need at least `kWebContents | kInlineTextBoxes` to read
  editable text and get per-char geometry.
- Being a UIA client and actively querying the focused element's document *can*
  wake it per app — **must be verified per app, not assumed** (Electron bundles its
  own Chromium version; Chrome 138+ ships native UIA by default but Electron lags).
- It has a **real perf cost** (load/jank/memory) and a cold-start delay.
- **Therefore:** for Electron, plan for the keystroke-buffer fallback; don't promise
  in-place underlines there until verified per app.

## Coverage reality (be honest in the product)
| Surface | Read text | In-place underline | Fix via inject | Notes |
|---|---|---|---|---|
| Native Win32 / WPF / WinForms / WinUI | ✅ | ✅ | ✅ | Best case |
| Browsers (in-page) | ⚠️ (a11y gating) | ⚠️ | ⚠️ | The **extension already covers this better** |
| Electron (Claude Desktop, Codex, VS Code) | ⚠️ a11y off by default | ⚠️ only when awake | ⚠️ / ✅ via keys | **Verify per app; fallback to keystroke buffer** |
| Windows Terminal (Win11 22H2+) | ✅ | ⚠️ | ⚠️ keys | Older consoles: hook only |
| Password/secure fields | ❌ withheld by OS | ❌ | ❌ | Exclude by design |
| Elevated/admin apps | ❌ (needs signed UIAccess) | ❌ | ❌ | Degrade gracefully |
| Games / exclusive fullscreen | ❌ | ❌ | ⚠️ flaky | Out of scope |

Grammarly itself officially needs **Electron 12+/16+** and is weak/broken in **VS
Code, IDEs, and terminals** — so these gaps are industry-standard, not our failing.

## Two fallbacks that always help
- **Hotkey + clipboard** ("select text → hotkey → fix"): the lowest-common-
  denominator that works *everywhere*, including Electron and terminals. Great
  **first milestone** and permanent fallback (this is LanguageTool's whole desktop UX).
- **LSP (`harper-ls` model):** ship/point an LSP at editors (VS Code, JetBrains,
  Neovim, Zed). Turns the IDE dead-zone into a strength cheaply — the editor
  renders the squiggles, no accessibility needed.

## Recommended architecture for OGrammar — Tauri (Rust)
- **One Rust process (Tauri).** Reuse **`harper-core` natively** (drops the WASM tax
  the code comments already lament). Port the small/pure TS glue (SymSpell, n-gram
  ranker) to Rust; the LLM client (`llmClient.ts`) is plain OpenAI-compatible HTTP →
  port with `reqwest`/`serde`, **or** keep it as a Tauri **sidecar** (compiled-TS
  binary) if you want zero prompt-regression risk (it's network-bound, latency
  doesn't matter).
- **Reuse the React review card UI** in the overlay webview; reuse the
  code-point→UTF-16 offset remap already in `harperEngine.ts`.
- **Per-OS hook layer behind traits** (espanso's shape): Windows first
  (UIA + WinEvent + LL keyboard + overlay), then macOS (AXUIElement + Input
  Monitoring), then Linux (AT-SPI / X11; Wayland is a known pain point).
- Footprint reference: a production Tauri overlay runs ~14 MB RAM / <1% CPU.

## Phased plan + rough effort (1–2 eng, TS+Rust)
- **Phase 0 — Engine spike (≈1 wk):** Rust CLI using `harper-core` + SymSpell-rs +
  n-gram that reproduces the extension's issues. De-risks the core claim.
- **Phase 1 — Hotkey MVP (≈1.5–2.5 wk):** global hotkey → UIA read focused field →
  correct → popup card near cursor → apply via set_value/clipboard. Works in
  Notepad/Word/Slack/native fields + any browser box. **No overlay yet.**
- **Phase 2 — Keystroke fallback + inject hardening (≈1.5–2 wk):** espanso-style
  buffer for Electron/terminals; dual keys/clipboard inject with per-app quirks.
  Now works *somewhere* in almost every app.
- **Phase 3 — True overlay underlines (≈2–3 wk):** transparent click-through window;
  underlines at `GetBoundingRectangles()`; reposition on WinEvents+scroll; 60 Hz
  click-through toggle; reuse the React card. The "Grammarly anywhere" payoff.
- **Phase 4 — Cross-platform + polish (open-ended):** macOS, Linux, per-app
  enable/disable, settings UI (port existing options/popup React).

## Biggest risks
1. **Electron a11y off by default** (Claude Desktop, Codex, VS Code) — High. Mitigate
   with the Phase-2 keystroke fallback; verify per app.
2. **Secure/elevated fields** — out of scope by design.
3. **Anti-cheat flags global hooks** — exclude games; allow per-app disable.
4. **Underline drift under scroll / multi-DPI** — the fiddliest UX work (we already
   fought the DOM version in `highlighter.ts`).
5. **LLM prompt-port regression** — port carefully or sidecar the one module.

## Sources (selected)
- Windows UIA Text/TextRange, caret as degenerate range, GetBoundingRectangles:
  learn.microsoft.com (UIA Text pattern docs).
- Chromium/Electron a11y off by default + AXMode flags + native-UIA from Chrome 138:
  chromium.googlesource.com accessibility overview & `ax_mode.h`;
  developer.chrome.com windows-uia-support-update; Electron accessibility docs.
- espanso architecture (detect/inject per-OS, clipboard-paste default):
  deepwiki.com/espanso/espanso; github.com/espanso/espanso.
- Grammarly integration reqs (UIA TextPattern, macOS AX, Electron 12/16, weak in
  IDEs/terminals): support.grammarly.com integration & app-controls articles.
- Harper as native Rust crate + LSP: writewithharper.com; github.com/Automattic/harper;
  crates.io/harper-core.
- Tauri overlay (transparent/always-on-top/click-through, per-window limitation +
  60 Hz workaround): v2.tauri.app window docs; github.com/tauri-apps/tauri#13070;
  blog.manasight.gg Tauri overlay writeup.
- `uiautomation` Rust crate: crates.io/uiautomation; github.com/leexgone/uiautomation-rs.
- WordWand (macOS AX read→fix→write-inline, Accessibility-only): wordwand.co.
