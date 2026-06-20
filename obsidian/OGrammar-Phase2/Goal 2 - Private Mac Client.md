---
tags: [ogrammar, phase-2, goal-2]
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

# Goal 2 - Private Mac Client

**Outcome:** a personal `OGrammar.app` for macOS that mirrors the Windows client, installs with **no admin rights and no `.dmg`**, and is useful on day one **even if Accessibility is blocked**.

**Owner:** [[Mac Client]]. Identity from [[Brand & Design]]; packaging from [[Release Engineering]]; `Issue`/tier parity source from [[Frontend]].

## The permission ladder (the crux)
The target Mac may be MDM-managed, so the design never depends on a single permission:

| Tier | Needs | What you get |
|---|---|---|
| **Floor** | nothing | A floating paste-in panel: paste text, get checks + rewrite, copy back. Works on the most locked-down Mac. |
| **Happy path (P0)** | Input Monitoring | Global hotkey synthesizes Cmd-C, reads the selection via `NSPasteboard`, checks/rewrites in place. Works in Electron/terminal dead zones because it reads the selection, not the field. Usually grantable by a standard user. |
| **Full parity (P1)** | Accessibility | System-wide focused-field reading, live tracking, and overlay underlines at Windows parity. The one an MDM profile can hard-block without admin. |

If Accessibility is denied the app silently stays at P0. We never present a dead app.

## Architecture (reuse map, from [[Mac Client]])
The portable `ograms-engine` crate ships **unchanged**; only the OS shell is new.

| Windows | macOS | Reuse |
|---|---|---|
| `ograms-engine` (Harper/SymSpell/n-gram/LLM) | identical crate | 100% reuse |
| in-process engine | new `ograms-ffi` staticlib via C FFI into Swift | thin new |
| UIAutomation focus/read | `AXUIElementCreateSystemWide` + `AXObserver` | new |
| `compute_issue_rects` (TextPattern) | `kAXBoundsForRangeParameterizedAttribute` | new |
| `overlay.rs` layered DIB | borderless transparent `NSWindow` + Core Graphics | new |
| `tray.rs` | `NSStatusItem` (menu bar) | new |
| clipboard `SendInput` Ctrl+V | `NSPasteboard` + `CGEvent` Cmd+V | new |
| DPAPI key store | macOS Keychain | new |
| HKCU Run autostart | per-user LaunchAgent plist (no admin) | new |

**Stack:** Swift/AppKit + Rust FFI staticlib (not a sidecar, not Tauri). All toolchain is user-space: `rustup` + Apple Command Line Tools, ad-hoc signing, no Apple Developer account.

## Distribution (no admin, no DMG)
Unsigned, ad-hoc-signed `OGrammar.app` (`codesign -s -`), delivered as a `.zip`, run from `~/Applications`. First run: right-click → Open, or `xattr -dr com.apple.quarantine ~/Applications/OGrammar.app`. `LSUIElement=true` keeps it a menu-bar-only agent. Config in `~/Library/Application Support/OGrammar`, autostart in `~/Library/LaunchAgents` - all user-writable.

## Phased build
- **P0** - menu-bar app + global hotkey + Cmd-C selection check/rewrite + paste-in panel. Usable with no Accessibility.
- **P1** - AX focused-field read + `AXObserver` tracking + transparent overlay underlines + AX/clipboard apply. Windows reading parity.
- **P2** - rewrite pill + suggestion card + idle-gated autocorrect + learned-store persistence + LaunchAgent autostart.

## Release gate
A fixed-corpus parity harness proving the macOS FFI `Issue` output is byte-identical (char + utf16 offsets) to the Windows client. Built in Phase A, before any UI depends on it.

## CEO decision pending
**Is P0-only an acceptable "Goal 2 done" if Accessibility is MDM-blocked?** Default: yes - P0 is the floor, P1 is best-effort. Please confirm the target Mac's management status before P1 effort is committed (decision #1 in [[00 - OGrammar Phase 2 - CEO Brief]]).
