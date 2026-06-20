---
tags: [ogrammar, phase-2, moc, ceo]
owner: CEO (second brain)
status: planning
created: 2026-06-19
---

# OGrammar Phase 2 - CEO Brief

> The second brain. I set direction and delegate; the department heads below own execution and delegate downward to their own specialists. This note is the hub. Start here, then follow the [[wikilinks]].

Phase 1 shipped **v0.9.0**: extension and Windows-desktop parity on a leveled-up local engine (Harper + SymSpell + n-gram, optional LLM tier). Phase 2 turns that into a product the public can install and a tool I can run on my own Mac.

## The two goals
- **[[Goal 1 - Chrome Web Store Launch]]** - publish the extension to the Chrome Web Store as a fully usable product, under a brand-new identity that looks nothing like the original OpenGrammar.
- **[[Goal 2 - Private Mac Client]]** - a personal macOS client mirroring the Windows app, runnable with no admin rights and no `.dmg`.

## Org chart
```
CEO (second brain)
└── Project Management  -  delivery, sequencing, risk register
    ├── Brand & Design   -  identity, icons, color + type, store art   [design-taste skill]
    ├── UX               -  onboarding, options/popup, landing IA, store copy direction
    ├── Release Engineering - CWS compliance, privacy policy, packaging, submission
    ├── Frontend         -  landing/docs build, asset pipeline, extension release pipeline
    └── Mac Client       -  macOS architecture, FFI engine reuse, permission ladder
   Chief of Staff  -  cross-cuts everything (gaps, conflicts, risk)
```
Notes: [[Project Management]] · [[Brand & Design]] · [[UX]] · [[Release Engineering]] · [[Frontend]] · [[Mac Client]] · [[Chief of Staff - Critique]] · [[Discovery Briefing]]

## The new identity (at a glance)
Built by [[Brand & Design]] under the design-taste guardrails. The old look was indigo/violet gradient + quill + Inter. The new one is the opposite: an instrument, not an assistant.

![[ogrammar-mark.svg]]

- **Mark:** the **proof-caret** - the writer's text caret in signal green, enclosed by an off-white local-boundary bracket (top-left + bottom-right, not a full box). Privacy plus proofreading in one glyph. `assets/ogrammar-mark.svg`.
- **Accent (locked, one color):** signal green `#1FA463` (no AI-purple, ever).
- **Canvas:** off-black `#16191D` / off-white `#FBFCFB`. Never pure black or white.
- **Type:** Geist + Geist Mono. Not Inter, no serif.
- **Promise:** "Writing help that never leaves your machine."

## Critical path (respect this one thing)
Per [[Chief of Staff - Critique]], the path to a published extension is **serial** and short:

`tokens.css` (6 values) → migrate popup/options off indigo+Inter → screenshot the **real migrated** UI → host a **live `/privacy` URL** → package `dist/` → submit Unlisted → public.

Everything else parallelizes. The whole [[Goal 2 - Private Mac Client]] track is coupled to Goal 1 by **only** the token file, so it runs alongside from day one.

| Phase | Window | Headline |
|---|---|---|
| A | Week 1 | Lock the **token contract** (6 values, not the full brand) + parallel spikes: Mac `ograms-ffi` + parity harness, Release risk register + `<all_urls>` justification, Frontend toolchain fixes |
| B | Weeks 1-2 | Migrate popup/options onto tokens; logo + 16/48/128 wired into `manifest.json`; Mac P0 (hotkey + paste-in) usable |
| C | Week 2 | Compliance pack: **live `/privacy` URL**, frozen permission justifications, data-use form |
| D | Week 3 | Submit Goal 1 (Unlisted); Mac P1 (AX read + underlines) |
| E | Weeks 3-5 | Goal 1 public (buffer one resubmit); Mac feature-complete (pill, Keychain, LaunchAgent) |
| F | Weeks 5-6 | Goal 2 ship + sign-off |

## CEO decisions
My call where I can make it; flagged where I need you.

| # | Decision | My call | Needs you? |
|---|---|---|---|
| 1 | **Mac Accessibility scope** - is P0-only (hotkey + paste-in, no underlines) an acceptable "Goal 2 done" if the Mac MDM-blocks Accessibility? | Accept P0 as the floor, treat AX underlines (P1) as best-effort upside | **Yes** - confirm whether that Mac is MDM-managed |
| 2 | **CWS account + $5 fee** | RESOLVED - user owns the Google account and pays the $5. Recommend the public *developer name* be a dedicated "OGrammar" identity, not personal | Resolved |
| 3 | **Landing + privacy hosting** | GitHub Pages from `docs/` on `og-rewrite` (free, stable, gives the `/privacy` URL) | Only if you want a custom domain |
| 4 | **Google Docs scope** (README says out-of-scope, manifest ships `google-docs.ts`) | **Keep** it, market it, update the README + listing; one single-purpose story | No (I'll direct [[Frontend]]) |
| 5 | **`og-rewrite` to default branch** | Promote at the `v1.0.0` tag; fix CI to trigger off it | No |
| 6 | **Name collision** (OGrammar vs OpenGrammar/Grammarly) | Gut-check before logo lock; trademark/confusion is your call | **Yes** - comfortable shipping under "OGrammar" publicly? |

## Top risks (ranked)
1. `<all_urls>` + 3 all-frames content scripts + `wasm-unsafe-eval` triggers manual review / possible rejection (the Goal 1 blocker). Lead with local-first; ship every justification; scope the per-site opt-in fallback as real code, not a story. Owner [[Release Engineering]].
2. MDM hard-blocks Mac Accessibility (guts Goal 2 P1). P0 ships regardless; P1 conditional on decision #1.
3. The brand-lock gate idling four teams. Fix: gate on the 6-value token contract, not the full brand.
4. No live privacy URL = automatic rejection. Pure checklist gate.
5. Brand residue shipping (Swadhin author, upstream `og:image`, `#4F46E5`, Inter, quill). Fix: a **grep-gate in CI**.

## Asset + tooling pipeline
- **Codex CLI** is installed (`codex exec`, v0.139.0, on WSL + Windows PATH) - the offload path for heavy or parallel coding during the build phases.
- **Image generation:** the `openai` CLI exposes `images.generate` (gpt-image-1) for raster store art (440x280 tile, 1400x560 marquee, hero). It needs an API key wired - none is in the environment yet; the Zapier MCP and the ChatGPT desktop app are alternates. The vector logo ships as SVG; the 16/48/128 PNGs rasterize deterministically from it (no model needed).
- Screenshots are **real captures** of the migrated build (never mockups), so they come late in the path by necessity.

## Index
- **Trackers (live):** [[Launch Tracker]] - the master go-live checklist (~70 owned items, P0/P1/P2, status) · [[Brand Propagation]] - every surface still on the old brand · [[Extension GUI Review]]
- Goals: [[Goal 1 - Chrome Web Store Launch]] · [[Goal 2 - Private Mac Client]]
- Departments: [[Project Management]] · [[Brand & Design]] · [[UX]] · [[Release Engineering]] · [[Frontend]] · [[Mac Client]]
- Review: [[Chief of Staff - Critique]] · [[Discovery Briefing]]
