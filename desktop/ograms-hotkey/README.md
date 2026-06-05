# ograms-hotkey

The Windows app crate for **OGrammar Desktop** — the OS-wide proofreader. It hosts the
UI Automation monitor, the OS overlay underlines, the click-to-fix card, autocorrect,
the LLM rewrite pill, the system tray, the settings window, and the global hotkey.

> **Read the product docs, not this file, for the full picture:**
> - [`../README.md`](../README.md) — desktop product overview + build
> - [`../../docs/31-desktop-app.md`](../../docs/31-desktop-app.md) — features in detail
> - [`../../docs/30-products-overview.md`](../../docs/30-products-overview.md) — the two products

## Build & run (Windows)

```powershell
# from desktop\
cargo build --release -p ograms-hotkey
.\target\release\ograms-hotkey.exe          # add --quiet to skip the startup popup
```

Default hotkey: **`Ctrl+Alt+J`** (falls back to `Ctrl+Alt+G`/`H`/`Shift+G` if taken).
Configure provider/model/key, dialect, autocorrect, and per-app exclusions from the
tray's **Settings** window. The grammar/LLM engine lives in the sibling
[`ograms-engine`](../ograms-engine) crate.
