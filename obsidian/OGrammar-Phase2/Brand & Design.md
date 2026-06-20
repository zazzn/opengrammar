---
tags: [ogrammar, phase-2, brand]
owner: Brand & Design Lead
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

The discovery briefing is confirmed: indigo→violet gradient, quill+checkmark mark, Inter, AI-purple everywhere. That is exactly the identity I must diverge from on all three axes. I have everything I need to write the department note.

---

> Owner: Brand & Design Lead - Reports to: CEO (second brain)

**Design Read:** Reading this as a privacy-first consumer-dev landing + Chrome Web Store listing for design-conscious individual writers and engineers, with a confident off-black + signal-green technical-editorial language, leaning toward native CSS / Tailwind v4 + Geist + restrained scroll motion (VARIANCE 7 / MOTION 5 / DENSITY 4).

## Charter
Build a new visual identity for OGrammar that is unmistakably NOT OpenGrammar: different hue family, different logo metaphor, different typeface. The brand must read as premium, calm, and trustworthy, because we are asking users to grant `<all_urls>` and run an engine on every editable field they touch. I own the logo, icon set, color and type systems, store-listing art direction, and the visual refresh of the popup, options, landing page, and doc-site so they all speak one language.

## Objectives (Phase 2)
- Ship ONE locked accent (signal green `#1FA463`), zero AI-purple, applied identically across extension UI, store assets, landing, and docs. Verifiable: grep finds no `#4F46E5`/`#7C3AED` in shipped surfaces.
- Deliver a full icon set: `icon.svg` master plus rasterized 16/48/128, each legible at its size (16px is the brand glyph alone, no badge).
- Deliver all CWS store assets at exact required dimensions: 128 store icon, 440x280 small promo tile, 1280x800 marquee, and 5 screenshots at 1280x800.
- Reconcile the popup (`#4F46E5`) and options (`#2563eb`) color split into one token file consumed by both.
- WCAG AA on every text/background pair in both light and dark, validated before handoff.

## Brand strategy
- **Positioning vs the original:** OpenGrammar looked like a generic indigo AI tool (quill, violet gradient, Inter). OGrammar is the opposite: an instrument, not an assistant. The pitch is local-first privacy and correctness you can trust, so the brand reads engineered and quiet, not magical and glowing.
- **Personality:** precise, calm, self-hosted-friendly, a little technical. Closer to a good code editor or a hardware tool than to a chatbot.
- **One-sentence promise:** "Writing help that never leaves your machine."

## Logo & app-icon concept (CHOSEN: "spellcheck-O", concept A)
> CEO update: the original proof-caret proposal was rejected as too abstract. The shipped mark is concept A: an **O** (for OGrammar) above a **green spellcheck wave** - the universal "this checks your writing" squiggle. Master at `assets/ogrammar-mark.svg`, installed at `extension/public/icon.svg`; 16px uses a bolder 2-hump variant; PNGs via `scripts/create-icons.mjs` (`npm run icons`). Tile green is `#34C77F` (the dark-surface sibling of the locked accent `#1FA463`, 7.2:1 on the tile). Original concept retained below for the record.

- **Metaphor:** privacy + proofreading fused into one mark. The mark is a **proof-caret**: the editor's text-insertion caret (the writer's position) wrapped by a **bracket/shield notch** (the local boundary that keeps text on-device). It says "this is where you write, and it stays here."
- **Geometry / construction:** on a 128 grid, a squircle tile (superellipse, corner radius ~28) filled off-black `#16191D`. Centered, a vertical caret bar: rounded rectangle 12 wide x 56 tall in signal green `#1FA463`. Flanking it, two short bracket arms (top-left and bottom-right, rotationally symmetric, NOT a full box) drawn as 10px-thick strokes with rounded caps in off-white `#F4F6F4` at ~70% opacity, each arm 26 long on each leg, offset 20 from the caret. The asymmetric brackets read as a checkmark's rhythm without literally being a checkmark, and as a privacy enclosure without being a padlock cliche. No gradient. One flat green, one off-white, one off-black. The flatness is the differentiation from the old glossy gradient circle.
- **16/48/128 simplification:**
  - **128:** full mark, caret + both bracket arms + squircle tile.
  - **48:** drop tile-corner subtlety to a simple rounded square, keep caret + both arms, thicken arms to 12 for clarity.
  - **16:** the caret bar ALONE in green on the off-black tile, brackets removed (they turn to mud at 16px). The single green vertical caret on dark is the recognizable atom of the brand.

## Color system
One neutral ramp (cool-charcoal, slightly green-shifted so it harmonizes with the accent) plus exactly ONE accent. All pairings below are AA or better.

**Accent (locked, both modes):**
- `--accent` `#1FA463` (signal green) / on light it sits on white at 4.6:1 for large text and UI; for body-size accent text use `--accent-text` `#127A48` (5.9:1 on white).
- `--accent-quiet` `#E7F4EC` (light tint) / `--accent-quiet-dark` `#10271C` (dark tint).

**Light mode:**
- `--bg` `#FBFCFB` (off-white, never pure) , `--surface` `#F2F4F2` , `--border` `#DDE2DD`
- `--text-1` `#16191D` (off-black, 15.8:1 on bg) , `--text-2` `#474D54` (8.1:1) , `--text-3` `#6B7178` (4.8:1, smallest allowed use)

**Dark mode:**
- `--bg` `#0F1215` (off-black) , `--surface` `#171B1F` , `--border` `#2A2F35`
- `--text-1` `#F4F6F4` (15.2:1) , `--text-2` `#B6BDBE` (8.9:1) , `--text-3` `#878E90` (4.9:1)
- accent on dark: `#34C77F` for text/icons (7.2:1 on `--bg`), `#1FA463` reserved for fills with off-white labels.

**Semantic issue colors (replace the old red/blue/amber set, kept distinct from the green accent):**
- grammar `--issue-grammar` `#D1495B` (rose, not the old `#E53935`) , style `--issue-style` `#3D7DCA` (steel blue) , clarity `--issue-clarity` `#C7821A` (ochre). Accent green is NEVER used for an error state, only for brand and "all clear / score good."

## Type system
Deliberately not Inter, not a serif.
- **Display / headlines:** **Geist** (Vercel's grotesk) at tight tracking. Engineered, contemporary, reads "tool" not "blog."
- **Text / body / UI:** **Geist** as well for a single-family system in the cramped popup, OR **Hanken Grotesk** for landing-page body if we want a touch more warmth at long-read sizes. Default to Geist everywhere for consistency; introduce Hanken only on the marketing landing if the long copy needs it.
- **Mono:** **Geist Mono** for the engine/provider/code bits (provider base-URLs, the "runs with no network" technical callouts, doc-site code blocks). Pairs natively with Geist.
- Emphasis within a headline uses Geist's own weight/italic, never a foreign family injection.

## Visual direction
- **Hero idea (landing + 1280x800 marquee):** a single editable text field, off-black surface, with one green proof-caret blinking in real text, and a real inline correction resolving as you watch (the rose grammar underline collapses into clean text). The art direction is "the product doing its one job," shot like a precise instrument: lots of negative space, off-black canvas, one green accent, real screenshots (no div-fakes). No glowing orbs, no mesh gradient, no paper texture. The contrast with the old warm-paper-plus-blur-orbs landing is the whole point.
- **Motion level (5):** caret blink, one scripted correction animation in the hero, scroll-reveal stagger on feature rows. Everything honors `prefers-reduced-motion`. No scroll-hijack, no marquee.
- **What makes it graphically different:** flat off-black + single signal-green vs old white/indigo-gradient; engineered Geist vs Inter; an instrument-caret mark vs a quill; privacy framed as a hard boundary (the bracket enclosure, "never leaves your machine") rather than a soft AI promise. Store screenshots use the same off-black chrome so the listing reads as one cohesive premium product.

## Delegated roles & tasks
**Logo & Icon Designer**
- Build `icon.svg` master from the proof-caret spec above; export 16/48/128 PNGs with the documented per-size simplification (16 = caret only).
- Replace `extension/public/icon.svg` and the three sized icons referenced in `manifest.json`; verify each at actual pixel size on light and dark Chrome toolbars.
- Produce a horizontal lockup (mark + "OGrammar" in Geist) for landing/docs headers and the CWS 128 store icon.

**Color & Type Systems Designer**
- Author one `tokens.css` (CSS custom properties, light + dark) implementing the ramps above; this is the single source consumed by popup, options, landing, docs.
- Migrate `popup.css` and `options.css` onto the shared tokens, deleting `--og-primary #4F46E5` and the stray options `#2563eb`; self-host Geist/Geist Mono via `@font-face`, remove the Inter Google Fonts `<link>`.
- Run a contrast pass on every pair and record the ratio next to each token.

**Store-Asset Designer**
- Produce CWS assets at exact sizes: 128 store icon, 440x280 promo tile, 1280x800 marquee, and 5 screenshots at 1280x800 (popup score state, inline correction on a real site, tone rewrite, Ollama/local-provider settings, Gmail/Docs integration).
- Annotate screenshots with short Geist captions on off-black; keep one green accent only.
- Draft the visual half of the listing (tile copy headline, screenshot order); hand the permission-justification + privacy-policy copy to [[UX]] for wording.

**Motion & Illustration Designer**
- Build the hero "live correction" sequence (caret blink + rose underline resolving to clean text) as a self-contained reduced-motion-safe component for the landing.
- Define scroll-reveal stagger timing for feature rows; no marquee, no scroll-hijack.

**Landing & Doc-Site Refresh Designer**
- Reskin root `index.html`: strip the old warm-paper bg, blur orbs, indigo/violet, the upstream `og:image`, and the "Swadhin Biswas" / "OpenGrammar" author and title; rebuild on tokens + Geist with the instrument hero.
- Align `docs/index.html` to the same tokens (retire the blue→violet rounded-square checkmark logo for the new mark).

## Deliverables
- `extension/public/icon.svg` (new master) + 16/48/128 PNGs wired in `manifest.json`.
- `tokens.css` (light + dark, all values + contrast ratios) consumed by popup, options, landing, docs.
- Migrated `popup.css` and `options.css` (no indigo/violet, no Inter, self-hosted Geist).
- CWS asset pack: 128 icon, 440x280 tile, 1280x800 marquee, 5x 1280x800 screenshots.
- Horizontal logo lockup + favicon for landing/docs.
- Refreshed root `index.html` and aligned `docs/index.html`.
- A one-page brand sheet (mark construction, color tokens, type, do/don't) committed to the repo.

## Milestones & sequence
1. Lock accent + neutral ramps + type, publish `tokens.css` and the brand sheet (unblocks everyone).
2. Ship logo master + 16/48/128, update `manifest.json`.
3. Migrate popup + options onto tokens (parity check with [[Frontend]]).
4. Refresh landing + docs.
5. Produce CWS store-asset pack and screenshots (needs the migrated UI to exist first).
6. Final AA contrast + Pre-Flight audit, then handoff to [[Release Engineering]] for the CWS submission bundle.

## Dependencies
- [[Project Management]] for the CWS submission deadline and asset-due dates that gate milestone 5.
- [[UX]] owns the privacy-policy and permission-justification wording; I own its visual presentation. Needed before listing is complete.
- [[Frontend]] integrates `tokens.css` and the migrated `popup.css`/`options.css` into the Vite/`@crxjs` build; we pair on the parity check.
- [[Release Engineering]] packages the `dist/` build + asset pack for CWS; consumes my final icons and screenshots.
- [[Mac Client]] consumes the icon set and accent token for the macOS tray/`NSStatusItem` and overlay so the desktop app matches the new identity.

## Risks & mitigations
- **CWS rejects screenshots for misleading UI.** Mitigation: every screenshot is a real capture of the migrated extension, no mockups.
- **16px icon turns to mud.** Mitigation: the spec already collapses 16px to the caret-only atom; verify on a real toolbar before sign-off.
- **Green accent collides with the "all clear / good score" green and the rose error state reads too close to brand.** Mitigation: accent green is brand-and-success only; errors use rose/steel/ochre, tested side by side.
- **Geist licensing in a shipped extension.** Mitigation: Geist is OFL/MIT; self-host and include the license file; confirm with [[Release Engineering]].
- **Token migration regresses popup layout.** Mitigation: swap variables only, no structural CSS changes, diff-reviewed with [[Frontend]].

## Definition of done
- New identity live in popup, options, landing, and docs with zero `#4F46E5`/`#7C3AED`/`#2563eb` and zero Inter in shipped surfaces.
- Icon set wired in `manifest.json`, each size verified legible on light and dark toolbars.
- Full CWS asset pack delivered at exact required dimensions, all screenshots from the real migrated build.
- Every text/background pair passes WCAG AA in both modes, ratios recorded.
- Brand sheet committed; one accent locked across every surface; Pre-Flight Check clean with no em-dashes anywhere.
