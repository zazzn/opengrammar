---
tags: [ogrammar, phase-2, mac]
owner: Mac Client Architect
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

I have a complete, accurate picture. Writing the department-head note.

> Owner: Mac Client Architect - Reports to: CEO (second brain)

## Charter
Deliver a PRIVATE, personal-use macOS client that mirrors the Windows `ograms-hotkey` experience (3-tier Harper/LLM/autocorrect, overlay underlines, rewrite pill, menu-bar control) for a single user who has NO admin rights and CANNOT install a `.dmg`. The portable `ograms-engine` Rust crate ships unchanged; only the OS shell is new. The non-negotiable design rule: something useful must work on day one EVEN IF Accessibility permission is unavailable, because the target Mac may be MDM-managed.

## Objectives (Phase 2)
- P0 client that runs from `~/Applications` as an unsigned, ad-hoc-signed `.app` delivered as a `.zip`, with zero installer and zero admin, launchable after a one-time `xattr` quarantine strip.
- P0 "check / rewrite selection" flow via global hotkey + synthesized Cmd-C + `NSPasteboard`, requiring ONLY Input Monitoring (or nothing, in paste-in mode), measurably working in Electron/terminal dead zones where AX fails.
- P1 AX-based focused-field reading + transparent click-through overlay underlines at Windows parity, gated behind Accessibility permission with graceful P0 fallback.
- 100% reuse of `ograms-engine` (Harper + SymSpell + n-gram + LLM tiers) via a C FFI boundary, with the SAME embedded `frequency_dictionary_en_82_765.txt` + `model.bin` materialized to `~/Library/Application Support/OGrammar`.
- Engine + LLM parity: identical `Issue` offsets (char AND utf16), identical conviction routing, identical OpenAI-compatible/Ollama provider config, API key in macOS Keychain.

## Delegated roles & tasks

**Rust FFI Engine-Bridge Owner** - expose `ograms-engine` to Swift.
- Add an `ograms-ffi` crate (`crate-type = ["staticlib"]`) wrapping `lint`, `check_text_with_options`, `apply_safe_corrections`, `count_safe_corrections`, and the LLM surface (`llm_review`, `llm_rewrite`, `llm_correct_text`, `chat_completion`) behind `extern "C"` functions returning JSON `Issue`/`LlmIssue` arrays through `*mut c_char` with a paired `free` fn.
- Port `engine_data.rs` to a macOS `config_dir()` = `~/Library/Application Support/OGrammar`; keep the `include_bytes!` of the extension's dict/model so there are no loose files; build `EngineOptions { spell_engine: Combined, protect: true }`.
- Produce a universal static lib (`aarch64-apple-darwin` + `x86_64-apple-darwin` via `lipo`) and a hand-written/cbindgen header; verify offset parity against the Windows client on a fixed corpus.

**AppKit Shell Owner** - the menu-bar app and P0 surfaces.
- `NSStatusItem` menu bar mirroring `tray.rs` (Pause toggle backed by an atomic, Settings, Quit, colored-dot status icon).
- P0 global hotkey via Carbon `RegisterEventHotKey` (most reliable, no AX needed) → synthesize Cmd-C via `CGEvent` → read `NSPasteboard` → call FFI `lint` → show results card; "Rewrite" runs `llm_rewrite` and writes back via `CGEvent` Cmd-V (snapshot/restore pasteboard, exactly like the Windows clipboard apply path).
- A nonactivating floating `NSPanel` "paste-in" check/rewrite window for the zero-permission case.

**Accessibility Integration Owner (P1)** - Windows-parity reading.
- `AXUIElementCreateSystemWide` + `kAXFocusedUIElementAttribute` to find the focused field; `kAXValueAttribute` to read text; reject password/secure fields (mirror `is_password`/`is_readable_text_element`); skip excluded apps by bundle id (mirror `process_image_name` exclusions).
- `AXObserver` on `kAXFocusedUIElementChangedNotification` + `kAXValueChangedNotification` to replace the Win32 focus hook + UIA `TextChanged`; reuse the 600 ms debounce + 450 ms poll fallback from `poll_and_maybe_lint`.
- Glyph rects via `kAXBoundsForRangeParameterizedAttribute` (`AXValueGetValue` → `CGRect`) to replace `compute_issue_rects`; map engine utf16 offsets to AX ranges.

**Overlay & Apply Owner (P1)** - the underline layer and write-back.
- Borderless transparent `NSWindow` (`.borderless`, `isOpaque=false`, `backgroundColor=.clear`, `.statusBar`+ level, spanning all screens) drawing red-solid Harper / blue-dotted LLM underlines via Core Graphics, replacing the `UpdateLayeredWindow` DIB.
- Per-rect click-through via `ignoresMouseEvents` toggling (or `NSTrackingArea` hit regions) to replace `WM_NCHITTEST` HTTRANSPARENT logic.
- Apply path: prefer AX `kAXValueAttribute` set (clean, mirrors `set_value`), else `CGEvent` Cmd-V clipboard paste; port `caret_char_offset` restore-caret-to-end behavior.

**Pill / Card / Persistence Owner (P2)** - autocorrect and learned store.
- Nonactivating `NSPanel` "Rewrite" pill + suggestion card mirroring `pill.rs`/`suggestion.rs` (kicker/reason/candidates, light-dismiss via global `NSEvent` monitor instead of `WH_MOUSE_LL`).
- Idle-gated, revert-learning autocorrect mirroring `try_autocorrect`; persist the learned-corrections store via the engine's `learned.rs` to the macOS config dir.
- API key in macOS Keychain (Security framework) replacing DPAPI `apikey.bin`; autostart via per-user LaunchAgent plist in `~/Library/LaunchAgents` (NO admin) replacing the HKCU Run key.

## Deliverables
- `desktop/ograms-ffi/` crate (staticlib + C header) and `desktop/ograms-mac/` Xcode/SwiftPM project; both added to the existing Cargo workspace where the Rust side belongs.
- `OGrammar.app` bundle: universal binary, ad-hoc signed (`codesign -s -`), `Info.plist` with `LSUIElement=true` (menu-bar only, no Dock icon) and usage strings.
- `OGrammar-macOS.zip` release artifact + a `MACOS-INSTALL.md` with the right-click-Open / `xattr -dr com.apple.quarantine` first-run steps.
- Parity test: a fixed-corpus harness comparing macOS FFI `Issue` output to the Windows client byte-for-byte.

## Architecture (mirror of Windows)
| Windows piece | macOS equivalent | Reuse vs new |
|---|---|---|
| `ograms-engine` (Harper/SymSpell/n-gram/LLM) | identical crate, unchanged | REUSE 100% |
| `engine_data.rs` embed + materialize | same file, `config_dir()` repointed | REUSE (1-line change) |
| Engine consumed in-process | `ograms-ffi` staticlib via C FFI into Swift | NEW (thin) |
| `UIAutomation` focus/read/track | `AXUIElementCreateSystemWide` + `AXObserver` | NEW |
| `compute_issue_rects` (TextPattern) | `kAXBoundsForRangeParameterizedAttribute` | NEW |
| `overlay.rs` layered DIB + `WM_NCHITTEST` | borderless transparent `NSWindow` + CoreGraphics + `ignoresMouseEvents` | NEW |
| `tray.rs` `Shell_NotifyIcon` | `NSStatusItem` | NEW |
| `pill.rs`/`suggestion.rs` `CreateWindowExW` | nonactivating `NSPanel` | NEW |
| `RegisterHotKey` | Carbon `RegisterEventHotKey` | NEW |
| clipboard `SendInput` Ctrl+V | `NSPasteboard` + `CGEvent` Cmd+V | NEW |
| DPAPI `apikey.bin` | macOS Keychain | NEW |
| HKCU Run autostart | LaunchAgent plist | NEW |
| `%APPDATA%\OGrammar` | `~/Library/Application Support/OGrammar` | NEW (path only) |

**Reuse decision: FFI staticlib, NOT a sidecar process.** The engine is synchronous, pure-Rust, has no I/O except the LLM HTTP (already `ureq`, platform-agnostic), and exposes a small JSON-friendly `Issue` surface. A staticlib linked into the `.app` keeps it a single self-contained bundle (critical for zip delivery with no admin), avoids IPC latency on the per-keystroke inline path, and avoids shipping/spawning a second binary. A sidecar buys nothing here.

## Distribution without admin or DMG
No installer is needed because nothing in the design touches system locations: the app lives in `~/Applications` (or `~/Downloads`), config in `~/Library/Application Support/OGrammar`, autostart in `~/Library/LaunchAgents` - all user-writable without admin. Delivery: a plain `OGrammar.app` ad-hoc signed (`codesign -s - --deep`), zipped, handed to the user. First run, Gatekeeper blocks the unsigned/unnotarized app; the user either right-clicks → Open (one-time override) or runs `xattr -dr com.apple.quarantine ~/Applications/OGrammar.app` in Terminal. Neither requires admin. A `.dmg` would add nothing and is explicitly off the table. `LSUIElement=true` keeps it a menu-bar-only agent.

## Permissions reality (the crux)
Two distinct permissions, ranked by how badly we need them:

1. **Nothing (paste-in mode)** - the floating `NSPanel`: user pastes text, gets checks/rewrite, copies back. Works on ANY Mac including the most locked-down MDM. Zero permission. This is the guaranteed floor.
2. **Input Monitoring** (System Settings → Privacy & Security → Input Monitoring) - enables the global hotkey + synthesized Cmd-C selection read. This is the P0 "happy path" and works in Electron/terminal/secure-field dead zones where AX reading fails, because it never reads the field - it reads the SELECTION via the clipboard. Input Monitoring is usually grantable by a standard user even under MDM.
3. **Accessibility** (System Settings → Privacy & Security → Accessibility) - REQUIRED for P1 system-wide focused-field reading, live tracking, and overlay underline geometry. This is the one an MDM profile can hard-block without admin. If blocked, the client silently stays in P0 mode; underlines and inline tracking are disabled but check/rewrite still work.

Fallback ladder if Accessibility is denied: hotkey → Cmd-C → check/rewrite (needs only Input Monitoring) → if even that is blocked, paste-in panel (needs nothing). We never present a dead app.

## Tech-stack recommendation
**Swift/AppKit + Rust FFI (staticlib).** Justification: `NSStatusItem`, transparent `NSWindow`/`NSPanel`, `AXUIElement`/`AXObserver`, `CGEvent`, Keychain, and Carbon hotkeys are all first-class in AppKit with zero friction; the pure-Rust alternatives (`objc2`/`cacao`) lag on AX parameterized attributes and nonactivating-panel ergonomics and would burn time fighting bindings. Tauri is wrong here - it is a webview app framework, not a system-wide accessibility/overlay tool, and adds a Chromium runtime we do not want. FFI keeps the entire `ograms-engine` investment intact. Toolchain, all user-space, no admin: `rustup` + `aarch64/x86_64-apple-darwin` targets for the static lib; Xcode Command Line Tools (`xcode-select --install`, user-space) for `swiftc`/`codesign`/`lipo`; no full Xcode and no Apple Developer account needed (ad-hoc signing only).

## Milestones & sequence
1. `ograms-ffi` staticlib + header + universal lib; offset-parity test green vs Windows.
2. AppKit skeleton: `NSStatusItem`, Pause/Settings/Quit, Keychain key entry, provider config parity.
3. P0 ship: global hotkey + Cmd-C selection check + rewrite write-back + paste-in panel. Usable on day one without Accessibility.
4. P1: AX focused-field read + `AXObserver` tracking + transparent overlay underlines + AX/clipboard apply. Windows reading parity.
5. P2: rewrite pill + suggestion card + idle-gated autocorrect + learned-store persistence + LaunchAgent autostart.

## Dependencies
- [[Project Management]] - sequencing P0 vs P1/P2, confirming the single-user scope (no notarization budget).
- [[Brand & Design]] - the new OGrammar icon/color system for the `.app` icon, menu-bar template image, and panel/card styling (must match the Goal-1 rebrand, not the old indigo quill).
- [[UX]] - first-run permission-priming flow, the fallback-ladder messaging, and the paste-in panel layout.
- [[Release Engineering]] - the `codesign -s -` + zip + `xattr` delivery pipeline and `MACOS-INSTALL.md`.
- [[Frontend]] - source of truth for `Issue` shape, conviction tiers, and provider list so the Mac client stays at extension parity.
- [[Mac Client]] - this department's own build squads named above.

## Risks & mitigations
- **MDM blocks Accessibility (the #1 risk).** Mitigation: P0 needs only Input Monitoring; paste-in panel needs nothing. The product is useful before AX is ever granted. Confirm with CEO before committing P1 effort.
- **Electron-with-AX-off dead zones** (Claude Desktop, VS Code). Mitigation: the hotkey+clipboard P0 path is the lowest common denominator and is mandatory regardless of P1; it works in these apps because it reads the selection, not the field.
- **Unsigned-app Gatekeeper friction / future macOS hardening.** Mitigation: documented `xattr` step; ad-hoc sign so the binary is at least internally consistent; single-user scope means no broad distribution exposure.
- **FFI offset drift** between char and utf16 across the boundary corrupting underlines/applies. Mitigation: the fixed-corpus parity harness against the Windows client is a release gate.
- **Synthesized Cmd-C races** (slow apps not updating the pasteboard in time). Mitigation: poll the pasteboard `changeCount` with a short timeout before reading, snapshot/restore prior clipboard contents exactly as the Windows apply path does.
- **CGEvent paste eaten by secure input** (password fields). Mitigation: detect secure-input state and refuse, mirroring the Windows `is_password` rejection.

## Definition of done
- `OGrammar.app` zip runs on the target Mac from `~/Applications` with no admin and no installer, surviving the documented `xattr`/right-click-Open first run.
- With ZERO Accessibility permission: global hotkey checks and rewrites the current selection, and the paste-in panel works standalone.
- With Accessibility granted: focused-field underlines appear and apply at Windows parity (red Harper, blue LLM), tracking the focused field live.
- Engine output is byte-identical to the Windows client on the parity corpus (Combined tier, same dict/model); LLM provider config + Keychain key + Ollama work; autostart via LaunchAgent.
- The entire `ograms-engine` crate compiled unchanged; only `ograms-ffi` + `ograms-mac` are new.

Key paths referenced: `desktop/ograms-engine/src/{lib.rs,harper_engine.rs,llm.rs}` (reused via FFI), `desktop/ograms-hotkey/src/engine_data.rs` (port `config_dir()` only), and the Win32 shell `desktop/ograms-hotkey/src/{windows_app.rs,overlay.rs,tray.rs,pill.rs,suggestion.rs,config.rs}` (the rewrite map above).
