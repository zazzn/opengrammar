---
tags: [ogrammar, phase-2, frontend]
owner: Frontend Lead
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

I now have the full factual picture. Key findings confirmed: the landing/docs sites live one level up at `/home/zazzn/opengrammar/` (not in the extension repo); CI uses Bun + targets `main` while the active branch is `og-rewrite`; `deploy.sh` still references "OpenGrammar" and hard-requires Bun; vite ships `sourcemap: true`; no zip/release/version pipeline exists; no privacy policy or store assets. I have everything I need to write the department note.

## Frontend / Web Engineering - Department Note

> Owner: Frontend / Web Engineering Lead - Reports to: CEO (second brain)

## Charter
Own every pixel a non-installing user sees before they trust OGrammar: the new marketing/landing site, the Chrome Web Store listing visuals, and the productionized extension build that gets uploaded. I translate [[Brand & Design]]'s new identity and [[UX]]'s information architecture into shipped web surfaces, and I turn the current hand-rolled `index.html` + `docs/` static pair into a single coherent site plus a reproducible, secrets-clean release artifact. I am the last gate between "it builds locally" and "a stranger installs it from the store."

## Objectives (Phase 2)
- Replace the two legacy pages (`/home/zazzn/opengrammar/index.html`, `/home/zazzn/opengrammar/docs/index.html`) with one new-brand site: landing + docs + a `/privacy` page, zero "OpenGrammar"/"Swadhin Biswas"/upstream-`og:image` references remaining (verified by grep).
- Ship a CWS-ready asset set: icons 16/48/128, store icon 128, small promo tile 440x280, marquee 1440x560, and 3-5 screenshots at 1280x800 (or 640x400) - all generated reproducibly from source, not hand-cropped.
- Productionize the extension release: a one-command `release.sh` that builds, strips source maps from the shipped zip, version-bumps in lockstep across `manifest.json` + `package.json`, and emits `ogrammar-<version>.zip` plus a separate source-maps artifact. Target: green run, byte-reproducible zip.
- Lighthouse >= 95 on the landing page (perf/a11y/SEO), site total transfer < 300 KB excluding fonts, first contentful paint < 1.2s on mid-tier mobile.
- A drafted, hosted privacy policy + permission-justification copy block ready for the [[Project Management]] submission package.

## Delegated roles & tasks
- **Site Engineer (landing + docs build)**
  - Stand up the new site replacing root `index.html` and `docs/index.html`; implement [[Brand & Design]] tokens as CSS variables and [[UX]]'s IA (hero, "local-first" proof section, provider grid, Docs/Gmail integrations, privacy, download/CTA).
  - Port the real feature list from the briefing (Harper+SymSpell+n-gram local tier, BYO-key providers: OpenAI/OpenRouter/Groq/Together/Ollama, tone rewrite/rephrase, ghost-text autocomplete, score ring) into honest marketing copy - no invented claims.
  - Wire deploy to GitHub Pages from `/docs` on the `og-rewrite` branch (later default), keep it dependency-light so an open-source contributor can `npm run build` with no private tokens.
- **Brand Asset Producer (store + icon pipeline)**
  - Build a single `assets/brand/logo.svg` source under the new identity and a script that rasterizes it to icon-16/48/128 PNGs, replacing the current quill+indigo `extension/public/icon.svg` and the three PNGs.
  - Author an automated screenshot harness (Playwright loading the unpacked `dist/` + a scripted demo page) that captures the popup, inline highlight, and tone-rewrite at exact 1280x800; output deterministic, re-runnable PNGs.
  - Produce the 440x280 and 1440x560 promo tiles as templated SVG-to-PNG so they re-render when brand tokens change.
- **Release Engineer (build/zip/version hygiene)**
  - Replace `deploy.sh` (still says "OpenGrammar", hard-requires Bun) with `release.sh` using npm (matches CI's `npm install`), bumping `manifest.json` + `package.json` versions atomically.
  - Strip the `dist/**/*.map` files from the uploaded zip (vite currently has `sourcemap: true`) and archive maps separately; add a guard that fails the build if any provider API key or `.env` value is bundled.
  - Update `.github/workflows/ci.yml`: add the `og-rewrite` branch to triggers, add a `build` + zip-artifact step, drop or pin the redundant Bun setup.
- **Privacy/Listing Copywriter (review-surface docs)**
  - Draft `PRIVACY.md` + hosted `/privacy` page: state no data leaves the device for the local tier, and for BYO-key the request goes directly to the user's chosen provider (no OGrammar server).
  - Write the per-permission justifications for CWS: `<all_urls>` + 3 content scripts (checks editable fields on any site), `storage` (settings/learned corrections), `activeTab`+`scripting`, and the `wasm-unsafe-eval` CSP rationale (Harper WASM).

## Deliverables
- New-brand site under `/home/zazzn/opengrammar/docs/` (landing + docs + privacy), GitHub Pages-deployed; old root `index.html` removed or redirected.
- `assets/brand/logo.svg` + regenerated `extension/public/{icon.svg,icon-16,icon-48,icon-128}.png`.
- CWS asset bundle: store icon 128, promo 440x280, marquee 1440x560, 3-5 screenshots @1280x800, all script-generated.
- `extension/scripts/release.sh` + version-bump helper; `ogrammar-<version>.zip` (no maps) and `ogrammar-<version>.maps.zip`.
- `PRIVACY.md` + permission-justification markdown for the submission package.
- Updated `.github/workflows/ci.yml` with build + artifact upload.

## Milestones & sequence
1. Receive tokens from [[Brand & Design]] and IA/wireframes from [[UX]] (blocking input).
2. Logo source + icon pipeline -> regenerate all extension icons (unblocks both site and store assets).
3. Build new landing + docs + privacy site; pass Lighthouse gate.
4. Stand up screenshot/promo harness; capture store assets against the rebuilt `dist/`.
5. Ship `release.sh` + CI build step; produce a clean, reproducible zip.
6. Hand the zip + assets + privacy/justification copy to [[Project Management]] for the [[Release Engineering]] submission run.

## Dependencies
- [[Brand & Design]] - the new color/type/logo system; I cannot finalize any visual surface until tokens and the logo metaphor land. Hard blocker on milestones 2-4.
- [[UX]] - landing-page IA, popup/options screenshot states worth featuring, and copy hierarchy.
- [[Release Engineering]] - owns the actual CWS upload, developer-account, and the signed/published step; I hand them the zip and asset bundle. We co-own `release.sh`.
- [[Project Management]] - sequences the submission package (assets + privacy + justifications) and owns the review-response loop.
- [[Mac Client]] - I supply the same new-brand logo/icon source and the download CTA target for the macOS build (no `.dmg`; a plain `.app`/binary link), so the site's "Get the desktop app" path covers both OSes.

## Risks & mitigations
- **`<all_urls>` triggers manual review and possible rejection.** Mitigation: privacy page + crisp per-permission justification drafted before submission; lead with the local-first, no-server framing reviewers respond to.
- **Source maps leak internals into the shipped zip** (`sourcemap: true` today). Mitigation: `release.sh` strips `*.map` from the upload and a CI guard greps the bundle for key-shaped strings/`.env` values.
- **CI is Bun-on-`main`; active work is npm-on-`og-rewrite`.** Mitigation: align triggers to `og-rewrite`, standardize on npm to match the existing `npm install` step, avoid a two-toolchain footgun.
- **18 MB `harper_wasm_bg.wasm` + 3.5 MB n-gram + 1.3 MB dict inflate the package.** Mitigation: keep them in the extension zip (required at runtime) but exclude from the marketing site bundle; confirm they sit in `web_accessible_resources` and are not double-shipped.
- **Brand slip - stale "OpenGrammar"/upstream author/`og:image` survives the rebrand.** Mitigation: a grep-based "no legacy strings" check in CI across `index.html`, `docs/`, `popup.css`, `options.css`, `icon.svg`.
- **Screenshots drift from the real UI after a brand change.** Mitigation: generate them from the live `dist/` via the Playwright harness, never hand-mock.

## Definition of done
- New-brand site live on GitHub Pages; grep finds zero "OpenGrammar"/"Swadhin Biswas"/upstream-`og:image` strings; Lighthouse >= 95.
- All extension icons and the CWS asset bundle regenerate from one logo source via a documented script.
- `release.sh` produces a reproducible `ogrammar-<version>.zip` with no source maps and no bundled secrets; version is identical across `manifest.json` and `package.json`; CI is green on `og-rewrite` and uploads the zip artifact.
- `PRIVACY.md` + `/privacy` page hosted, and the permission-justification copy is delivered to [[Project Management]] - submission package is complete from the web side.
