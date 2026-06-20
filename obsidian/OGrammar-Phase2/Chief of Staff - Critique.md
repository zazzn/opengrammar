---
tags: [ogrammar, phase-2, critique]
owner: Chief of Staff
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

Verified the load-bearing facts: `<all_urls>` + 3 content scripts (including the `google-docs.ts` that contradicts the README), `wasm-unsafe-eval`, WASM/model/dict in `web_accessible_resources`, no privacy policy, no version pipeline, CI is Bun-on-`main` while work is on `og-rewrite`. The plans match reality. Here is the Chief of Staff note.

---

> Owner: Chief of Staff - Reports to: CEO

The six plans are individually strong and factually grounded. As one system they have three structural problems: **five departments all claim to produce the same CWS asset pack and privacy copy**, the **brand-lock gate (M0) is a single point of failure that idles four teams**, and the plans quietly disagree on the one thing that decides whether half the work even ships (`<all_urls>` survival, Mac Accessibility). Below is the integrated read.

## Integration & sequencing

The two goals share exactly one hard dependency: the **brand token file**. Everything else in Goal 2 is brand-token-only coupled and can run fully parallel from day one. So the correct shape is: brand sprints first and narrow, Goal 1 web/store work trails it, and [[Mac Client]] runs its own track in parallel gated only by the token handoff.

Recommended end-to-end order:

**Phase A (week 1) - Brand lock + parallel spikes.**
- [[Brand & Design]] delivers ONLY the token contract first (accent `#1FA463`, neutral ramp, 3 issue colors, type = Geist) as `tokens.css`. This is the single gate. Logo/icon master can lag a few days; the token contract cannot.
- In parallel, brand-independent: [[Mac Client]] builds `ograms-ffi` staticlib + the offset-parity harness vs Windows (milestone 1). [[Release Engineering]] writes the RISK-REGISTER and the `<all_urls>` justification. [[Frontend]] fixes the toolchain rot (CI triggers, npm-not-Bun, `release.sh`, strip sourcemaps) - none of that needs brand.

**Phase B (weeks 1-2) - Surfaces on tokens.**
- [[UX]] + [[Frontend]] migrate popup/options onto the token set and kill the `#4F46E5`/`#2563eb` drift. [[Brand & Design]] ships logo + 16/48/128 and wires `manifest.json`.
- [[Mac Client]] lands the AppKit skeleton + P0 (hotkey, Cmd-C, paste-in panel) - usable on day one without Accessibility.

**Phase C (week 2) - Compliance pack (the real gate to submission).**
- [[Frontend]] hosts the live `/privacy` URL. [[UX]]/[[Release Engineering]] freeze permission justifications and the data-use disclosure. **No CWS submission exists until this URL resolves.**

**Phase D (week 3) - Goal 1 submit.** Assets must exist FIRST (they require the migrated UI to screenshot). [[Release Engineering]] packages, submits Unlisted, opens the reviewer loop. [[Mac Client]] lands the AX read + apply path (P1).

**Phase E (weeks 3-5) - Goal 1 live, Goal 2 feature-complete.** Buffer one CWS resubmission cycle. [[Mac Client]] mirrors full 3-tier UX + pill + Keychain + LaunchAgent.

**Phase F (weeks 5-6) - Goal 2 ship + CEO sign-off.**

The hard ordering truths everyone implies but nobody states plainly: **tokens before any screen; migrated UI before screenshots; live privacy URL before submission; assets before packaging.** Screenshots cannot precede the UI migration, which cannot precede the token lock. That is the real critical path, and it is serial.

## Gaps & unowned work

- **Developer-account ownership and the $5 fee are named but not assigned to a human.** [[Release Engineering]] and [[Project Management]] both gesture at it; neither owns the Google identity the listing will live under. This is a CEO input, not a department deliverable (see decisions).
- **The Google Docs contradiction is acknowledged by two departments but nobody owns the code decision.** [[Release Engineering]] and [[Frontend]] both flag README-says-out-of-scope vs `google-docs.ts` shipping on `docs.google.com`. Flagging is not fixing. Someone must decide: keep the script (update the README + listing) or drop it (edit `manifest.json`). Unowned. Assign to [[Frontend]] as a code change with a one-line decision from [[Release Engineering]].
- **`web_accessible_resources` exposes the dict/model/WASM to `<all_urls>`.** Confirmed in the manifest. A CWS reviewer can ask why every site can fetch an 18 MB WASM blob. No department wrote that specific justification - they wrote the host-permission and CSP justifications. [[Release Engineering]] should add a fourth WAR justification line.
- **Font licensing as a release gate is assumed, not verified.** [[Brand & Design]] says "Geist is OFL/MIT, confirm with [[Release Engineering]]." Nobody owns actually checking the license file ships and is correct. Small, but it is a real CWS/legal line item with no owner.
- **No analytics/data-use disclosure owner for the `chrome.storage.sync` story.** [[Release Engineering]] correctly notes analytics live in the user's own Google account (clean story), but the Data Use FORM still has to declare it. Owned implicitly, not explicitly.
- **Mac client has no crash/error telemetry and no update path.** Personal-use scope makes this acceptable, but "how does the user get v2 of the `.app`" (re-zip and re-`xattr`) is undocumented. Minor; note it in `MACOS-INSTALL.md`.

## Conflicts & overlaps to resolve

- **The CWS asset pack is claimed by THREE departments at THREE different specs.** [[Brand & Design]] says marquee 1280x800. [[Release Engineering]] says optional 1400x560 marquee. [[Frontend]] says marquee 1440x560 and wants a *Playwright screenshot harness*. This will produce duplicate, mis-sized work. **Resolution: [[Release Engineering]] owns the spec sheet (exact pixel dims, this is correctly their charter), [[Brand & Design]] owns the art direction/templates, [[Frontend]] owns the automated capture pipeline. One spec, one producer per asset type.** The CWS marquee is 1400x560 - [[Brand & Design]]'s 1280x800 and [[Frontend]]'s 1440x560 are both wrong and must defer to [[Release Engineering]].
- **Privacy policy is written by three pens.** [[UX]] ("Privacy Policy Author"), [[Release Engineering]] ("Privacy & Data-Use Writer"), and [[Frontend]] ("Privacy/Listing Copywriter") all draft it. **Resolution: [[Release Engineering]] owns the canonical legal text** (they own the Data Use form it must match word-for-fact), [[UX]] owns the in-product plain-language panel, [[Frontend]] owns hosting the page. Three surfaces, one source of truth.
- **Permission-justification copy is quadruple-owned** ([[UX]], [[Frontend]], [[Release Engineering]], [[Project Management]]). [[Release Engineering]] is the right owner - it is pasted into the Dashboard and they own the reviewer loop. The others contribute, do not author.
- **Token migration of `popup.css`/`options.css` is claimed by both [[Brand & Design]] and [[UX]].** Resolution: [[Brand & Design]] owns `tokens.css` and the values; [[UX]] owns the IA/component direction; [[Frontend]] owns the actual code edit and the build parity check. Avoid two hands editing the same CSS.
- **The icon pipeline is double-built.** [[Brand & Design]]'s "Logo & Icon Designer" exports 16/48/128, and [[Frontend]]'s "Brand Asset Producer" also builds a rasterize script. One rasterization pipeline. [[Frontend]] owns the script, fed by [[Brand & Design]]'s `logo.svg`.
- **Landing/docs rebrand is owned by [[Brand & Design]] AND [[Frontend]].** [[Frontend]] does the engineering, [[Brand & Design]] does the art direction. Fine, but they must agree the site lives in `docs/` on `og-rewrite` (GitHub Pages) - [[Frontend]]'s plan is concrete here, [[Brand & Design]]'s is not. Defer hosting mechanics to [[Frontend]].

## Top risks (ranked)

1. **`<all_urls>` + 3 all-frames content scripts + `wasm-unsafe-eval` triggers manual review and possible rejection (kills Goal 1).** This is the single highest-probability launch-blocker and every department named it. Mitigation: lead the listing with local-first/zero-default-egress; ship the airtight host justification AND the missing `web_accessible_resources` justification; have the **runtime per-site host-permission opt-in ready as a coded fallback**, not just a narrative. [[Release Engineering]] owns; do not treat the fallback as hypothetical - scope it now so a rejection costs days, not a redesign.
2. **MDM hard-blocks Accessibility on the target Mac (guts Goal 2's P1).** [[Mac Client]] correctly designed a fallback ladder, but if AX is blocked the user gets NO underlines and NO live tracking - only hotkey+paste-in. The CEO may consider that a failed Goal 2. **This must be confirmed with the CEO before any P1 effort is spent** (see decisions). Mitigation: P0 (Input Monitoring + paste-in) is mandatory and ships first regardless; P1 is conditional.
3. **The M0 brand-lock gate idles four teams if it slips.** Single point of failure. Mitigation: decompose M0 - ship the *token contract* (6 values) in days as the real gate; let logo/icon/screenshots lag. Build every screen against the token contract and swap final art later. [[UX]] and [[Frontend]] both proposed this; make it policy.
4. **No live privacy policy URL = automatic CWS rejection.** Pure gate. Mitigation: [[Frontend]] hosts it in Phase C; the doc-only version is "not done." Hard checklist line.
5. **Brand residue ships (upstream "Swadhin Biswas" author, `swadhinbiswas/opengrammar` `og:image`, indigo `#4F46E5`/`#2563eb`, Inter, quill icon).** Embarrassing and undercuts the "completely different" mandate. Mitigation: a **grep-gate in CI** across `index.html`, `docs/`, `popup.css`, `options.css`, `icon.svg`, `manifest.json` - fail the build on any legacy string. [[Frontend]] owns; this is cheap and catches the whole class.
6. **FFI offset drift (char vs utf16) corrupts Mac underlines/applies.** Quietly the nastiest Goal 2 bug. Mitigation: the fixed-corpus parity harness vs Windows is a release gate, built in Phase A before any UI depends on it. [[Mac Client]] owns.
7. **Screenshot drift vs the shipped build.** Mitigation: capture only from the real migrated `dist/` (Playwright harness), never mockups - this is also why screenshots are late in the sequence by necessity.

## CEO decisions needed

1. **Goal 2 Accessibility scope - the defining question.** If the target Mac is MDM-managed and Accessibility is blocked, is **P0-only (global hotkey + paste-in check/rewrite, no underlines, no live tracking) an acceptable "Goal 2 done"**, or is AX-based inline underlining a hard requirement? Your answer determines whether [[Mac Client]] spends weeks on P1. Please confirm the target Mac's management status before Phase D. Default recommendation: accept P0 as the floor, treat P1 as best-effort upside.

2. **Chrome Web Store account & identity.** Who owns the Google account that publishes OGrammar, and who pays the one-time $5 registration? This blocks the entire submission and is not a department deliverable. Also: do we publish under a personal Google identity or create a dedicated project account? (Affects the "no upstream author" mandate - the listing's developer name is public.)

3. **Landing-page hosting.** [[Frontend]] proposes GitHub Pages from `docs/` on `og-rewrite`. The privacy policy URL must be live and stable before submission. Confirm: GitHub Pages acceptable, or do you want a custom domain (which changes the privacy URL and the `og:` meta)? This gates Phase C.

4. **The Google Docs scope contradiction.** README says Google Docs is out of scope; the manifest ships `google-docs.ts` on `docs.google.com`. Do we **keep** Docs support (update docs + market it as a feature) or **remove** it (cleaner single-purpose story for review)? A reviewer will see the contradiction either way. One-line CEO call unblocks [[Frontend]] and the listing copy.

5. **`og-rewrite` -> default branch.** Work, CI, and Pages all assume `og-rewrite`, but `main` is still the default and CI only triggers on `main`. Do we promote `og-rewrite` to default at v1.0.0, or keep maintaining the dual-branch CI rot? Recommend promoting at release tag.

6. **Brand name collision check (do before logo lock).** "OGrammar" is one character off "OpenGrammar" and near "Grammarly." Before [[Brand & Design]] burns effort on the mark, confirm we are comfortable shipping under this name to a public store (trademark/confusion risk is a CEO-level call, not a designer's).

The plan is sound if you make M0 a token-contract gate instead of a full-brand gate, force single ownership of the asset pack and privacy text, and answer the Accessibility question before [[Mac Client]] commits to P1. Those three moves remove the only failure modes that can actually sink either goal.
