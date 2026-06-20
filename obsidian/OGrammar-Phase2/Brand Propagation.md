---
tags: [ogrammar, phase-2, brand, residue]
owner: Brand & Design Lead
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]] - every surface still wearing the OLD brand

# Brand Propagation - residue inventory

## Extension + web surfaces
I now have a complete, verified inventory. The extension `public/icon.svg` is confirmed already on the new green mark (`34C77F`/`16191D`) — not residue. The root `logo.svg` is the OLD blue→violet gradient quill-checkmark and is residue (it's the favicon + og:image + nav logo on the landing page). `highlighter.ts` has 44 lines carrying the old indigo/violet palette.

Here is the complete propagation checklist.

---

# OGrammar Brand Residue — Extension + Web Surfaces

**New tokens to apply everywhere:** accent signal-green `#1FA463` (light) / dark-surface sibling `#34C77F`; canvas off-black `#16191D` / off-white `#FBFCFB`; **Geist** type (replace Inter); mark = "O" above a green spellcheck wave (replace quill+checkmark). Old palette = `#4F46E5`/`#7C3AED` (popup+content), `#2563eb` (options), `#3B82F6`→`#8B5CF6` (docs/root logo gradient).

## A. Extension — Popup (`opengrammar/extension/src/popup/`)

| file:line | what is wrong | what it must become |
|---|---|---|
| popup.css:2-4 | Header comment "OpenGrammar Popup — Indigo brand … Indigo = truth" | OGrammar / signal-green brand comment |
| popup.css:6 | `@import … family=Inter:wght@…` Google Fonts Inter | Geist font import (or self-host) |
| popup.css:13-18 | `--og-primary:#4F46E5` + `-dark #4338CA` `-light #EEF2FF` `-ring #C7D2FE` `-mid #818CF8` (Indigo ramp) | green ramp anchored on `#1FA463` (tints/ring/dark from green) |
| popup.css:20-22 | `--og-accent:#7C3AED` (Violet 600) + `--og-accent-light:#F5F3FF` | drop violet; accent = green sibling `#34C77F` or neutral |
| popup.css:29 | `--og-text-1:#1A1A2E` "near-black with slight indigo" | off-black `#16191D` |
| popup.css:39-40 | shadows `rgba(79,70,229,…)` (indigo-tinted) | neutral or green-tinted `rgba(31,164,99,…)` |
| popup.css:44 | `font-family:'Inter',…` | Geist |
| popup.css:78 | comment "gradient indigo→violet circle with quill icon" | green "O + wave" mark comment |
| popup.css:81 | `.brand-icon` `linear-gradient(135deg,var(--og-primary),var(--og-accent))` indigo→violet | flat `#1FA463` or green wave mark |
| popup.css:84 | `box-shadow … rgba(79,70,229,0.35)` | green-tinted shadow |
| popup.css:128 | score-section bg `linear-gradient(180deg,#FAFBFF,#FFFFFF)` (cool/indigo tint) | neutral / `#FBFCFB` |
| popup.css:237 | focus `box-shadow … rgba(79,70,229,0.12)` | green focus ring |
| popup.tsx:1-4 | header comment "OpenGrammar Popup …" | OGrammar |
| popup.tsx:41 | ScoreRing `score>=80 ? '#4F46E5'` (indigo "excellent") | `#1FA463` |
| popup.tsx:46 | ring track `stroke="#EEF2FF"` (indigo-50) | green-tint track |
| popup.tsx:609 | brand-icon inline **quill SVG** (`M20 4C15 4 10 7 8 12…` feather+check) | new "O over green wave" mark SVG |
| popup/index.html | (clean — title already "OGrammar", no font/color) | no change |

## B. Extension — Options (`opengrammar/extension/src/options/`)

| file:line | what is wrong | what it must become |
|---|---|---|
| options.css:8 | `--primary:#2563eb` | `#1FA463` |
| options.css:9 | `--primary-hover:#1d4ed8` | darker green |
| options.css:26-27 | body `font-family` Apple/Segoe stack, **no Geist** | add Geist as primary |
| options.css:139,248 | focus `box-shadow … rgba(37,99,235,0.1)` (blue) | green focus ring |
| options.css:579 | `.about-section` `linear-gradient(135deg,var(--primary),#1d4ed8)` blue gradient | green gradient |
| options/index.html:13-18 | header **logo SVG = quill + check + node** (old mark, `M12 19l7-7…` feather) | new "O + wave" mark |
| options/index.html (no font link) | inherits Apple stack, no Geist | add Geist `<link>` if popup self-hosts |
| options.tsx:500 | export filename `opengrammar-settings-…json` | `ograms-settings-…` (optional brand-copy nit) |

*Note: options copy/name already says "OGrammar" throughout; only color/font/logo are residue.*

## C. Extension — Content scripts (in-page injected UI)

| file:line | what is wrong | what it must become |
|---|---|---|
| **highlighter.ts (44 lines)** | Old indigo/violet hardcoded across the floating assistant + suggestion cards + sentence-review + rephrase UI: `#4F46E5` (primary buttons/icons/labels, ~30×), `#4338CA` (hover), `#EEF2FF`/`#C7D2FE` (chips/slots/accept boxes), `#F5F3FF`/`#DDD6FE` (improve chip), `#7C3AED`+`#DB2777` gradient (badge), `#818CF8` | repaint all to green system: `#1FA463` primary, darker-green hover, green-tint surfaces; replace the violet→pink gradient badge with green |
| highlighter.ts:960,976 | assistant badge color/bg `#4F46E5` | `#1FA463` |
| highlighter.ts:1026 | floating launcher `linear-gradient(135deg,#4F46E5,#7C3AED)` | green gradient/flat |
| highlighter.ts:1106 | secondary FAB `linear-gradient(135deg,#7C3AED,#DB2777)` (violet→pink) | green system |
| highlighter.ts:1332,2196-2198,2433 | "context" chip / accept slot `#eef2ff`+`#c7d2fe` borders | green-tint |
| highlighter.ts:2380,2382,2387 | sentence-counter `#4F46E518` bg + `#4F46E5` icon/label | green |
| highlighter.ts:2693 | improve chip `#F5F3FF`/`#4F46E5`/`#DDD6FE` | green |
| highlighter.ts:271 | `REVIEW_LLM_LINE='#3b82f6'` (blue LLM underline) | brand-align (green or keep functional-blue by decision) |
| highlighter.ts:188, +`opengrammar-*` ids | DOM ids/classes literally `opengrammar-highlights`, `-underline`, `-assistant`, `-badge`, `-tooltip`, `-spell-menu`, `-rephrase-panel`, `-autocomplete-ghost`, `-selection`, `-input-mirror`, `-slide-in`, `-fade-in` | cosmetic only (not user-visible); rename to `ograms-*`/`ogrammar-*` optional, low priority |
| highlighter.ts:151-154 | spelling/grammar `#e53935`, clarity/style grey `#6b7280` | **functional** issue colors — keep (decision), not brand |
| highlighter.ts:40, index.html benchmark URLs | `github.com/zazzn/opengrammar/...docs/25-…` | repo path OK (zazzn fork); leave |

*content/autocomplete.ts, index.ts, etc.: no old palette — ghost text is neutral. Clean.*

## D. Web — Root landing `index.html`

| file:line | what is wrong | what it must become |
|---|---|---|
| index.html:6 | `<title>OpenGrammar — The Free, Privacy-First Writing Assistant</title>` | OGrammar |
| index.html:7-8 | meta description + keywords say "OpenGrammar" repeatedly | OGrammar |
| index.html:9 | `<meta name="author" content="Swadhin Biswas">` (upstream author) | remove / OGrammar maintainer |
| index.html:10 | `og:title` "OpenGrammar — …" | OGrammar |
| index.html:11 | `og:description` "OpenGrammar is the free…" | OGrammar |
| index.html:13 | `og:image` `…swadhinbiswas/opengrammar/main/logo.svg` (upstream URL + old mark) | zazzn-repo or hosted **new green** OG image |
| index.html:14 | `<link rel="icon" href="logo.svg">` → old blue/violet quill | new green favicon |
| index.html:17 | Inter + JetBrains Mono Google Fonts | Geist (+ keep mono if wanted) |
| index.html:24 | `--primary:#4f46e5;--primary-l:#818cf8;--primary-d:#3730a3` | green ramp on `#1FA463` |
| index.html:25 | `--accent:#7c3aed;--accent-l:#a78bfa` (violet) | green sibling / drop |
| index.html:29 | `--blue:#2563eb` (used for style-highlight) | functional — decide |
| index.html:22-23 | warm-paper bg `--bg:#fdfbf7` etc + warm `--fg:#1a1816` | new canvas `#FBFCFB` / `#16191D` |
| index.html:32 | `--font:'Inter',…` | Geist |
| index.html:39-49 | **dark theme** tokens still indigo: `--primary:#818cf8;--accent:#a78bfa` | green dark sibling `#34C77F` |
| index.html:60 | `.gradient-text` `linear-gradient(primary,accent)` indigo→violet hero text | green gradient |
| index.html:65-69 | hero **blur orbs** `.orb-1=var(--primary)`, `.orb-2=var(--accent)`, `.orb-3=#06b6d4` (indigo/violet/cyan) | green-family orbs (or remove for new aesthetic) |
| index.html:164-166 | step-num gradients `primary→accent`, `accent→#ec4899` (violet→pink) | green system |
| index.html:424 | inline bar-fill `linear-gradient(primary,accent)` | green |
| index.html:270-271,525,536 | nav/footer logo `<img src="logo.svg">` + text "OpenGrammar", "#using-opengrammar" anchors | new mark + "OGrammar" |
| index.html:279,299,320,498,501,512,544-546 | GitHub/clone links `github.com/swadhinbiswas/opengrammar` | `github.com/zazzn/opengrammar` |
| index.html:313-314,334,471 | body copy "OpenGrammar is the free…", compare-table header "OpenGrammar" | OGrammar |
| **logo.svg** (root) | the file itself: `#3B82F6`→`#8B5CF6` gradient, old quill/check mark — used as favicon, og:image, nav+footer logo | replace with new green "O + wave" SVG |

## E. Web — Docs (`docs/`)

| file:line | what is wrong | what it must become |
|---|---|---|
| docs/index.html:10 | Inter + JetBrains Mono Google Fonts | Geist |
| docs/index.html:23-30 | sidebar logo `fill="url(#logo-gradient)"` with stops `#3B82F6`→`#8B5CF6` (blue→violet) + checkmark only (no "O", no wave) | new green "O + wave" mark |
| docs/index.html:126,159,223,551,656 | `github.com/swadhinbiswas/opengrammar` (and `…/blob/main/docs/07-…`) links | `github.com/zazzn/opengrammar` |
| docs/index.html:1262 | footer "Built with ❤️ by [Swadhin Biswas](github.com/swadhinbiswas)" | OGrammar maintainer / remove upstream author |
| docs/styles.css:15-24 | `--primary-50…900` ramp = indigo/periwinkle (`#4F66F0` 500, `#303EC4` 700) | green ramp on `#1FA463` |
| docs/styles.css:59-65 | `--purple-50…600` (`#7C3AED`) used in hero/badge/code gradients | drop violet / green |
| docs/styles.css:75 | `--font-sans:'Inter',…` | Geist |
| docs/styles.css:8-12,68-72 | warm `--paper-bg:#FDFBF7` / dark `#0F1115` surfaces | new `#FBFCFB` / `#16191D` |
| docs/styles.css:195,204,253,722,1337 | hero/badge/callout `linear-gradient(primary-600, purple-600)` indigo→violet | green |
| docs/styles.css:287,370-371,494,569,576,615-616,766,879,1107-1108,1129,1462,1569-1570 | dozens of `var(--primary-xxx)` accents (links, focus rings, tabs, code, kbd) inherit indigo via the token swap | auto-fixed once `--primary-*` ramp is recolored green |

*Note: docs title/version already "OGrammar"/"v0.9"; copy is fine — only fonts, logo, color ramp, author, and repo links are residue. The blue `--blue-*`/red/amber/green functional ramps are fine.*

## F. Playground & misc

| file:line | what is wrong | what it must become |
|---|---|---|
| extension/public/playground/qa.html:15,17 | `--accent:#4f46e5`, `--llm:#2563eb` (dev QA harness) | green accent (low priority — internal tool) |
| extension/public/playground/qa.html:27 | `font-family: Inter, …` | Geist (low priority) |

## Manifest / brand copy
`opengrammar/extension/manifest.json` — **already clean**: name `"OGrammar"`, title `"OGrammar"`, description is brand-neutral ("Your privacy-first, open-source writing assistant…"), icons point at the already-new `icon-16/48/128.png`. **No change needed** unless you want to swap the description tagline to match new marketing.

## Already on the new brand (NOT residue — do not touch)
- `extension/public/icon.svg` + `icon-16/48/128.png` — confirmed green (`#34C77F`/`#16191D`).
- `manifest.json` name/title/description.
- Extension popup/options/docs **copy** already says "OGrammar".

---

## RESIDUE COUNT

- **Extension popup:** ~13 sites (popup.css color/font/logo-comment block + popup.tsx ring colors + quill SVG)
- **Extension options:** ~7 sites (primary blue, blue focus, about gradient, quill logo SVG, missing Geist)
- **Extension content (highlighter.ts):** **44 lines** of old indigo/violet palette (the single largest concentration) + the violet→pink badge gradient
- **Root index.html:** ~20 sites (title, author=Swadhin, og:image, indigo+violet tokens incl. dark theme, orbs, gradient-text, step gradients, Inter font, warm-paper bg, OpenGrammar copy, swadhinbiswas links) + **logo.svg** file itself (old blue→violet quill, used as favicon/og/nav/footer)
- **Docs:** ~5 HTML sites (Inter, blue→violet logo gradient, Swadhin footer + author link, swadhinbiswas repo links) + **~25 CSS token/usage sites** (indigo `--primary-*` ramp, `--purple-*`, Inter, warm/dark surfaces, gradient stops)
- **Playground qa.html:** 3 sites (low priority)

**Total residue: ~120 distinct sites across 9 files** (popup.css, popup.tsx, options.css, options/index.html, highlighter.ts, root index.html, root logo.svg, docs/index.html, docs/styles.css) — plus the low-priority playground qa.html. Of these, the **highest-impact reusable fixes** are the three token blocks (popup.css `:root`, root index.html `:root` light+dark, docs/styles.css `--primary-*`/`--purple-*` ramps) and the two SVG marks (root `logo.svg`, docs inline logo, options inline quill, popup inline quill) — recoloring those ~6 anchors cascades to roughly two-thirds of the individual `var(--…)` hits automatically; the remaining hardcoded hexes in `highlighter.ts` (44) must be hand-edited since they don't use tokens.

Key absolute paths:
- `/home/zazzn/opengrammar/opengrammar/extension/src/popup/popup.css`, `popup.tsx`
- `/home/zazzn/opengrammar/opengrammar/extension/src/options/options.css`, `index.html`, `options.tsx`
- `/home/zazzn/opengrammar/opengrammar/extension/src/content/highlighter.ts`
- `/home/zazzn/opengrammar/index.html`, `/home/zazzn/opengrammar/logo.svg`
- `/home/zazzn/opengrammar/docs/index.html`, `/home/zazzn/opengrammar/docs/styles.css`
- `/home/zazzn/opengrammar/opengrammar/extension/public/playground/qa.html`

---

## Windows desktop + installer
Confirmed: no `.ico`, no `.rc`, no `winres`/`winresource`/`embed-resource` crate anywhere. The exe ships with the default Rust/Windows blank icon. I now have everything needed for the complete inventory.

---

# Windows Desktop App + Installer — New-Brand Gap Inventory

**Repo root:** `/home/zazzn/opengrammar` · all desktop paths under `/home/zazzn/opengrammar/desktop/`
**New mark (source of truth):** `extension/public/icon.svg` and `obsidian/OGrammar-Phase2/assets/ogrammar-mark.svg` — off-black `#16191D` squircle (rx 28), off-white `#F4F6F4` "O" ring (circle cx64 cy52 r26 stroke 11), green `#34C77F` spellcheck wave.
**Locked palette:** accent green `#1FA463` (light) / `#34C77F` (dark sibling); canvas off-white `#FBFCFB`, off-black `#16191D`; issue colors rose `#D1495B` / steel `#3D7DCA` / ochre `#C7821A`; Geist type.

## Headline finding
The desktop app embeds **NO application icon at all**. `build.rs` only embeds a Win32 *manifest* (DPI + Common-Controls), never an `.ico`. There is no `.rc`, no `winres`/`winresource`/`embed-resource` dependency, and no icon file anywhere in the desktop tree. Therefore the **`.exe`, taskbar, Alt-Tab, the startup `MessageBoxW`, the installer wizard, the Programs-and-Features uninstall entry, and the Start-menu/desktop shortcuts all show the generic default Windows icon** — the new green "O" appears nowhere on the Windows side. The old indigo/violet brand is still hardcoded in `settings.rs`, `pill.rs`, and `suggestion.rs`; the underline/tray colors are off-brand legacy hues.

## Gap table

| File:line | Current state | What it must become |
|---|---|---|
| `desktop/ograms-hotkey/build.rs` (whole file) | Embeds only the Win32 manifest; no icon resource | Also embed an app icon. Add `winresource` (or `embed-resource`) build-dep and set the `.ico`, OR add an `.rc`. Without this the exe has no icon. |
| `desktop/ograms-hotkey/Cargo.toml:11-13` | `[build-dependencies]` has only `embed-manifest` | Add `winresource = "0.1"` (or `embed-resource`) so build.rs can compile/attach the `.ico`. |
| **NEW asset needed** `desktop/ograms-hotkey/assets/OGrammar.ico` (does not exist) | — | Multi-resolution `.ico` (16/20/24/32/48/64/256) rendered from the new `icon.svg`. This single asset feeds the exe, taskbar, Alt-Tab, MessageBox, and the installer. |
| `desktop/ograms-hotkey/src/tray.rs:120-126` | Tray dots: Active `0x22_C55E` (generic green, not brand), Paused `0x9C_A3AF`, Checking `0x3B_82F6` (blue), NoField `0x6B_7280`, Error `0xEF_4444` | Active → brand green `0x1FA463` (or `0x34C77F` on dark taskbars). Checking → brand green tint, not blue `0x3B82F6`. Error → rose `0xD1495B` to match new issue palette. Better: replace the flat dot with the actual "O" mark (green when active, greyed when paused) so the tray shows the brand, not an anonymous dot. |
| `desktop/ograms-hotkey/src/tray.rs:138-217 (`make_dot_icon`)` | Generates a flat filled circle at runtime as the tray icon | Either tint per new palette (minimum) or render the new "O"-over-wave glyph (proper fix). If switching to a real glyph, ship a small template/PNG or draw the ring+wave in GDI. |
| `desktop/ograms-hotkey/src/tray.rs:73-79` (tooltips) | Tooltip text "OGrammar — …" | Brand name is fine; no change needed (verify em-dash/wording stays consistent with new voice). |
| `desktop/ograms-hotkey/src/settings.rs:3-4` (doc comment) | "Indigo→purple gradient header (#4F46E5 → #7C3AED)… indigo section headers" | Update doc to describe the new green/off-black brand. |
| `desktop/ograms-hotkey/src/settings.rs:78-83` (palette consts) | `C_INDIGO 0x4F46E5`, `C_PURPLE 0x7C3AED`, `C_BODY 0xFAFBFF`, `C_LAVENDER 0xE0E7FF` (+ `C_TEXT`, `C_GREY`) | Replace with brand: header should use off-black `#16191D` (or a green band), accent green `#1FA463`; body canvas `#FBFCFB`; section-header color → green `#1FA463`; drop lavender/indigo/purple entirely. |
| `desktop/ograms-hotkey/src/settings.rs:679-695` (`paint_header` gradient) | Draws indigo→purple gradient header by lerping `C_INDIGO`→`C_PURPLE` in 2px columns | Replace gradient with new brand treatment: solid off-black `#16191D` band (or subtle green), and ideally paint the new "O" mark glyph next to the wordmark. |
| `desktop/ograms-hotkey/src/settings.rs:697-711` (wordmark + subtitle) | Wordmark "OGrammar" in `0xFFFFFF`; subtitle in `C_LAVENDER 0xE0E7FF` | Keep wordmark (switch to Geist if a font is bundled, else keep Segoe UI); subtitle color → a light grey on the off-black band, not lavender. Add the "O" mark to the left of the wordmark. |
| `desktop/ograms-hotkey/src/settings.rs:804` (section color) | `ID_SECTION_AI \| ID_SECTION_APPS => C_INDIGO` | Section headers → brand green `0x1FA463`. |
| `desktop/ograms-hotkey/src/settings.rs:284` (window title) | `w!("OGrammar Settings")` — title-bar text only; **no `hIcon`/`hIconSm` set on the WNDCLASSW**, so the settings window shows the default Windows icon | Brand name is fine, but the window class never assigns an icon (settings.rs:88-94 `WNDCLASSW` has no `hIcon`). Once the `.ico` exists, `LoadIcon` it into the class so the settings window title bar / Alt-Tab show the green "O". |
| `desktop/ograms-hotkey/src/pill.rs:50` | `const INDIGO: u32 = 0x4F46E5;` | Rename + revalue to brand green `0x1FA463`. |
| `desktop/ograms-hotkey/src/pill.rs:250` | Pill background `CreateSolidBrush(cref(INDIGO))` — the rewrite pill is an indigo chip | Brand green `#1FA463` pill (off-white text already at pill.rs:721 stays). |
| `desktop/ograms-hotkey/src/pill.rs:613,662,767` | Accent text (`SetTextColor(cref(INDIGO))`) on tone menu / preview / pill | Brand green `#1FA463`. |
| `desktop/ograms-hotkey/src/pill.rs:201,332,414,483` | Surfaces filled `0xFAFBFF` (old near-white) | New canvas off-white `#FBFCFB`. |
| `desktop/ograms-hotkey/src/pill.rs:591-592` (diff colors) | Insertion green `0x0E7A0E`, deletion red `0xC62828` | Insertion → brand green `#1FA463`; deletion → rose `#D1495B` to match the new issue palette. |
| `desktop/ograms-hotkey/src/pill.rs:125,218 etc.` | Font `w!("Segoe UI")` throughout | If Geist is bundled/installed, switch face; otherwise Segoe UI is an acceptable system fallback (flag as brand-incomplete). |
| `desktop/ograms-hotkey/src/suggestion.rs:322` | AI kicker color `if info.is_ai { 0x4F46E5 } else { 0xE53935 }` — indigo AI / red correctness | AI kicker → steel `#3D7DCA` (new AI/context color); correctness kicker → rose `#D1495B`. |
| `desktop/ograms-hotkey/src/suggestion.rs:201` | Card background `CreateSolidBrush(cref(0xFAFBFF))` | New canvas off-white `#FBFCFB`. |
| `desktop/ograms-hotkey/src/suggestion.rs:336` | Reason text grey `0x5F6368` | Optional: align to brand neutral grey; low priority. |
| `desktop/ograms-hotkey/src/suggestion.rs:159,218` | Card class `w!("OGrammarCardClass")`, font Segoe UI; **no hIcon on class** (popup card, acceptable) | Name fine; font as above. No icon needed (transient popup). |
| `desktop/ograms-hotkey/src/windows_app.rs:81-83` | `LLM_ARGB = 0xFF3B_82F6` — blue dotted LLM/"context" underline, comment says "matching the extension's #3b82f6" | LLM/context underline → steel `#3D7DCA` (`0xFF3D7DCA`). Update the comment too. |
| `desktop/ograms-hotkey/src/windows_app.rs:2103-2110` (`argb_for_kind`) | Correctness underline `0xFFE5_3935` (red); style/other `0xFF6B_7280` (grey) | Correctness → rose `0xFFD1495B`; style/clarity → ochre `0xFFC7821A` (new "style" issue color). Keep the dashed-vs-solid distinction. |
| `desktop/ograms-hotkey/src/windows_app.rs:1575` | `let dashed = argb == 0xFF6B_7280;` — dashed style keyed off the OLD grey value | Update this literal to whatever the new style/ochre ARGB becomes, or the dashed style flag silently breaks. |
| `desktop/ograms-hotkey/src/windows_app.rs:2403,2418` | Startup / error `MessageBoxW` titled `"OGrammar"` with `MB_ICONINFORMATION` | Text is fine, but the dialog inherits the exe icon — once the `.ico` is embedded it auto-shows the green "O". No code change beyond the icon. |
| `desktop/installer/OGrammar.iss:33` | `[Setup]` has **no `SetupIconFile`** | Add `SetupIconFile=OGrammar.ico` so the setup.exe itself carries the green "O" (right now setup.exe is the default Inno icon). |
| `desktop/installer/OGrammar.iss:39` | `UninstallDisplayIcon={app}\{#AppExe}` — points at the exe, which has no embedded icon | Correct *once the exe embeds the `.ico`*; until then the uninstall/Apps-list entry is blank/generic. Alternatively point at a shipped `.ico`. |
| `desktop/installer/OGrammar.iss` (missing) | No `WizardImageFile` / `WizardSmallImageFile` | Add branded wizard banner + small image (off-black/green) derived from the mark, so the installer pages are branded, not the default Inno blue. |
| `desktop/installer/OGrammar.iss:20` | `AppPublisher "zazzn"` (and `AppURL https://github.com/zazzn/opengrammar`) | Publisher likely should read **"OGrammar"** (brand) rather than the GitHub handle "zazzn" — shown verbatim in the UAC-less install + Programs list. Confirm intended publisher string. |
| `desktop/installer/OGrammar.iss` `[Files]` | Ships only `OGrammar.exe`; never copies an `.ico` | If `UninstallDisplayIcon`/shortcuts should reference a standalone `.ico`, add `Source: "OGrammar.ico"; DestDir: "{app}"` and reference `{app}\OGrammar.ico`. (Not required if the exe embeds the icon.) |
| `desktop/installer/build-installer.ps1` | Stages only the release exe next to the `.iss` | Also stage/locate `OGrammar.ico` (and wizard images) so ISCC finds them at compile time. |

## New assets required (all derive from `extension/public/icon.svg` / `obsidian/.../ogrammar-mark.svg`)
1. **`OGrammar.ico`** — multi-res (16/20/24/32/48/64/256) from the SVG. Single most important gap: feeds exe icon, taskbar, Alt-Tab, settings-window class icon, MessageBox, `UninstallDisplayIcon`, and Start-menu/desktop shortcuts. Place at `desktop/ograms-hotkey/assets/OGrammar.ico` and stage a copy into `desktop/installer/`.
2. **Tray glyph** — either a recolored dot (min) or a proper "O"-over-wave tray icon in the new green; tray.rs currently synthesizes a flat circle at runtime.
3. **Installer `SetupIconFile` icon** — same `OGrammar.ico` (or a setup-specific variant).
4. **Installer wizard images** — `WizardImageFile` (164×314-ish) + `WizardSmallImageFile` (55×55) on the off-black/green brand.
5. **(Optional) Geist font** bundled with the installer if the desktop UI is to match the brand type; otherwise Segoe UI remains a documented fallback (settings.rs / pill.rs / suggestion.rs all hardcode `w!("Segoe UI")`).

## Clean (no change needed)
- `desktop/ograms-hotkey/src/config.rs` — paths/registry keys all already "OGrammar"; no old colors or brand strings.
- `desktop/ograms-hotkey/src/overlay.rs` — color-agnostic; it draws whatever ARGB the caller passes, so fixing the colors in `windows_app.rs` (`LLM_ARGB`, `argb_for_kind`) is sufficient.
- `desktop/README.md`, `desktop/ograms-hotkey/README.md` — already use the OGrammar name (no "OpenGrammar"/"Swadhin").
- `engine_data.rs`, `autocorrect.rs` — no brand-color/old-name hits (the earlier broad grep matched only the unrelated word "Inter" inside other tokens, not the font).
