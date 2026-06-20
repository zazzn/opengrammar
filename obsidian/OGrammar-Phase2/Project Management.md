---
tags: [ogrammar, phase-2, pm]
owner: Project Manager
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

Now I have enough grounding. The mac crate does not yet exist, manifest confirms `<all_urls>` and the resource surface. Delivering the PM department note.

> Owner: Project Manager / Chief Delivery Officer - Reports to: CEO (second brain)

## Charter
Own end-to-end delivery of Phase 2: a published, rebranded OGrammar Chrome extension (Goal 1) and a private no-admin macOS desktop client (Goal 2). I sequence the two goals so they run partly in parallel without starving each other, hold the cross-department dependency map, gate every Chrome Web Store (CWS) submission risk before it surfaces in review, and define exactly when "Phase 2 done" is true. I do not write brand assets, UI, or Rust myself; I unblock the people who do and keep the critical path honest.

## Objectives (Phase 2)
- Goal 1: OGrammar v1.0.0 LIVE on the Chrome Web Store, passing review on the first or second attempt, under a brand-new identity (new hue family, new logo metaphor, new typeface) with zero residual "OpenGrammar"/indigo/quill assets and zero upstream-author/`og:image` references shipping in `index.html` or `docs/index.html`.
- Goal 1: 100% of CWS launch blockers closed - published privacy policy URL, written `<all_urls>` + 3-content-script + WASM-CSP + web-accessible-resources justifications, and a full sized asset set (16/48/128 icon PNGs, 440x280 small tile, 1280x800 promo, 5 screenshots).
- Goal 2: A running, personally usable `ograms-mac` `.app` launched from `~/Applications` with no admin and no `.dmg`, mirroring the Windows 3-tier UX (red Harper / blue LLM / opt-in autocorrect + rewrite pill), driven by AXUIElement and the clipboard fallback, reusing `ograms-engine` unchanged.
- Cross-cutting: one shared new brand token set consumed by extension popup, options, both web pages, and the Mac client; popup/options color drift (`--og-primary #4F46E5` vs options `--primary #2563eb`) eliminated.
- Predictability: a milestone plan with named owners, a live risk register, and weekly critical-path status to the CEO.

## Delegated roles & tasks
I direct the department heads below; each names their own specialists (see Org chart). The concrete charge I assign each department:

- **Brand & Design lead - "New identity, zero residue"**
  - Ship a brand bible: new non-indigo hue family, new logo metaphor (retire quill+checkmark in `extension/public/icon.svg`), new typeface replacing Inter, exported as design tokens.
  - Produce all CWS imagery at exact spec: icon PNGs 16/48/128, 440x280 small promo tile, 1280x800 marquee, 5 screenshots.
  - Deliver a single token file (CSS custom props + Rust color consts) that Frontend, UX, and Mac Client all consume.

- **UX lead - "Store-ready surfaces + permission honesty"**
  - Rewrite popup/options to the new tokens and kill the `#4F46E5`/`#2563eb` mismatch; keep the score-ring + issue-chip + AI-card layout, restyled.
  - Draft the CWS permission-justification copy (`<all_urls>`, `activeTab`, `scripting`, WASM `wasm-unsafe-eval`, web-accessible model/dict/WASM) and the in-store description matching the new brand voice.
  - Author the user-facing privacy policy content (local-first, BYO-key, "your key your data").

- **Frontend lead - "Web pages + build + listing mechanics"**
  - Rebrand root `index.html` and `docs/index.html`: strip "Swadhin Biswas" author, the upstream `swadhinbiswas/opengrammar` `og:image`, old title, indigo theme; apply new tokens.
  - Stand up a hosted privacy-policy URL (the CWS listing requires a live link, not just a doc) and wire it into the manifest/listing.
  - Verify the Vite + `@crxjs` build, bump `manifest.json` to 1.0.0, confirm `dist/` loads clean unpacked.

- **Release Engineering lead - "Submit, pass review, sign the Mac app"**
  - Package the `dist/` ZIP, register/confirm the CWS developer account, complete the data-disclosure + privacy tabs, submit, and own the reviewer back-and-forth.
  - For Mac: produce an ad-hoc/self-signed `.app` runnable without admin, document the Accessibility + Input Monitoring grant flow and the per-user LaunchAgent autostart (no `.dmg`, no notarization gate for personal use).
  - Own version tagging and the release checklist for both artifacts.

- **Mac Client lead - "Port the Windows shell to Cocoa, reuse the engine"**
  - Create the `ograms-mac` crate mirroring `ograms-hotkey`, consuming `ograms-engine` and the portable `engine_data.rs` (repoint `config_dir()` to `~/Library/Application Support/OGrammar`).
  - Implement the AX read/apply path (`AXUIElementCreateSystemWide` + `kAXFocusedUIElementAttribute`, `kAXValueAttribute`, `kAXBoundsForRangeParameterizedAttribute`) with the mandatory hotkey + `NSPasteboard`/CGEvent Cmd+V clipboard fallback for AX dead zones (Electron-with-AX-off, terminals, secure fields).
  - Rebuild overlay (borderless transparent `NSWindow`), tray (`NSStatusItem`), pill/card (nonactivating `NSPanel`), key storage (Keychain), mirroring the shipped 3-tier UX.

## Deliverables
- Phase 2 roadmap + live risk register (this note) and weekly CEO status.
- New brand bible + token file (one source consumed by extension, web, Mac).
- Full CWS asset pack: `icon-16/48/128.png`, 440x280, 1280x800, 5 screenshots.
- Rebranded `extension/public/icon.svg`, popup, options; rebranded `index.html` + `docs/index.html` with all upstream identity stripped.
- Hosted privacy policy (live URL) + permission-justification doc + store listing copy.
- `manifest.json` at 1.0.0; submitted CWS package; published extension.
- `ograms-mac` crate: runnable unsigned/ad-hoc `.app` + grant-flow doc + LaunchAgent autostart.

## Milestones & sequence
1. **M0 - Brand lock (week 1).** [[Brand & Design]] delivers hue/logo/type direction + token file. Hard gate: nothing downstream restyles until tokens are locked. Mac Client starts the engine-link spike in parallel (brand-independent).
2. **M1 - Assets + surfaces (weeks 1-2).** [[Brand & Design]] cuts all sized CWS imagery; [[UX]] + [[Frontend]] restyle popup/options/web to tokens; Mac Client lands AX read + overlay proof-of-concept.
3. **M2 - Compliance pack (week 2).** [[UX]] permission justifications + privacy copy; [[Frontend]] hosts the live privacy URL. CWS-blocker gate: no submission without this.
4. **M3 - Goal 1 submit (week 3).** [[Release Engineering]] bumps to 1.0.0, packages, submits to CWS, opens reviewer loop. Mac Client lands apply path + clipboard fallback.
5. **M4 - Goal 1 live / Goal 2 feature-complete (weeks 3-5).** CWS approval (buffer one resubmission cycle); Mac Client mirrors full 3-tier UX + tray + pill + Keychain.
6. **M5 - Goal 2 ship (weeks 5-6).** [[Release Engineering]] produces the no-admin `.app` + grant-flow doc + LaunchAgent; CEO accepts both goals. Phase done.

## Dependencies
- [[Brand & Design]] is the upstream gate for [[UX]], [[Frontend]], and [[Mac Client]] - all three consume the locked token file; M0 cannot slip without cascading.
- [[UX]] privacy/permission copy blocks [[Release Engineering]] submission (M3).
- [[Frontend]] live privacy URL blocks the CWS listing (M2 -> M3).
- [[Mac Client]] depends on [[Release Engineering]] for signing/grant-flow but is otherwise brand-token-only dependent on [[Brand & Design]]; it can run in parallel from week 1.
- [[Project Management]] owns the cross-department critical path, the M0 brand gate, and the M2 compliance gate.

## Risks & mitigations
- **CWS rejects `<all_urls>` + 3 all-frames content scripts.** Likely manual review. Mitigation: ship airtight justification copy (M2), keep `activeTab` framing, be ready to narrow content-script matches if the reviewer pushes.
- **No live privacy policy = automatic rejection.** Mitigation: M2 gate - Frontend hosts the URL before Release Eng submits; treat the doc-only version as not done.
- **WASM `wasm-unsafe-eval` CSP flag.** Mitigation: pre-justify in the submission as Harper's local engine; it is MV3-permitted, document it proactively.
- **Brand residue ships (upstream author / `og:image` / indigo leftovers).** Mitigation: explicit pre-submit grep sweep across `index.html`, `docs/index.html`, `icon.svg`, `popup.css`, `options.css` as a release-checklist line item.
- **Mac AX dead zones (Electron-with-AX-off, terminals, secure fields).** Per `docs/29`, this is the #1 functional risk. Mitigation: the hotkey + clipboard fallback is mandatory scope, not optional - it is the lowest-common-denominator that works everywhere.
- **macOS Gatekeeper blocks the unsigned `.app`.** Mitigation: document the right-click-Open / `xattr -d com.apple.quarantine` user step; personal-use scope means no notarization, but the user must be told the exact bypass.
- **Brand lock slips and stalls everything.** Mitigation: M0 is the single hardest gate; Mac Client's engine spike is deliberately brand-independent so a brand slip does not idle that team.

## Definition of done
- OGrammar 1.0.0 is published and installable from the Chrome Web Store, passed review, with the privacy policy URL live and all permission justifications accepted.
- Zero "OpenGrammar", indigo/violet, quill-checkmark, Inter, "Swadhin Biswas", or upstream `og:image` references remain in any shipped surface (`manifest.json`, `icon.svg`, popup, options, `index.html`, `docs/index.html`); popup/options share one token set.
- The full CWS asset pack exists at exact required dimensions.
- `ograms-mac` builds and runs as an unsigned/ad-hoc `.app` from `~/Applications` with no admin and no `.dmg`, mirrors the Windows 3-tier UX, reuses `ograms-engine` unchanged, applies fixes via AX-or-clipboard, stores keys in Keychain, and autostarts via a per-user LaunchAgent - with a written grant-flow + Gatekeeper-bypass doc.
- Both artifacts version-tagged; CEO has signed off on Goal 1 and Goal 2.

## Org chart
```
CEO (second brain orchestrator)
└── Project Management (Chief Delivery Officer) — me
    ├── [[Brand & Design]]
    │   ├── Logo & Iconographer — new mark, retire quill+checkmark, 16/48/128 + tile/marquee
    │   ├── Color & Type Systems Designer — new hue family + typeface, token file
    │   └── Store Visual Designer — 440x280, 1280x800, 5 screenshots
    ├── [[UX]]
    │   ├── Product UX Designer — popup/options restyle, kill color drift
    │   ├── Compliance Copywriter — permission justifications + store listing copy
    │   └── Privacy Policy Author — local-first / BYO-key policy content
    ├── [[Frontend]]
    │   ├── Web Rebrand Engineer — index.html + docs/index.html, strip upstream identity
    │   ├── Privacy-URL & Hosting Engineer — live policy URL
    │   └── Extension Build Engineer — Vite/@crxjs build, manifest 1.0.0, dist verify
    ├── [[Release Engineering]]
    │   ├── CWS Submission Manager — package, data disclosure, reviewer loop
    │   ├── Mac Packaging Engineer — ad-hoc .app, LaunchAgent autostart, grant-flow doc
    │   └── Release/Versioning Owner — tagging, release checklist
    └── [[Mac Client]]
        ├── Cocoa Shell Engineer — overlay (NSWindow), tray (NSStatusItem), pill/card (NSPanel)
        ├── Accessibility/AX Engineer — AXUIElement read/apply + bounds geometry
        └── Engine Integration Engineer — ograms-mac crate, engine_data.rs config_dir repoint, Keychain
```
