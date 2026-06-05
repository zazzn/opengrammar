# OGrammar Desktop (OS-wide, Windows)

A native Windows proofreader that brings OGrammar to **every** text field — not just
the browser. It reads the focused control via UI Automation, lints it with the same
Harper + LLM engine as the extension, and draws corrections as an OS overlay.

> **Status:** shipping on Windows. macOS/Linux are not built yet.
> **Not a keylogger:** it only reads the *currently focused* editable element on demand
> (on focus change / debounced edits), never global keystrokes. Password fields are skipped.

---

## Install / Build

The app is a Rust workspace under `desktop/` with two crates:

- `ograms-engine` — the grammar/LLM engine (Harper + the LLM correction core, a Rust
  port of the extension's LLM logic; the `RewriteTone` / `llm_rewrite` rewrite engine).
- `ograms-hotkey` — the Windows app: tray, overlay, hotkey, settings, monitor.

```powershell
# From desktop\ on Windows
cargo build --release -p ograms-hotkey
.\target\release\ograms-hotkey.exe          # add --quiet to skip the startup popup
```

First run: open **Settings** from the tray icon to pick your dialect, AI provider/model,
and paste your API key (stored DPAPI-encrypted in `%APPDATA%\OGrammar`). Enable
**"Start with Windows"** for autostart, and **"Autocorrect as I type"** if you want it.

---

## Features

### Proactive overlay underlines
A single transparent, click-through layered window spans the virtual desktop and draws
an underline under each flagged word in whatever app is focused:
- **Red solid** — Harper (local) correctness issues.
- **Blue dotted** — LLM context/sentence suggestions (merged with Harper; Harper wins on overlap).

The whole flagged word is clickable (not just the thin line), and underlines **shift with
the window** when you move it (it tracks the live window position rather than re-querying
controls that report stale coordinates).

### Click-to-fix card
Click an underlined word → a no-activate card (never steals focus) shows:
- a colored **kicker** ("Spelling" / "Grammar" / "AI suggestion"),
- the **"why?"** reason,
- one button per **candidate** correction, plus **Dismiss**.

Dismissed issues stay dismissed for that field (per-field ignore set). Clicking outside
the card closes it. The card flips above the word / clamps to the monitor so it's never
off-screen.

### Autocorrect (opt-in)
iPhone-style. When enabled, **high-confidence** fixes (capitalization, single-candidate
small-edit typos) are auto-applied to **freshly-typed text while the caret is at the end**
— never the word you're mid-typing, never older text. **Revert-learning:** undo an
auto-fix and that exact `word→correction` is added to a persistent "never autocorrect this"
ledger (in `%APPDATA%\OGrammar\autocorrect_exceptions.json`). Grammar/style/multi-option
fixes are never auto-applied.

### LLM rewrite pill
A small indigo **"Rewrite"** pill at the focused field's bottom-right (when AI is on and
the field has ≥6 words). Click it → **Polish / Formalize / Casual** → a **"Rewriting…"**
indicator → a **preview** of the proposed text with **Apply / Cancel**. Nothing changes
until you click Apply.

### Hotkey
`Ctrl+Alt+J` runs a one-shot full correction of the focused field (Harper safe fixes, plus
a full LLM rewrite if AI is configured).

### Tray + Settings
System-tray icon with a state indicator and a Pause / Settings / Quit menu. The settings
window is a skinned pure-Win32 dialog: master enable, language/dialect, autostart,
autocorrect, AI on/off + provider/model/API key, and a **per-app exclusion** picker
(pick a running app to never check it). Browsers are excluded by default.

---

## Architecture (brief)

- **UI Automation** (`uiautomation`) reads the focused element's text + bounding
  rectangles; `windows-rs` drives the Win32 overlay, tray, hotkey, and windows.
- The **monitor** debounces edits, lints with Harper, schedules the async LLM tier on a
  worker thread, and posts results back to the UI thread.
- **Per-Monitor-V2 DPI** so UIA rects and the overlay share one physical-pixel space;
  popups size themselves from the monitor they appear on.
- **Apply** uses the UIA TextPattern to select the exact span and paste the fix (verifying
  the text still matches first), with a ValuePattern splice fallback.

---

## Privacy & limits

- Harper runs locally; the LLM tier only runs if you add a key, and only sends the field's
  text to your chosen provider (with protected-text masking).
- API key is DPAPI-encrypted, bound to your Windows account.
- Browsers are excluded (the extension handles them) — avoids double-underlining.
- Electron apps (VS Code, some chat apps) may expose limited UIA text; coverage degrades
  gracefully. Elevated/admin apps require signed UIAccess (out of scope).
