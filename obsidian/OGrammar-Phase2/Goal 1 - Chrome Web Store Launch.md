---
tags: [ogrammar, phase-2, goal-1]
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

# Goal 1 - Chrome Web Store Launch

**Outcome:** OGrammar published on the Chrome Web Store as a fully usable extension, under a brand-new identity that is graphically nothing like the original OpenGrammar.

**Owners:** identity [[Brand & Design]] · product + copy UX [[UX]] · compliance + submission [[Release Engineering]] · build + hosting [[Frontend]] · schedule [[Project Management]].

## Critical path (serial - do not reorder)
1. **`tokens.css`** - 6 locked values (accent `#1FA463`, neutral ramp, 3 issue colors, Geist). The single gate; logo can lag.
2. **Migrate** `popup.css` + `options.css` onto tokens. Kills the `#4F46E5` / `#2563eb` drift and Inter.
3. **Screenshot** the real migrated UI (Playwright capture of the live `dist/`, never mockups).
4. **Host** a live `/privacy` URL. No submission exists until this resolves.
5. **Package** `dist/` (zip, versioned) and **submit** Unlisted, then promote to public.

## What exists vs what's missing
From [[Discovery Briefing]]:
- **Exists:** working MV3 build (`dist/`), icons, popup/options UI, content/background logic, doc-site, Apache-2.0 license.
- **Missing / blocking:** no privacy policy, no store-listing assets, no permission-justification copy, branding still "OpenGrammar"/indigo with the upstream author + `og:image` in the root `index.html`.

## Compliance gates (owned by [[Release Engineering]])
- `<all_urls>` host justification **and** a justification for `web_accessible_resources` exposing the WASM/model/dict to every site.
- `wasm-unsafe-eval` (Harper WASM) explanation for review.
- **Live privacy policy** + data-use disclosure form. Local-first is the selling point: nothing leaves the machine by default; analytics live in the user's own Google account; the LLM tier is bring-your-own-key/opt-in.
- Single-purpose policy: resolve the **Google Docs contradiction** (decision #4 - keep + market it).

## New identity (owned by [[Brand & Design]])
Proof-caret mark, signal green `#1FA463`, Geist, off-black. One `tokens.css` consumed by popup, options, landing, docs. CWS asset pack: 128 store icon, 440x280 promo tile, **1400x560** marquee (the correct CWS size), and 5 screenshots at 1280x800.

## Single ownership of shared assets (per [[Chief of Staff - Critique]])
- Store-asset **spec / exact dims** → [[Release Engineering]].
- Store-asset **art direction / templates** → [[Brand & Design]].
- **Automated capture** pipeline → [[Frontend]].
- **Canonical privacy text** → [[Release Engineering]]; in-product plain-language panel → [[UX]]; hosting → [[Frontend]].

## Definition of done
Extension published on the CWS, AND a CI **grep-gate** passes with zero legacy residue (`#4F46E5`, `#2563eb`, Inter, "Swadhin Biswas", `swadhinbiswas/opengrammar` `og:image`, quill icon) across `index.html`, `docs/`, `popup.css`, `options.css`, `icon.svg`, `manifest.json`.
