---
tags: [ogrammar, phase-2, release]
owner: Release & Compliance Lead
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]]

I have everything I need. One note: the README says "Google Docs is intentionally out of scope" yet the manifest ships a `google-docs.ts` content script matched on `docs.google.com` — a documentation/manifest inconsistency worth flagging for the listing copy. Analytics uses `chrome.storage.sync` (lives in the user's Google account, not a developer server) which is a clean disclosure story. I have all facts grounded. Writing the note.

> Owner: Chrome Web Store Release & Compliance Lead - Reports to: CEO (second brain)

## Charter
Own the path from the current MV3 build (`extension/dist/`, v0.9.0) to a published, fully usable Chrome Web Store listing without policy rejection. I convert OGrammar's local-first architecture from a review liability into a compliance advantage and a marketing hook, draft every mandatory legal and disclosure artifact, and gate the public launch behind a staged unlisted-then-public rollout. I do not own visual identity or the listing's graphic look (that is [[Brand & Design]]); I own correctness, policy, copy-for-review, packaging, and submission.

## Objectives (Phase 2)
- Pass CWS review on first or second submission; zero "remote code" or "single purpose" rejections.
- Ship a hosted PRIVACY POLICY URL and a complete Data Use disclosure mapped 1:1 to declared permissions before submission.
- Deliver a justification string for `<all_urls>` host access and each of `storage` / `activeTab` / `scripting` that a reviewer accepts without follow-up.
- Produce a CWS-valid asset set: 128 icon, 1-5 screenshots (1280x800 or 640x400), 440x280 small promo tile, optional 1400x560 marquee.
- Reproducible packaging: a clean `dist/` zip under 10 MB-equivalent, version-bumped, with a written submit/rollback runbook.
- Staged rollout: unlisted private-test build validated by real installs, then public with percentage rollout enabled.

## Delegated roles & tasks
- **Policy Analyst (manifest & permissions audit)** - own the review-surface risk register.
  - Write the `<all_urls>` host justification; evaluate and document why narrowing to `activeTab`-only is NOT viable (inline checking must run passively in editable fields on arbitrary sites, not only on toolbar click).
  - Draft per-permission justification copy for `storage`, `activeTab`, `scripting`; confirm no permission triggers an avoidable install-time warning.
  - Produce the single-purpose statement ("detect and correct writing issues in editable text fields on the web") and confirm content scripts, popup, and options all serve it.
  - Verify the remote-code position: confirm `wasm-unsafe-eval` is the only eval-class CSP token, that all JS/WASM/model bytes (`harper_wasm_bg.wasm`, `ngram/model.bin`, `dict/frequency_dictionary_en_82_765.txt`) ship inside the package, and that no code is fetched at runtime. (Confirmed clean: no `eval(`/`new Function`/CDN import in `extension/src`.)
- **Privacy & Data-Use Writer** - own legal artifacts.
  - Author the hosted privacy policy (local-first default; BYO-key LLM is the only egress and only to the user-chosen provider in `types.ts`; API keys encrypted at rest, never synced; analytics live in `chrome.storage.sync` under the user's own Google account, no developer server).
  - Fill the CWS Data Use form: declare the LLM-bound text/page-context categories, certify no selling, no unrelated use, no creditworthiness use.
  - Reconcile the doc inconsistency: README says "Google Docs intentionally out of scope" but the manifest ships `google-docs.ts` on `docs.google.com`; settle the true behavior and align policy + listing copy so a reviewer finds no contradiction.
- **Listing Copywriter** - own store text.
  - Write title, 132-char summary, and the detailed description leading with "private, local-first writing help everywhere on the web"; section the BYO-AI providers, Gmail/Docs integrations, and zero-default-egress.
  - Draft 5 screenshot captions and the promo tile tagline; supply alt text.
  - Pick primary category (Productivity) and locale set (en first; flag i18n debt).
- **Packaging & Release Engineer** (shared with [[Release Engineering]]) - own the artifact.
  - Produce the deterministic zip from a clean Vite/`@crxjs` build; strip `create_icons.py`, `playground/`, source maps, and any dev-only files from the shipped package; confirm size budget.
  - Bump `manifest.json` version per release; tag the repo; write the submit + staged-rollout + rollback runbook.
- **Test & Verification Lead** - own pre-submit proof.
  - Load the exact zip unpacked and via the unlisted Dashboard build; verify popup, options, inline highlight, autocorrect, and one BYO-key path on a real site, Gmail, and Docs.
  - Confirm no console errors, no unexpected network calls when no provider is configured (proves the local-first claim).

## Deliverables
- `RISK-REGISTER.md`: manifest/permission/policy findings with severity and de-risk action each.
- `privacy-policy.html` (hosted at a stable public URL) + filled CWS Data Use disclosure.
- `permission-justifications.md`: the exact strings pasted into the Dashboard fields.
- `single-purpose.md`: the one-sentence purpose + mapping to every entry point.
- Asset package: 128 icon, screenshots (1280x800), 440x280 small promo, optional 1400x560 marquee (graphics produced by [[Brand & Design]]; I own specs, sizing, and acceptance).
- `listing-copy.md`: title, summary, description, captions, category, locales.
- `ogrammar-<version>.zip` (submission artifact) + `RELEASE-RUNBOOK.md` (submit, staged %, rollback).

## Milestones & sequence
1. **Audit complete** - RISK-REGISTER signed off; `<all_urls>` strategy decided (justify, not narrow).
2. **Legal ready** - privacy policy hosted and live at a public URL; Data Use form drafted.
3. **Copy + justifications frozen** - listing copy and permission strings final; brand assets specced.
4. **Assets delivered** - icon/screenshots/promo received from [[Brand & Design]] and validated against CWS pixel specs.
5. **Package + dry-run** - clean zip built, unpacked-load verification passed by Test Lead.
6. **Unlisted submission** - submit as Unlisted/private; real-install smoke test; capture any reviewer notes.
7. **Public rollout** - flip to Public with percentage rollout; monitor; ramp to 100%.

## Dependencies
- [[Project Management]] - developer account creation, the one-time $5 registration fee, and the Google identity that owns the listing; release calendar.
- [[Brand & Design]] - new logo/icon set (16/48/128), color + type system, and all promo graphics; my specs gate their pixel dimensions.
- [[Frontend]] - any popup/options copy or string changes triggered by the listing and privacy reconciliation; the `google-docs.ts` scope clarification.
- [[UX]] - screenshot scenarios that read clearly at 1280x800; first-run permission prompt wording.
- [[Release Engineering]] - the reproducible build/zip pipeline, version bump, and tag.
- [[Mac Client]] - none blocking; share the privacy-policy boilerplate so the Mac client and extension tell one consistent local-first story.

## Risks & mitigations
- **`<all_urls>` review friction (highest).** Mitigate: precise host justification tied to single purpose; lead the policy with local-first/zero-default-egress; offer the narrative that passive inline checking cannot be `activeTab`-only. Fallback: ship a runtime host-permission opt-in (request access per-site) if the reviewer pushes back.
- **Remote-code rejection from `wasm-unsafe-eval`.** Mitigate: document that WASM is local-compiled (Harper engine), all bytes packaged, zero runtime fetch of executable code; cite the clean `extension/src` eval scan in the justification.
- **Missing/weak data disclosure.** Mitigate: privacy policy live BEFORE submit; Data Use form explicitly names the only egress (user-chosen LLM) and asserts no sale/no unrelated use.
- **Doc/manifest contradiction on Google Docs.** Mitigate: reconcile README vs `google-docs.ts` before listing copy ships, so reviewer sees no inconsistency.
- **Listing assets miss CWS pixel/format specs.** Mitigate: I own a spec sheet; Test Lead validates dimensions before upload; no last-minute resizing.
- **Single-purpose challenge from breadth (grammar + rewrite + autocomplete + analytics).** Mitigate: frame all features as facets of one purpose - improving writing in editable web fields; analytics is local usage stats, not tracking.
- **Bundled dev artifacts inflating/contaminating the package** (`create_icons.py`, `playground/`). Mitigate: packaging step strips non-shipping files; diff the zip contents against an allowlist.

## Definition of done
- Listing is Public on the Chrome Web Store, installable, and the installed build passes the Test Lead's real-site / Gmail / Docs smoke test with zero console errors.
- Privacy policy resolves at its public URL and matches the in-product and Data Use disclosures word-for-fact.
- All permission and single-purpose justifications are the exact accepted Dashboard strings, archived in-repo.
- A tagged `ogrammar-<version>.zip` reproduces from a clean build, and `RELEASE-RUNBOOK.md` lets any engineer resubmit or roll back unaided.
- No open CWS reviewer action items; staged rollout has reached 100% with no policy flags.
