---
tags: [ogrammar, phase-2, ux]
owner: UX Lead
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

Owner: UX Lead - Reports to: CEO (second brain)

## Charter
Own the end-to-end product and marketing UX for the OGrammar Chrome Web Store launch: first-run onboarding that puts the privacy-first promise front and center, the popup + options redesign on the new brand, the inline underline / suggestion-card / rewrite-pill interaction polish, and the landing + store-listing conversion flow. My mandate is to make a published, fully usable extension that feels obviously different from the OpenGrammar original and converts a cold visitor into an installed, configured user who trusts that their text never leaves their machine by default. I do not own brand assets or final visual identity (that is [[Brand & Design]]); I own how those assets are deployed into real flows and screens.

## Objectives (Phase 2)
- Onboarding that reaches "first issue underlined in a real text field" in under 60 seconds, with zero required account and no forced API key (local engine works on step one).
- Popup and options rebuilt on the new color/type system with zero indigo/violet remnants and the popup/options color mismatch (`--og-primary #4F46E5` vs options `--primary #2563eb`) resolved to one token set.
- Privacy disclosure surfaced in-product (not just policy page): a one-screen "what stays local / what leaves only if you opt in" panel reachable from popup and onboarding.
- Landing page with a single primary CTA ("Add to Chrome") above the fold and a measurable section order; secondary CTA = "See how it works."
- Complete CWS listing UX package: title, short + long description direction, permission-justification copy direction, and a 5-screenshot storyboard, all ready for [[Project Management]] submission.
- WCAG 2.1 AA pass on popup, options, and overlay interactions (contrast, focus order, keyboard operability of the suggestion card and pill).

## Delegated roles & tasks
**Onboarding Designer - first-run flow**
- Design the 3-step first-run tab (opens on install): step 1 "It already works - type in any field" (local engine, no setup), step 2 "Make it private-by-default or bring your own AI" (provider picker incl. Ollama-local), step 3 "Pin OGrammar + try it here" with a live demo textarea.
- Spec the empty/permission states: `<all_urls>` rationale shown inline before first activation, not a scary wall.
- Define re-entry: onboarding reachable later from options ("Replay setup").

**Popup Redesign Designer - the daily surface**
- Rebuild the score-ring + issue-chips + AI-card popup on the new tokens; keep the Grammarly-style information hierarchy but re-skin completely.
- Add a persistent "Local-only" / "AI: <provider>" status chip in the popup header so the privacy mode is always visible.
- Spec states: clean field, N issues, no editable field on page, engine loading (WASM warm-up), provider error.

**Options Redesign Designer - configuration surface**
- Reorganize options into: Privacy & AI (provider/key/Ollama), Writing (categories, autocorrect, autocomplete), Sites (per-domain enable/exclude), About/Replay setup.
- Collapse the options blue onto the popup's token set; one source of truth for color/type.
- Design the BYO-key entry with a "tested OK" affordance and an explicit "key stored locally, never sent to us" line.

**Interaction Designer - inline overlay polish**
- Tighten underline semantics (Harper red solid vs LLM blue dotted vs clarity amber) and the hover-to-card transition; ensure the card is keyboard reachable and dismissible.
- Spec the rewrite-pill placement, light-dismiss, and the suggestion-card layout (kicker / reason / candidate buttons / "add to dictionary").
- Define ghost-text autocomplete accept/dismiss affordance and how it coexists with underlines.

**Marketing UX / Landing Designer - conversion**
- Own landing IA and section order (see Deliverables); kill all upstream "OpenGrammar"/Swadhin Biswas author + `og:image` references; new `og:image` and title.
- Build the "what stays local" proof module and the provider logo strip (OpenAI/OpenRouter/Groq/Together/Ollama).
- Wire the single primary CTA and instrument it for click tracking direction.

**Store Listing Copywriter - CWS package**
- Draft title, 132-char short description, and long-description direction with the host-permission justification framing.
- Produce the 5-screenshot storyboard captions and on-image copy direction.
- Draft the in-product privacy panel copy (mirrors policy page, plain language).

## Deliverables
- First-run onboarding spec + interactive prototype (3 steps, live demo textarea), with permission-rationale microcopy.
- Redesigned popup: states (clean / N issues / no field / loading / provider error), header status chip, on new tokens; updated `popup.css` + `popup.tsx` direction.
- Redesigned options: 4-section IA, unified token set, BYO-key "tested OK" + local-storage assurance; updated `options.css` + `options.tsx` direction.
- Inline overlay interaction spec: underline legend, hover/keyboard card, rewrite-pill, ghost-text accept/dismiss, dictionary add.
- In-product privacy panel (one screen) reachable from popup + onboarding.
- Landing page IA + copy deck on the new brand; new `og:image`, title, meta; provider strip; "what stays local" module; single "Add to Chrome" CTA + secondary "See how it works."
- CWS listing UX package: title, short + long description direction, permission-justification copy, 5-screenshot storyboard with captions.
- WCAG 2.1 AA checklist + remediation notes for popup / options / overlay.

## Milestones & sequence
1. Token + component freeze with [[Brand & Design]] (color/type system locked) - unblocks every screen.
2. Popup redesign direction (highest-traffic surface) + privacy status chip.
3. Onboarding flow spec + live-demo prototype.
4. Options 4-section IA on unified tokens; BYO-key flow.
5. Inline overlay interaction polish + accessibility pass.
6. Landing IA + copy deck; strip upstream branding/meta.
7. CWS listing package (title/desc/storyboard) handed to [[Project Management]] for submission.
8. WCAG AA audit + remediation across popup/options/overlay.

## Dependencies
- [[Brand & Design]] - new logo, icon set (16/48/128 + 440x280 + 1280x800), color tokens, type scale. Hard blocker on milestone 1; every screen waits on the token freeze.
- [[Project Management]] - owns CWS submission, privacy-policy hosting, review-response loop; consumes my listing package and permission-justification copy.
- [[Frontend]] - implements popup/options/landing redesigns and onboarding tab; I hand specs + CSS token direction, they wire `popup.tsx` / `options.tsx` / content-script affordances.
- [[Release Engineering]] - produces the signed `dist/` build, version bump, and the CWS package zip; I confirm screenshots match the shipped build.
- [[UX]] research/copy partners on microcopy and the privacy panel wording.
- [[Mac Client]] - I share the suggestion-card / pill / underline interaction spec so the macOS overlay mirrors the extension UX (Goal 2 parity), but it is not a blocker for Goal 1.

## Risks & mitigations
- `<all_urls>` review friction: mitigate with inline pre-activation rationale + a dedicated permission-justification doc, and frame screenshots to show editable-field text-checking only (no browsing data).
- Brand-token slip blocks all screens: lock a minimal token contract (primary, accent, neutrals, 3 issue colors, type scale) in milestone 1 even if full art lags; build screens against the contract, swap art later.
- Privacy claim must be exact: every "stays local" statement gated by [[UX]]/legal so in-product copy matches the actual data flow (local engine = no network; BYO-AI = text goes to the user's chosen provider only). No overclaiming.
- Screenshot drift vs shipped build: take store screenshots only from the [[Release Engineering]] signed build, not mockups, to avoid CWS rejection for mismatched UI.
- Inconsistent identity if old assets linger: explicit kill-list (root `index.html` author + `og:image`, indigo tokens, options blue) tracked to closure before submission.

## Definition of done
- Published, installable OGrammar listing live on the Chrome Web Store, passing review on first or second pass.
- New install opens onboarding; user sees a real underline in a live field within 60s without an account or API key.
- Popup + options ship on one unified, non-indigo token set; no `#4F46E5`/`#7C3AED`/`#2563eb` remnants; privacy status chip visible.
- Landing page carries zero upstream "OpenGrammar"/Swadhin Biswas references; new `og:image`/title; single "Add to Chrome" CTA live.
- In-product privacy panel shipped and consistent with the hosted privacy policy.
- CWS listing package (title, descriptions, 5 screenshots, permission justification) accepted by [[Project Management]] and reflected in the live listing.
- WCAG 2.1 AA checklist signed off on popup, options, and overlay interactions.
