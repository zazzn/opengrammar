---
tags: [ogrammar, phase-2, launch, tracker]
owner: Launch Director
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]] - THE master go-live tracker

# Launch Tracker

## Done this session (CEO autonomous brand push - 2026-06-19)
The product now wears the new identity on both shipped surfaces:
- **Extension UI fully repainted** off indigo/Inter onto a shared `tokens.css` (one green source): popup, options, the in-page assistant (`highlighter.ts`, 48 spots), diff + autocomplete previews. New "O + wave" mark in the popup + options headers. Built, FP 118/0, brand grep-gate clean. -> B1, B2, B3, B4, B5, B6 done.
- **GUI fixes:** the empty "Advanced settings" panel now shows only for Ollama/custom; the three duplicate Enable controls cut to one; emoji removed from the provider dropdown; AI card honest when no key; tertiary-text contrast raised. -> GUI P0-1, P0-2, P0-4 done.
- **Windows app rebranded:** `OGrammar.ico` (multi-res) generated + embedded in the .exe (verified: ProductName OGrammar, FileVersion 0.9.0.0); settings window, tray Active dot, pill, suggestion card all on green/steel/off-white; built + deployed + running. -> W1, W2, W4, W5, W6, W7, W8 done. Added `npm run icons` + `npm run ico` pipelines.

- **Web rebranded too:** landing `index.html` + root `logo.svg` + `docs/index.html` + `docs/styles.css` repainted to green/Geist/OGrammar; the upstream `Swadhin Biswas` author meta + footer credit + the `swadhinbiswas` og:image stripped from the marketing surfaces (the Apache fork-attribution line kept). Web brand-gate clean. -> B7, B8, B9, B10, E3 done.

**Still next:** README still leads as OpenGrammar (R2); repo has the nested `opengrammar/opengrammar` tree + Bun-on-main CI (R1, R6, R7); Geist is a Google-Fonts link on the web but a system fallback in the extension, not self-hosted (B11); dark mode + the rose/steel/ochre issue-color rebrand deferred for cross-product consistency; store + privacy tracks (S*, D*) not started.

# OGrammar v1.0.0 Launch Tracker

> Owner: Launch Director - Reports to: CEO

## State of play

We are roughly **15-20% of the way to a credible public launch**. The honest headline: **brand is about 5% propagated** - only the extension's `icon.svg` + the three raster icons carry the new green "O + wave" mark; the other ~120 residue sites across nine files (popup, options, `highlighter.ts`, root `index.html`, root `logo.svg`, docs HTML/CSS) plus the entire Windows desktop UI still wear the old indigo/violet OpenGrammar identity, and the Windows exe ships **no embedded icon at all**. Structurally we are blocked on a duplicated nested `opengrammar/opengrammar/` tree, CI that triggers only on `main` (the active branch is `og-rewrite`) and still runs on Bun against an npm project, and **no live `/privacy` URL** - which alone is an automatic Chrome Web Store rejection. Verified state: versions are `0.9.0` across manifest/package/`.iss`; tags are `v0.9.0` plus a stray lightweight `opengrammar` tag; a duplicate `ci.yml` exists at both `.github/workflows/` and `opengrammar/.github/workflows/`; no privacy markdown exists in `docs/`.

## The launch tracker

| # | Task | Category | Owner | Priority | Status |
|---|---|---|---|---|---|
| **REPO HYGIENE** ||||||
| R1 | Resolve dual nested `opengrammar/opengrammar/` layout; pick one canonical tree, delete duplicate `README`/`NOTICE`/`LICENSE`/`biome.json`/`deploy.sh`/`ci.yml`; repoint docs, CI, deploy paths | Repo-hygiene | [[Release Engineering]] | P0 | todo |
| R2 | Rewrite root `README.md` to canonical OGrammar brand; fix install paths to resolved R1 layout; remove quill emoji + `logo.svg` lockup; stop leading as "OpenGrammar" | Repo-hygiene | [[Frontend]] | P0 | todo |
| R3 | Reconcile/merge nested `opengrammar/README.md` (the "Google Docs out of scope" line contradicts shipped `google-docs.ts`) into the single canonical README | Repo-hygiene | [[Frontend]] | P0 | todo |
| R4 | Preserve required Apache-2.0 attribution: keep "Swadhin Biswas" in `NOTICE`/`LICENSE`/README fork-notice; strip upstream identity ONLY from marketing surfaces (author meta, og:image, title, docs footer) | QA/Legal | [[Project Management]] | P0 | todo |
| R5 | Audit/refresh the two `NOTICE` files so they agree; exactly one authoritative `NOTICE` per shipped artifact; retain Harper (Apache-2.0) + Norvig n-gram credit | QA/Legal | [[Release Engineering]] | P0 | todo |
| R6 | Fix CI triggers: add `og-rewrite` to push/PR on `ci.yml`, `deploy-pages.yml`; align `auto-review.yml` | Repo-hygiene | [[Frontend]] | P0 | todo |
| R7 | De-Bun CI: replace `oven-sh/setup-bun` + `bun install/x tsc/run build` with `actions/setup-node` + `npm ci` + `npm run build` in `ci.yml` and `auto-review.yml` | Repo-hygiene | [[Frontend]] | P0 | todo |
| R8 | CI grep-gate for brand residue: fail build on `4F46E5`,`7C3AED`,`2563eb`,`Inter`,`quill`,`Swadhin Biswas`,`swadhinbiswas/opengrammar`, upstream og:image URL across `index.html`,`docs/`,`popup.css`,`options.css`,`icon.svg`,`manifest.json` | Repo-hygiene | [[Frontend]] | P0 | todo |
| R9 | Version-bump strategy: atomically set manifest + `package.json` + `.iss` `AppVersion` `0.9.0`→`1.0.0` at launch; tag `v1.0.0`; delete stray lightweight `opengrammar` tag; document semver rule in runbook | Repo-hygiene | [[Release Engineering]] | P0 | todo |
| R10 | Replace `deploy.sh` (root + nested, both print "OpenGrammar" and hard-require Bun) with npm-based `release.sh` | Repo-hygiene | [[Release Engineering]] | P1 | todo |
| R11 | Remove the "Process Review as Swadhin Biswas" persona step from `auto-review.yml`; rename to OGrammar bot identity or delete | Repo-hygiene | [[Release Engineering]] | P1 | todo |
| R12 | Promote `og-rewrite` to GitHub default branch at `v1.0.0`; repoint CI/Pages; retire `main`; update branch-protection | Repo-hygiene | [[Release Engineering]] | P1 | todo |
| R13 | `.gitignore` review: add `ogrammar-<ver>.zip`, `*.maps.zip`, Inno `Output/`; confirm `obsidian/` vault inclusion is intentional | Repo-hygiene | [[Frontend]] | P2 | todo |
| R14 | Strip dev artifacts from packaged zip: exclude `extension/scripts/create-icons.mjs`, `playground/`, source maps, `.fp-corpora/`; allowlist-diff the zip | Repo-hygiene | [[Release Engineering]] | P1 | todo |
| R15 | Refresh `ROADMAP.md`,`CONTRIBUTING.md`,`CODE_OF_CONDUCT.md`,`GRAMMAR_RULES.md`, issue/discussion templates for OGrammar identity + repo URL | Repo-hygiene | [[Project Management]] | P2 | todo |
| **BRAND PROPAGATION** ||||||
| B1 | Author locked `tokens.css` (the critical-path gate): accent `#1FA463`/dark `#34C77F`, off-black `#16191D`/off-white `#FBFCFB` ramp, 3 issue colors (rose `#D1495B`, steel `#3D7DCA`, ochre `#C7821A`), Geist; one source for popup/options/landing/docs/desktop | Brand-propagation | [[Brand & Design]] | P0 | todo |
| B2 | Migrate `popup.css` onto tokens: delete `--og-primary #4F46E5` indigo ramp + `--og-accent #7C3AED` violet; recolor brand-icon gradient, score-bg, focus rings, shadows; replace Inter `<link>` with self-hosted Geist `@font-face`; fix header comments | Brand-propagation | [[Frontend]] | P0 | todo |
| B3 | `popup.tsx`: ScoreRing `score>=80` `#4F46E5`→`#1FA463`; ring track `#EEF2FF`→green-tint; replace inline quill SVG (line ~609) with new "O + wave" mark; fix header comment | Brand-propagation | [[Frontend]] | P0 | todo |
| B4 | Migrate `options.css` onto tokens: `--primary #2563eb`→`#1FA463`, hover `#1d4ed8`→darker green, blue focus rings→green, `.about-section` blue gradient→green; add Geist to font stack | Brand-propagation | [[Frontend]] | P0 | todo |
| B5 | `options/index.html`: replace header quill+check+node SVG with new mark; add Geist `<link>`/self-host; (optional) export filename `opengrammar-settings`→`ograms-settings` in `options.tsx:500` | Brand-propagation | [[Frontend]] | P0 | todo |
| B6 | Repaint `highlighter.ts` (44 lines, largest concentration, hardcoded hexes - no tokens): all `#4F46E5`/`#4338CA`/`#EEF2FF`/`#C7D2FE`/`#F5F3FF`/`#DDD6FE`/`#818CF8` → green system; replace violet→pink badge gradient (`#7C3AED`/`#DB2777`) + launcher gradient with green; decide `REVIEW_LLM_LINE #3b82f6` (steel vs functional). Keep functional issue colors `#e53935`/`#6b7280` | Brand-propagation | [[Frontend]] | P0 | todo |
| B7 | Rebrand root `index.html`: title, author=Swadhin meta, og:image (upstream raw URL), `--primary/--accent/--blue` light+dark tokens, indigo/violet orbs, gradient-text, step gradients, Inter+JetBrains font link, warm-paper bg→`#FBFCFB`/`#16191D`, "OpenGrammar" copy, `swadhinbiswas` links→`zazzn` | Brand-propagation / Web | [[Frontend]] | P0 | todo |
| B8 | Replace root `logo.svg` (blue→violet quill, used as favicon + og:image + nav + footer) with new green "O + wave" mark + horizontal Geist "OGrammar" lockup + favicon | Brand-propagation | [[Brand & Design]] | P1 | todo |
| B9 | Align `docs/index.html`: Inter→Geist, sidebar logo gradient `#3B82F6`→`#8B5CF6` checkmark→new mark, `swadhinbiswas` repo links→`zazzn`, remove "Built with love by Swadhin Biswas" footer (line ~1262) | Brand-propagation / Web | [[Frontend]] | P1 | todo |
| B10 | Recolor `docs/styles.css`: `--primary-*` indigo ramp + `--purple-*` `#7C3AED` → green ramp on `#1FA463`; Inter→Geist; warm/dark surfaces→`#FBFCFB`/`#16191D`; hero/badge/callout gradients→green (cascades to ~25 `var(--primary-*)` hits) | Brand-propagation / Web | [[Frontend]] | P1 | todo |
| B11 | Verify Geist license ships: self-host, include OFL/MIT license file in repo + extension package; Release Eng sign-off | QA/Legal | [[Release Engineering]] | P1 | todo |
| B12 | Replace stale repo screenshot `screenshot-2026-04-22_13.14.06.png` (old indigo UI) with real capture of migrated build | Brand-propagation | [[Brand & Design]] | P2 | todo |
| B13 | Recolor playground `qa.html`: `--accent #4f46e5`, `--llm #2563eb`→green; Inter→Geist (low priority, internal tool) | Brand-propagation | [[Frontend]] | P2 | todo |
| **WINDOWS DESKTOP** ||||||
| W1 | Create `OGrammar.ico` (multi-res 16/20/24/32/48/64/256 from new `icon.svg`) at `desktop/ograms-hotkey/assets/`; stage copy into `desktop/installer/`. Single most important Windows gap - feeds exe, taskbar, Alt-Tab, settings-window class, MessageBox, UninstallDisplayIcon, shortcuts | Windows | [[Brand & Design]] | P0 | todo |
| W2 | Embed the icon: add `winresource` (or `embed-resource`) build-dep to `Cargo.toml:11-13`; extend `build.rs` to compile/attach `OGrammar.ico` (currently embeds only the Win32 manifest) | Windows | [[Release Engineering]] | P0 | todo |
| W3 | Assign `hIcon`/`hIconSm` via `LoadIcon` on the settings `WNDCLASSW` (`settings.rs:88-94`) and the card class so windows show the green "O" | Windows | [[Release Engineering]] | P1 | todo |
| W4 | `settings.rs` palette: replace `C_INDIGO 0x4F46E5`/`C_PURPLE 0x7C3AED`/`C_LAVENDER 0xE0E7FF`/`C_BODY 0xFAFBFF`; recolor `paint_header` indigo→purple gradient to off-black `#16191D` band; section headers (`ID_SECTION_AI/APPS`) →green `0x1FA463`; subtitle→light grey; fix doc comment; paint the "O" mark next to wordmark | Brand-propagation / Windows | [[Brand & Design]] | P1 | todo |
| W5 | `tray.rs`: recolor `make_dot_icon` states - Active→`0x1FA463`/`0x34C77F`, Checking `0x3B82F6`→green tint, Error `0xEF4444`→rose `0xD1495B`; ideally render the "O + wave" glyph instead of a flat dot | Brand-propagation / Windows | [[Brand & Design]] | P1 | todo |
| W6 | `pill.rs`: `INDIGO 0x4F46E5`→`0x1FA463` (rename + revalue); pill bg + accent text (lines 250/613/662/767)→green; surfaces `0xFAFBFF`→`0xFBFCFB`; diff colors insertion `0x0E7A0E`→green, deletion `0xC62828`→rose `0xD1495B` | Brand-propagation / Windows | [[Brand & Design]] | P1 | todo |
| W7 | `suggestion.rs`: AI kicker `0x4F46E5`→steel `0x3D7DCA`, correctness→rose `0xD1495B` (line 322); card bg `0xFAFBFF`→`0xFBFCFB` (201); reason grey (336) optional | Brand-propagation / Windows | [[Brand & Design]] | P1 | todo |
| W8 | `windows_app.rs`: `LLM_ARGB 0xFF3B82F6`→steel `0xFF3D7DCA` (+comment); `argb_for_kind` correctness `0xFFE53935`→rose `0xFFD1495B`, style/grey `0xFF6B7280`→ochre `0xFFC7821A`; **update the `dashed = argb == 0xFF6B_7280` literal at line 1575** or dashed-style flag silently breaks | Brand-propagation / Windows | [[Frontend]] | P1 | todo |
| W9 | Installer `OGrammar.iss`: add `SetupIconFile=OGrammar.ico`; add `WizardImageFile`(164×314) + `WizardSmallImageFile`(55×55) branded images; confirm `AppPublisher` "zazzn"→"OGrammar"; verify `UninstallDisplayIcon` resolves once exe embeds icon; `[Files]` ship `.ico` if shortcuts reference standalone | Windows | [[Release Engineering]] | P1 | todo |
| W10 | `build-installer.ps1`: stage/locate `OGrammar.ico` + wizard images next to `.iss` so ISCC finds them | Windows | [[Release Engineering]] | P1 | todo |
| W11 | Unsigned-installer / SmartScreen decision: (a) ship unsigned + document "More info → Run anyway" bypass, or (b) buy OV/EV cert; record in runbook | Windows | [[Release Engineering]] | P0 | todo |
| W12 | Build + publish release assets: `ISCC.exe /DAppVersion=1.0.0` → `OGrammar-1.0.0-setup.exe`; attach to tagged GitHub Release; `.iss` AppVersion = manifest version | Windows | [[Release Engineering]] | P1 | todo |
| W13 | Auto-update story: in-app "check for updates" via GitHub Releases API, or documented manual re-download; at minimum document how a user gets v2 | Windows | [[Release Engineering]] | P2 | todo |
| W14 | Desktop QA on packaged installer: clean install, autostart-at-logon, tray/settings, per-app exclusion (browsers excluded by default), DPAPI key store in `%APPDATA%\OGrammar` | QA/Legal | [[Release Engineering]] | P1 | todo |
| **STORE / COMPLIANCE** ||||||
| S1 | Register CWS developer account + $5 fee; publish under dedicated "OGrammar" developer name (not personal identity) | Store/Compliance | [[Project Management]] | P0 | todo |
| S2 | Single-purpose statement: one sentence ("detect and correct writing issues in editable text fields on the web"); confirm content scripts/popup/options map to it | Store/Compliance | [[Release Engineering]] | P0 | todo |
| S3 | Permission justifications (exact Dashboard strings, archived in-repo): (a) `<all_urls>` host access; (b) `storage`/`activeTab`/`scripting`; (c) `wasm-unsafe-eval` CSP; (d) `web_accessible_resources` (why every site can fetch the 18 MB `harper_wasm_bg.wasm`, `ngram/model.bin`, dictionary) | Store/Compliance | [[Release Engineering]] | P0 | todo |
| S4 | Code the `<all_urls>` fallback as real code (#1 launch-blocker risk): runtime per-site `optional_host_permissions` opt-in path, ready if reviewer pushes back | Store/Compliance | [[Release Engineering]] | P1 | todo |
| S5 | Data-use disclosure form: declare only egress (BYO-key LLM text + opt-in autocomplete page-context to user-chosen provider only); no selling/unrelated/creditworthiness use; analytics in `chrome.storage.sync`; must match hosted policy word-for-fact | Store/Compliance | [[Release Engineering]] | P0 | todo |
| S6 | Listing copy: title, 132-char summary, long description leading "private, local-first writing help everywhere on the web"; provider grid; Gmail/Docs; category = Productivity; en locale (flag i18n debt) | Store/Compliance | [[UX]] | P0 | todo |
| S7 | 5 screenshots at 1280×800 from REAL migrated `dist/` via Playwright (never mockups): popup score, inline correction, tone rewrite, provider/Ollama settings, Gmail/Docs; Geist captions on off-black chrome | Web/Marketing | [[Frontend]] capture / [[Brand & Design]] art-direction | P0 | todo |
| S8 | Promo tile 440×280 + marquee 1400×560 + 128 store icon; templated SVG→PNG so they re-render on token change | Web/Marketing | [[Brand & Design]] | P1 | todo |
| S9 | Package versioned `dist/` zip under size budget; strip source maps (archive separately); CI guard fails if any API key/`.env` value bundled | Store/Compliance | [[Release Engineering]] | P0 | todo |
| S10 | Pre-submit smoke test on the exact zip (unpacked + unlisted Dashboard build): popup, options, inline highlight, autocorrect, one BYO-key path on a real site + Gmail + Docs; **confirm zero network calls with no provider configured** | QA/Legal | [[Release Engineering]] | P0 | todo |
| S11 | Submit Unlisted → promote public with percentage rollout; buffer one resubmission cycle; write `RELEASE-RUNBOOK.md` (submit + staged-% + rollback) | Store/Compliance | [[Release Engineering]] | P0 | todo |
| S12 | Confirm no remote code (re-scan clean): no `eval(`/`new Function`/CDN import; `wasm-unsafe-eval` is only eval-class token; all bytes ship in-package; document in S3 | Store/Compliance | [[Release Engineering]] | P0 | todo |
| **PRIVACY / WEB / MARKETING** ||||||
| D1 | Live hosted `/privacy` URL (mandatory - no submission exists until it resolves): GitHub Pages from `docs/` on `og-rewrite` | Web/Marketing | [[Frontend]] | P0 | todo |
| D2 | Canonical privacy text (single source, matches Data-Use form word-for-fact): local tier never leaves device; BYO-key only egress to chosen provider; API keys AES-GCM at rest never synced; analytics in user's own Google account; opt-in autocomplete page-context only when enabled | QA/Legal | [[Release Engineering]] | P0 | todo |
| D3 | In-product privacy panel (one screen, plain language) from popup + onboarding; persistent "Local-only / AI: <provider>" status chip | UX | [[UX]] | P1 | todo |
| D4 | Share privacy boilerplate with Mac client for one consistent local-first story | QA/Legal | [[Release Engineering]] | P2 | todo |
| E1 | Stand up GitHub Pages from `docs/` on `og-rewrite`; fix `deploy-pages.yml` (main-only; copies root `index.html`+`logo.svg`+`docs/`) to resolved branch/layout - this makes the `/privacy` URL stable | Web/Marketing | [[Frontend]] | P0 | todo |
| E2 | New landing IA + copy: single primary CTA ("Add to Chrome") above fold, secondary "See how it works," "what stays local" proof module, provider strip, honest feature copy; no invented claims | Web/Marketing | [[UX]] | P1 | todo |
| E3 | New `og:image`/`og:title`/`og:url` + favicon on new brand, replacing upstream raw.githubusercontent og:image | Web/Marketing | [[Frontend]] | P1 | todo |
| E4 | Lighthouse ≥95 (perf/a11y/SEO); total transfer <300 KB excl. fonts; ensure 18 MB WASM/model/dict NOT bundled into marketing site | Web/Marketing | [[Frontend]] | P2 | todo |
| E5 | Custom-domain decision (CEO, optional): changes `/privacy` URL + og: meta, must be decided before S5/D1 freeze; default = GitHub Pages subdomain | Web/Marketing | [[Project Management]] | P2 | todo |
| E6 | "Get the desktop app" download path on site for Windows installer + future Mac `.app` zip | Web/Marketing | [[Frontend]] | P2 | todo |
| **PRODUCT CORRECTNESS** ||||||
| P1 | Resolve Google Docs contradiction (CEO decision: KEEP): keep `content/google-docs.ts`, update both READMEs + listing copy, tell one single-purpose story (code + docs change, not just a flag) | Repo-hygiene | [[Frontend]] | P0 | todo |
| P2 | First-run onboarding: "first issue underlined in a real field" in <60s, no account, no forced key; inline permission rationale before first activation; "Replay setup" from options | UX | [[UX]] | P1 | todo |
| **MAC CLIENT** ||||||
| M1 | Confirm target Mac MDM status (CEO decision #1, defining question): if Accessibility MDM-blocked, P0-only floor accepted; answer before any P1 effort | Mac | [[Project Management]] | P0 | todo |
| M2 | Build `ograms-ffi` staticlib + offset-parity harness vs Windows (release gate): macOS FFI `Issue` byte-identical (char + utf16 offsets) | Mac | [[Mac Client]] | P0 | todo |
| M3 | P0: menu-bar app + global hotkey + Cmd-C selection check/rewrite + paste-in panel (`NSStatusItem`, nonactivating `NSPanel`, Keychain, provider parity) | Mac | [[Mac Client]] | P1 | todo |
| M4 | P1: AX focused-field read + `AXObserver` + transparent overlay underlines + AX/clipboard apply at Windows parity (conditional on M1) | Mac | [[Mac Client]] | P2 | todo |
| M5 | P2: rewrite pill + suggestion card + idle-gated autocorrect + learned-store + LaunchAgent autostart | Mac | [[Mac Client]] | P2 | todo |
| M6 | Distribution: ad-hoc-signed `OGrammar.app` (`codesign -s - --deep`) as `.zip`, run from `~/Applications`, `LSUIElement=true`; write `MACOS-INSTALL.md` (Gatekeeper bypass + grant flow) | Mac | [[Release Engineering]] | P1 | todo |
| M7 | Mac update path: document re-zip + re-`xattr` in `MACOS-INSTALL.md`; no crash telemetry by design | Mac | [[Mac Client]] | P2 | todo |
| **QA / LEGAL / SIGN-OFF** ||||||
| Q1 | Brand-residue grep sweep passes clean (R8 gate green) across all shipped surfaces | QA/Legal | [[Project Management]] | P0 | todo |
| Q2 | Privacy claim audit: every "stays local" statement matches actual data flow; no overclaiming across policy + panel + listing + Data-Use form | QA/Legal | [[Release Engineering]] | P0 | todo |
| Q3 | License/legal QA: Apache-2.0 `LICENSE`+`NOTICE` retained (R4/R5), Harper + Norvig credited, Geist license bundled (B11), no bundled LLM weights | QA/Legal | [[Release Engineering]] | P0 | todo |
| Q4 | WCAG 2.1 AA pass on popup, options, overlay (contrast both light/dark token pairs, focus order, keyboard operability of card + rewrite pill) | QA/Legal | [[UX]] | P1 | todo |
| Q5 | Cross-surface consistency: extension, Windows, Mac, landing, docs one brand + one local-first story; versions aligned across manifest/`package.json`/`.iss` | QA/Legal | [[Project Management]] | P1 | todo |
| Q6 | CEO sign-off gate: Goal 1 (CWS public, privacy URL live, justifications accepted, 100% rollout no flags) + Goal 2 (Mac `.app` runs from `~/Applications`, P0 floor) both accepted | QA/Legal | [[Project Management]] | P0 | todo |

## Critical path to v1.0.0 public

The serial spine; everything else parallelizes off it.

1. **R1 resolve nested layout** - unblocks every path/CI/deploy reference; nothing about packaging or Pages is reliable until there is one tree.
2. **B1 `tokens.css`** - the single token-lock gate; idles Frontend, UX, Brand, and the desktop pass until it lands.
3. **B2/B3/B4/B5/B6 migrate popup + options + highlighter off indigo/Inter onto tokens** - the extension UI must be on-brand before it can be screenshotted.
4. **R6/R7/R8 fix CI** (triggers + de-Bun + residue grep-gate) - so the migrated build actually builds and stays clean on `og-rewrite`.
5. **D2 canonical privacy text → E1 GitHub Pages live → D1 `/privacy` URL resolves** - without this the store submission cannot exist.
6. **S7 screenshots from the real migrated `dist/`** (depends on step 3) + **S3/S5 justifications + data-use form** (depend on step 5's URL being frozen).
7. **R9 version bump to 1.0.0 → S9 package zip** (source maps stripped, key-leak guard) **→ S10 smoke test on the exact zip**.
8. **S11 submit Unlisted → promote public** with staged rollout.

The Mac track (M-series) couples to Goal 1 by only `tokens.css` (B1) and `M1` MDM answer; it runs alongside from day one. The Windows icon chain (W1→W2→W3/W9) is parallel and gated only on the `.ico` asset.

## Gaps the audits missed

1. **Stray `opengrammar` git tag** - confirmed present alongside `v0.9.0`. R9 names it; flagging here because a lightweight tag literally named after the project will confuse release tooling and the GitHub Releases UI. Delete it explicitly.
2. **`deploy-pages.yml` copies the root `logo.svg`** - even after B8 replaces `logo.svg`, verify the Pages workflow's file-copy list still references the right asset names post-R1 flatten, or the live site 404s its favicon/og:image.
3. **No CSP / `web_accessible_resources` diff guard in CI** - S9 guards API keys, but nothing fails the build if `manifest.json`'s `<all_urls>` / `wasm-unsafe-eval` / WAR surface silently grows. Add a manifest-permissions snapshot test so a future commit can't widen the attack surface (and invalidate the accepted S3 justifications) unnoticed.
4. **`highlighter.ts` DOM ids are literally `opengrammar-*`** - cosmetic and not user-visible, but the R8 residue grep must be scoped to exclude these (and the `github.com/zazzn/opengrammar` repo paths, which are correct) or the gate produces false positives and gets disabled. Define the grep allowlist precisely.
5. **`screenshot-2026-04-22_13.14.06.png` may be referenced in more than README** - B12 must grep all of `index.html`, `docs/`, and both READMEs for the filename before swapping, or a stale indigo screenshot ships on a surface nobody checked.
6. **Geist self-host vs Google Fonts CSP** - the extension cannot load Google Fonts at runtime under MV3 CSP without a `font-src` exception; B2/B11 must self-host as `@font-face`. The audits say "replace Inter with Geist" but didn't flag that a naive Google Fonts `<link>` swap will be CSP-blocked in the packaged extension. Self-hosting is mandatory, not stylistic.
7. **Desktop `.exe` has no version-info resource either** - W2 adds the icon via `winresource`, but the same resource block should carry `FileVersion`/`ProductVersion`/`CompanyName="OGrammar"` so Programs-and-Features and file Properties show brand + version, not blank. Bundle it with the icon embed.
8. **No `SECURITY.md` / vuln-disclosure path** - a privacy-first product shipping `<all_urls>` + WASM should have a disclosure contact before public launch. Add to R15 scope (P2, but a credibility item for a privacy brand).
9. **`auto-review.yml` posts PR comments** - beyond the Swadhin persona (R11), confirm it isn't enabled on `og-rewrite` in a way that spams the rebrand PRs while the migration is in flight.

## Definition of "live"

OGrammar v1.0.0 is shipped when **all** of the following are true:

- [ ] **One repo tree** (R1 done); root + nested duplicates resolved; CI runs green on `og-rewrite` with npm (R6/R7) and the brand-residue grep-gate passes clean (R8/Q1).
- [ ] **Brand fully propagated** - the R8 grep finds zero `4F46E5`/`7C3AED`/`2563eb`/`Inter`/`quill`/`Swadhin Biswas` (outside required `NOTICE`/`LICENSE`/fork-notice) / upstream og:image across `manifest.json`, `icon.svg`, popup, options, `highlighter.ts`, root `index.html`+`logo.svg`, `docs/`. Geist self-hosted with license bundled.
- [ ] **`/privacy` URL resolves live** on GitHub Pages (D1/E1), and its text matches the CWS Data-Use form word-for-fact (D2/Q2).
- [ ] **CWS listing public** at 100% rollout with no open policy flags: developer account live (S1), all four permission justifications accepted (S3), single-purpose statement accepted (S2), 5 real screenshots from the migrated build (S7), data-use form certified (S5), zero-network-when-unconfigured proven on the exact submitted zip (S10).
- [ ] **Version 1.0.0 aligned** across `manifest.json`, extension `package.json`, and the Inno `.iss`; tagged `v1.0.0`; stray `opengrammar` tag deleted (R9/Q5).
- [ ] **Windows installer published**: `OGrammar-1.0.0-setup.exe` attached to the GitHub Release, exe carries the embedded green "O" icon + version resource (W1/W2/W12), SmartScreen decision recorded (W11), and the desktop UI is on the new green/off-black palette (W4-W8).
- [ ] **Mac Goal-2 floor met**: ad-hoc-signed `OGrammar.app` runs from `~/Applications` with the P0 hotkey/paste-in floor working (M3/M6), `MACOS-INSTALL.md` documents the Gatekeeper bypass (M1 answered).
- [ ] **Legal clean** (Q3): Apache-2.0 `LICENSE`+`NOTICE` retained, Harper + Norvig credited, Geist license shipped, no LLM weights bundled.
- [ ] **CEO sign-off** (Q6): Goal 1 and Goal 2 both formally accepted.

Source of truth for plan detail: `\\wsl.localhost\ubuntu\home\zazzn\opengrammar\obsidian\OGrammar-Phase2\`. Key repo evidence verified this session: branch `og-rewrite` is `origin/HEAD` but `ci.yml` triggers on `main` only and runs on Bun; nested `opengrammar/` tree + duplicate `ci.yml` confirmed present; versions are `0.9.0` across manifest/`package.json`/`.iss`; tags are `v0.9.0` + a stray lightweight `opengrammar`; no privacy markdown exists in `docs/`.

---

## Appendix - full go-to-market checklist
I have all the grounding I need. The `og-rewrite` IS already the remote default branch (origin/HEAD points to it), but CI still triggers only on `main`, and there's a duplicate `.github/workflows/ci.yml` inside the nested `opengrammar/` dir. I have every load-bearing fact. Now I'll synthesize the complete go-to-market / go-live checklist.

# OGrammar Go-To-Market / Go-Live Checklist

Exhaustive and categorized. Every item: **task · owner · priority**. Grounded in the actual repo state (residue confirmed in `index.html`, `docs/index.html`, the nested `opengrammar/` dir, CI, the manifest, and the Inno installer) and the in-repo plan vault at `obsidian/OGrammar-Phase2/`. P0 = blocks launch, P1 = needed for a credible launch, P2 = post-launch / polish. No em-dashes used.

---

## A. Repo hygiene and structure

| # | Task | Owner | Pri |
|---|---|---|---|
| A1 | Resolve the **dual nested `opengrammar/opengrammar/`** layout. Root has its own `README.md`/`NOTICE`/`LICENSE`/`deploy.sh` AND a nested `opengrammar/` containing `extension/`, a second `README.md`, `NOTICE`, `LICENSE`, `biome.json`, `deploy.sh`, and a duplicate `.github/workflows/ci.yml`. Decide one canonical layout (flatten `extension/` up, or commit to the nested path) and delete the duplicates so docs, CI paths, and `deploy.sh` all point at one tree. | [[Release Engineering]] | P0 |
| A2 | **Rewrite the root `README.md`**: it still leads as "OpenGrammar," links upstream `swadhinbiswas/opengrammar`, and uses the quill emoji + `logo.svg`. Make it the canonical OGrammar README under the new brand, fixing every install path to the resolved A1 layout. | [[Frontend]] | P0 |
| A3 | **Reconcile the nested `opengrammar/README.md`** which still says "Google Docs is intentionally out of scope" while the manifest ships `google-docs.ts` (see F1). Delete or merge it into the single canonical README. | [[Frontend]] | P0 |
| A4 | **Keep upstream attribution correct, not removed.** This is an Apache-2.0 derivative: the fork-notice + `NOTICE` + retained upstream `LICENSE` are legally required (Section 4). Do NOT strip the "Swadhin Biswas" attribution from `NOTICE`/`LICENSE`/the README fork-notice. DO strip the upstream identity from *marketing/branding* surfaces only: the `author` meta, the upstream `og:image`, the title, and the "Built with love by Swadhin Biswas" footer line in `docs/index.html`. Distinguish the two clearly so the rebrand does not break license compliance. | [[Project Management]] | P0 |
| A5 | **Audit/refresh the two `NOTICE` files** so they agree. Root `NOTICE` lists the modification summary; nested `NOTICE` (Copyright 2026 zazzn) is the fork-owner notice. After A1 there must be exactly one authoritative `NOTICE` per shipped artifact (extension zip and repo), each retaining Harper (Apache-2.0) and the Norvig n-gram derivation credit. | [[Release Engineering]] | P0 |
| A6 | **Fix CI triggers.** `.github/workflows/ci.yml`, `deploy-pages.yml` trigger only on `main`; `auto-review.yml` runs on PRs. `origin/HEAD` already points at `og-rewrite`, but the workflows do not. Add `og-rewrite` (then make it the sole branch once it is promoted) to push/PR triggers so CI actually runs on the active branch. | [[Frontend]] | P0 |
| A7 | **De-Bun the CI.** `ci.yml` and `auto-review.yml` use `oven-sh/setup-bun` + `bun install`/`bun x tsc`/`bun run build`, but the project standardized on npm (per the WSL-build memory: no bun). Switch to `actions/setup-node` + `npm ci` + `npm run build` to match the real toolchain and avoid a two-toolchain footgun. | [[Frontend]] | P0 |
| A8 | **Replace `deploy.sh`** (root and nested both still print "OpenGrammar," hard-require Bun, and exit if bun is missing) with an npm-based `release.sh`. | [[Release Engineering]] | P1 |
| A9 | **Remove the "Swadhin Biswas" literal from `auto-review.yml`** ("Process Review as Swadhin Biswas" step posts PR comments under that name). Rename to the OGrammar bot identity or remove the persona. | [[Release Engineering]] | P1 |
| A10 | **Promote `og-rewrite` to GitHub default branch** at the `v1.0.0` tag (per CEO decision #5), then point all CI/Pages triggers at it and retire `main`. Update branch-protection. | [[Release Engineering]] | P1 |
| A11 | **Version-bump strategy + tags.** Bump `manifest.json` + extension `package.json` (both `0.9.0`) and the Inno `.iss` (`AppVersion 0.9.0`) atomically to `1.0.0` at launch; tag `v1.0.0`. There is already an odd lightweight tag literally named `opengrammar` to clean up. Document the semver + tag-per-release rule in the runbook. | [[Release Engineering]] | P0 |
| A12 | **`.gitignore` review.** It already ignores `dist`, `desktop/target`, key files, `.claude/`, the WASM copy, and ngram cache. Add the new build outputs from A8 (`ogrammar-<ver>.zip`, `*.maps.zip`, Inno `Output/`) and confirm `obsidian/` vault inclusion is intentional (it is currently committed). | [[Frontend]] | P2 |
| A13 | **Strip dev artifacts from shipped surfaces.** The deleted `extension/public/create_icons.py` is gone; ensure the new `extension/scripts/create-icons.mjs` and any `playground/`, source maps, and `.fp-corpora/` are excluded from the packaged zip (allowlist-diff the zip). | [[Release Engineering]] | P1 |
| A14 | **CI grep-gate for brand residue** (the cheap catch-all). Fail the build on any of `4F46E5`, `7C3AED`, `2563eb`, `Inter`, `quill`, `Swadhin Biswas`, `swadhinbiswas/opengrammar`, the upstream `og:image` URL across `index.html`, `docs/`, `popup.css`, `options.css`, `icon.svg`, `manifest.json`. This is the brand-DoD gate named by four departments. | [[Frontend]] | P0 |
| A15 | **Refresh `ROADMAP.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `GRAMMAR_RULES.md`, issue/discussion templates** for the OGrammar identity and repo URL; remove stale "OpenGrammar" naming. | [[Project Management]] | P2 |

---

## B. Brand propagation beyond the icon (the residue still shipping)

| # | Task | Owner | Pri |
|---|---|---|---|
| B1 | **Author the locked `tokens.css`** (6-value contract is the single critical-path gate): accent `#1FA463` (dark sibling `#34C77F`), off-black `#16191D`/off-white `#FBFCFB` neutral ramp, 3 issue colors (grammar rose `#D1495B`, style steel `#3D7DCA`, clarity ochre `#C7821A`), Geist. One source consumed by popup, options, landing, docs, and the desktop apps. | [[Brand & Design]] | P0 |
| B2 | **Migrate `popup.css` + `options.css` onto tokens**, deleting `--og-primary #4F46E5` (popup) and the stray `#2563eb` (options) drift, and removing the Inter `<link>` in favor of self-hosted Geist `@font-face`. | [[Frontend]] | P0 |
| B3 | **Rebrand root `index.html`**: it still ships `<title>OpenGrammar...`, `author = Swadhin Biswas`, the upstream `og:image`, `--primary:#4f46e5`/`--accent:#7c3aed`/`--blue:#2563eb`, and the Inter+JetBrains Google Fonts link. Rebuild on tokens + Geist with the new mark and the "instrument" hero. | [[Frontend]] | P0 |
| B4 | **Align `docs/index.html`**: still Inter, still the upstream GitHub links and the "Swadhin Biswas" footer credit; retire the old checkmark logo for the spellcheck-O mark. | [[Frontend]] | P1 |
| B5 | **Replace `logo.svg`** (root) and any remaining quill/indigo lockups with the new "O + green spellcheck wave" mark and a horizontal "OGrammar" Geist lockup + favicon. The extension `icon.svg`/16/48/128 are already swapped; verify they match the final master. | [[Brand & Design]] | P1 |
| B6 | **Desktop app brand pass.** Confirm `tray.rs`, `settings.rs`, `overlay.rs`, `pill.rs`, `suggestion.rs` use the new accent (the `settings.rs` privacy text was flagged); ship the new `.ico`/tray template image into the Inno build so the Windows app matches. | [[Brand & Design]] | P1 |
| B7 | **Replace the stale repo screenshot** `screenshot-2026-04-22_13.14.06.png` (old indigo UI) used in README/landing with a real capture of the migrated build. | [[Brand & Design]] | P2 |
| B8 | **Verify Geist license ships** (the unowned legal line-item from the critique). Geist is OFL/MIT; self-host, include the license file in the repo and the extension package, and have Release Engineering sign off. | [[Release Engineering]] | P1 |

---

## C. Chrome Web Store launch

| # | Task | Owner | Pri |
|---|---|---|---|
| C1 | **Developer account + $5 fee** (CEO decision #2, RESOLVED: user owns the Google account and pays). Register the CWS developer account; publish under a dedicated "OGrammar" developer name (not the personal identity) to honor the no-upstream-author mandate. | [[Project Management]] | P0 |
| C2 | **Single-purpose statement.** One sentence: "detect and correct writing issues in editable text fields on the web," and confirm content scripts, popup, and options all map to it. Resolve the breadth concern (grammar + rewrite + autocomplete + analytics framed as one purpose). | [[Release Engineering]] | P0 |
| C3 | **Permission justifications (exact Dashboard strings).** Four of them: (a) `<all_urls>` host access (why `activeTab`-only is not viable: passive inline checking must run in editable fields on arbitrary sites, not on toolbar click); (b) `storage`/`activeTab`/`scripting`; (c) `wasm-unsafe-eval` CSP (Harper WASM is locally compiled, all bytes packaged, zero runtime fetch); (d) the **`web_accessible_resources` justification** the critique flagged as unowned: why every site can fetch `harper_wasm_bg.wasm` (18 MB), `ngram/model.bin`, and the dictionary. Archive the accepted strings in-repo. | [[Release Engineering]] | P0 |
| C4 | **Code the `<all_urls>` fallback as real code, not a story** (the #1 launch-blocker risk): a runtime per-site `optional_host_permissions` opt-in path, ready to ship if the reviewer pushes back, so a rejection costs days not a redesign. | [[Release Engineering]] | P1 |
| C5 | **Data-use disclosure form.** Declare the only egress (BYO-key LLM text + opt-in autocomplete page-context, only to the user-chosen provider); certify no selling, no unrelated use, no creditworthiness use. Disclose that analytics live in `chrome.storage.sync` (the user's own Google account, no developer server). Must match the hosted privacy policy word-for-fact. | [[Release Engineering]] | P0 |
| C6 | **Listing copy.** Title, 132-char summary, long description leading with "private, local-first writing help everywhere on the web"; provider grid (OpenAI/OpenRouter/Groq/Together/Abacus/Ollama); Gmail/Docs integrations; zero-default-egress. Pick **primary category = Productivity**; locale = en first (flag i18n debt). | [[UX]] | P0 |
| C7 | **5 screenshots at 1280x800**, captured from the REAL migrated `dist/` via the Playwright harness (never mockups): popup score state, inline correction on a real site, tone rewrite preview, provider/Ollama settings, Gmail/Docs integration. With Geist captions on off-black chrome. | [[Frontend]] (capture) / [[Brand & Design]] (art direction) | P0 |
| C8 | **Promo tile 440x280** and **marquee 1400x560** (the correct CWS marquee size; the vault had conflicting 1280x800/1440x560 numbers, Release Engineering's 1400x560 is authoritative). Plus the 128 store icon. Templated SVG-to-PNG so they re-render on token change. | [[Brand & Design]] | P1 |
| C9 | **Package the `dist/` zip**, versioned, under the size budget, with source maps stripped (`vite sourcemap:true` today) and archived separately, and a CI guard that fails if any API key / `.env` value is bundled. | [[Release Engineering]] | P0 |
| C10 | **Pre-submit smoke test** on the exact zip (unpacked + via the unlisted Dashboard build): popup, options, inline highlight, autocorrect, one BYO-key path on a real site + Gmail + Docs; confirm **zero network calls when no provider is configured** (proves the local-first claim). | [[Release Engineering]] | P0 |
| C11 | **Submit Unlisted, then promote to public** with percentage rollout; buffer one resubmission cycle; write the submit + staged-% + rollback runbook (`RELEASE-RUNBOOK.md`). | [[Release Engineering]] | P0 |

---

## D. Privacy policy

| # | Task | Owner | Pri |
|---|---|---|---|
| D1 | **Live hosted `/privacy` URL** (mandatory; no submission exists until it resolves; doc-only = "not done"). Host via GitHub Pages from `docs/` on `og-rewrite` (CEO decision #3). | [[Frontend]] | P0 |
| D2 | **Canonical privacy text** (single source of truth, must match the Data-Use form word-for-fact): local tier never leaves the device; BYO-key LLM is the only egress and only to the user-chosen provider; API keys AES-GCM encrypted at rest, never synced; analytics live in the user's own Google account; opt-in autocomplete sends page context only when enabled. | [[Release Engineering]] | P0 |
| D3 | **In-product privacy panel** (one screen, plain language, mirrors the policy) reachable from popup + onboarding: "what stays local / what leaves only if you opt in," with a persistent "Local-only / AI: <provider>" status chip. | [[UX]] | P1 |
| D4 | **Share the privacy boilerplate with the Mac client** so the extension and desktop tell one consistent local-first story. | [[Release Engineering]] | P2 |

---

## E. Marketing site and hosting

| # | Task | Owner | Pri |
|---|---|---|---|
| E1 | **Stand up GitHub Pages** from `docs/` on `og-rewrite`; fix `deploy-pages.yml` (currently `main`-only and copies root `index.html` + `logo.svg` + `docs/`) to the resolved branch/layout. This is what makes the `/privacy` URL stable. | [[Frontend]] | P0 |
| E2 | **New landing IA + copy**: single primary CTA ("Add to Chrome") above the fold, secondary "See how it works," a "what stays local" proof module, the provider logo strip, honest feature copy (Harper + SymSpell + n-gram local tier, BYO-key providers, tone rewrite, ghost-text autocomplete, score ring). No invented claims. | [[UX]] | P1 |
| E3 | **New `og:image`/`og:title`/`og:url` + favicon** on the new brand, replacing the upstream raw.githubusercontent og:image. | [[Frontend]] | P1 |
| E4 | **Lighthouse >= 95** (perf/a11y/SEO), total transfer < 300 KB excluding fonts; ensure the 18 MB WASM/model/dict are NOT bundled into the marketing site. | [[Frontend]] | P2 |
| E5 | **Custom-domain decision** (CEO input, optional). If a custom domain is chosen it changes the `/privacy` URL and the `og:` meta, so it must be decided before C5/D1 freeze. Default: GitHub Pages subdomain. | [[Project Management]] | P2 |
| E6 | **"Get the desktop app" download path** on the site covering both Windows (installer/exe) and the future Mac `.app` zip. | [[Frontend]] | P2 |

---

## F. Product correctness pre-launch (the scope contradiction)

| # | Task | Owner | Pri |
|---|---|---|---|
| F1 | **Resolve the Google Docs contradiction** (CEO decision #4: KEEP it). README/nested-README say "Google Docs intentionally out of scope (canvas-rendered)" but the manifest ships `content/google-docs.ts` matched on `docs.google.com`. As a CODE + DOCS change (flagging is not fixing): keep the script, update both READMEs and the listing copy, and tell one single-purpose story so a reviewer finds no contradiction. | [[Frontend]] | P0 |
| F2 | **Confirm no remote code** (already scanned clean): no `eval(`/`new Function`/CDN import in `extension/src`, `wasm-unsafe-eval` is the only eval-class CSP token, all JS/WASM/model/dict bytes ship in-package. Document this in the C3 justification. | [[Release Engineering]] | P0 |
| F3 | **First-run onboarding** that reaches "first issue underlined in a real field" in under 60s with no account and no forced key (local engine works on step one); permission rationale shown inline before first activation, not as a scary wall; "Replay setup" re-entry from options. | [[UX]] | P1 |

---

## G. Windows desktop release

| # | Task | Owner | Pri |
|---|---|---|---|
| G1 | **Unsigned-installer / SmartScreen decision.** The Inno `OGrammar.iss` is per-user (`PrivilegesRequired=lowest`, no UAC) but **unsigned**, so SmartScreen will warn on first run. Decide: (a) ship unsigned + document the "More info -> Run anyway" bypass in the README/release notes (cheapest, fits personal/early scope), or (b) buy an OV/EV code-signing certificate (EV clears SmartScreen reputation instantly; OV builds reputation over downloads). Record the decision in the release runbook. | [[Release Engineering]] | P0 |
| G2 | **Build + publish release assets.** Run `build-installer.ps1`/`ISCC.exe` with `/DAppVersion=1.0.0`, produce `OGrammar-1.0.0-setup.exe`, attach to a tagged GitHub Release with notes; ensure `AppVersion` in the `.iss` matches the manifest version (A11). | [[Release Engineering]] | P1 |
| G3 | **Auto-update story.** The installer has a stable `AppId` so version upgrades replace in place, but there is **no update channel** (no in-app check, no feed). Decide: in-app "check for updates" pinging the GitHub Releases API, or "manual re-download" documented in the README. At minimum document how a user gets v2. | [[Release Engineering]] | P2 |
| G4 | **Desktop QA pass** on the packaged installer: clean install, autostart-at-logon toggle, tray/settings, per-app exclusion (browsers excluded by default so it de-conflicts with the extension), DPAPI key store in `%APPDATA%\OGrammar`. | [[Release Engineering]] | P1 |

---

## H. Mac client

| # | Task | Owner | Pri |
|---|---|---|---|
| H1 | **Confirm the target Mac's MDM status** (CEO decision #1, the defining question). If Accessibility is MDM-blocked, P0-only (hotkey + paste-in, no underlines) is the accepted "done" floor; AX underlines (P1) are best-effort upside. Answer this before any P1 effort. | [[Project Management]] | P0 |
| H2 | **Build the `ograms-ffi` staticlib + offset-parity harness** vs Windows (the release gate, built in Phase A before any UI depends on it): macOS FFI `Issue` output byte-identical (char + utf16 offsets) to the Windows client. | [[Mac Client]] | P0 |
| H3 | **P0: menu-bar app + global hotkey + Cmd-C selection check/rewrite + paste-in panel** (`NSStatusItem`, nonactivating `NSPanel`, Keychain key entry, provider parity). Usable on the most locked-down Mac with zero or only Input-Monitoring permission. | [[Mac Client]] | P1 |
| H4 | **P1: AX focused-field read + `AXObserver` tracking + transparent `NSWindow` overlay underlines + AX/clipboard apply** at Windows reading parity. Conditional on H1. | [[Mac Client]] | P2 |
| H5 | **P2: rewrite pill + suggestion card + idle-gated autocorrect + learned-store + LaunchAgent autostart** (`~/Library/LaunchAgents`, no admin). | [[Mac Client]] | P2 |
| H6 | **Distribution (no admin, no DMG):** ad-hoc-signed `OGrammar.app` (`codesign -s - --deep`), delivered as a `.zip`, run from `~/Applications`, `LSUIElement=true`, config in `~/Library/Application Support/OGrammar`. Write `MACOS-INSTALL.md` documenting the Gatekeeper first-run bypass (right-click -> Open, or `xattr -dr com.apple.quarantine`) and the grant flow. | [[Release Engineering]] | P1 |
| H7 | **Mac update path** (the minor unowned gap): document re-zip + re-`xattr` in `MACOS-INSTALL.md`; no crash telemetry by design (personal scope). | [[Mac Client]] | P2 |

---

## I. Final pre-launch QA and sign-off

| # | Task | Owner | Pri |
|---|---|---|---|
| I1 | **Brand-residue grep sweep passes clean** (CI gate A14 green) across all shipped surfaces: no `#4F46E5`/`#7C3AED`/`#2563eb`, no Inter, no quill, no "Swadhin Biswas" or upstream `og:image` in `manifest.json`, `icon.svg`, popup, options, `index.html`, `docs/index.html`. | [[Project Management]] | P0 |
| I2 | **Privacy claim audit:** every "stays local" statement matches the actual data flow (local engine = no network; BYO-key = text to the chosen provider only; opt-in autocomplete = page context only when enabled). No overclaiming, across policy + in-product panel + listing + Data-Use form. | [[Release Engineering]] | P0 |
| I3 | **License/legal QA:** Apache-2.0 `LICENSE` + `NOTICE` retained and correct (A4/A5); Harper attribution intact; Norvig n-gram derivation credited; Geist font license bundled (B8); confirm no bundled LLM model weights need their own license (none ship; BYO-key only). | [[Release Engineering]] | P0 |
| I4 | **WCAG 2.1 AA pass** on popup, options, and overlay interactions (contrast on both light/dark token pairs, focus order, keyboard operability of the suggestion card and rewrite pill). | [[UX]] | P1 |
| I5 | **Cross-surface consistency check:** extension, Windows app, Mac app, landing, docs all speak one brand and one local-first story; version numbers aligned across `manifest.json`, `package.json`, and the `.iss`. | [[Project Management]] | P1 |
| I6 | **CEO sign-off gate:** Goal 1 (CWS public, privacy URL live, all justifications accepted, rollout at 100% with no policy flags) and Goal 2 (Mac `.app` runs from `~/Applications`, P0 floor working) both accepted. | [[Project Management]] | P0 |

---

### Critical path (serial; everything else parallelizes)
`tokens.css` (B1) -> migrate popup/options off indigo+Inter (B2) -> screenshot the real migrated UI (C7) -> host the live `/privacy` URL (D1/E1) -> package `dist/` zip (C9) -> submit Unlisted -> promote public (C11). The Mac track (H) is coupled to Goal 1 by only the token file and runs alongside from day one.

### Highest-probability launch blockers (watch list)
1. `<all_urls>` + 3 all-frames content scripts + `wasm-unsafe-eval` triggers manual review/rejection (C3/C4). 2. No live privacy URL = automatic rejection (D1). 3. Brand residue ships (A14/B-series). 4. The token-lock gate (B1) idling four teams if it slips. 5. The unsigned Windows installer SmartScreen decision (G1) and the unsigned Mac Gatekeeper flow (H6).

Source of truth for the plan detail: `\\wsl.localhost\ubuntu\home\zazzn\opengrammar\obsidian\OGrammar-Phase2\` (CEO brief, the six department notes, Goal 1/Goal 2, and the Chief of Staff critique). Key repo evidence: `index.html` (lines 6-32 hold the residue), `docs/index.html` (line 1262 footer credit), the nested `opengrammar/` dir + its duplicate `.github/workflows/ci.yml`, `.github/workflows/{ci,deploy-pages,auto-review}.yml` (main-only + Bun + the "Swadhin Biswas" persona step), `opengrammar/extension/manifest.json` (`<all_urls>`, `wasm-unsafe-eval`, the `web_accessible_resources` surface, `google-docs.ts`), and `desktop/installer/OGrammar.iss` (unsigned, per-user, `AppVersion 0.9.0`).
