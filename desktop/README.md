# OGrammar Desktop (Windows, OS-wide)

The native desktop product of **[OGrammar](../README.md)** — a Windows proofreader that
works in **any** focused text field (Notepad, Word, Slack desktop, chat boxes, IDE fields),
not just the browser. Same Harper + LLM engine as the extension; the desktop app yields
browser windows to the extension by default.

> Full feature write-up: [`../docs/31-desktop-app.md`](../docs/31-desktop-app.md) ·
> Two-product overview: [`../docs/30-products-overview.md`](../docs/30-products-overview.md)

## Workspace

| Crate | Purpose |
|-------|---------|
| `ograms-engine` | Grammar/LLM engine — Harper + the LLM correction core (prompt, normalize, diff, rewrite). A Rust port of the extension's LLM logic, kept at parity. |
| `ograms-hotkey` | The Windows app — UI Automation monitor, OS overlay underlines, click-to-fix card, autocorrect, LLM rewrite pill, system tray, settings window, global hotkey. |

## Build & run (Windows)

```powershell
cargo build --release -p ograms-hotkey
.\target\release\ograms-hotkey.exe          # add --quiet to skip the startup popup
```

On first run, open **Settings** from the tray icon: pick your dialect, AI provider/model,
and paste your API key (stored DPAPI-encrypted in `%APPDATA%\OGrammar`). Optionally enable
**Start with Windows** and **Autocorrect as I type**.

## Features (summary)

- **Overlay underlines** — red (Harper) + blue-dotted (LLM), whole-word clickable, track window moves.
- **Click-to-fix card** — kicker + reason + candidate corrections + Dismiss; light-dismiss; on-screen clamping.
- **Autocorrect** *(opt-in)* — high-confidence fixes on freshly-typed text, with revert-learning.
- **Rewrite pill** — Polish / Formalize / Casual → preview → Apply/Cancel.
- **Hotkey** `Ctrl+Alt+J` — one-shot full correction of the focused field.
- **Tray + settings** — provider/model/key, dialect, per-app exclusion (browsers excluded by default), autostart.
- Per-monitor-V2 DPI; correct across mixed-resolution monitors.

## Privacy

Harper runs locally; the LLM tier runs only if you add a key and only sends the focused
field's text (with protected-text masking) to your chosen provider. The key is
DPAPI-encrypted and bound to your Windows account. The app reads only the *currently
focused* editable element on demand — it is **not** a keylogger — and skips password fields.

## Status & limits

Shipping on Windows. Electron apps (VS Code, some chat apps) may expose limited UIA text
(coverage degrades gracefully); elevated/admin apps need signed UIAccess (out of scope).
macOS/Linux are not built yet. See the roadmap in [`../ROADMAP.md`](../ROADMAP.md).
