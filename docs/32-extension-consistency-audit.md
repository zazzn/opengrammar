# Extension consistency audit (og-rewrite)

Read-only audit of `opengrammar/extension` for inconsistencies — branding, storage
keys/defaults, message protocol, error handling, dead code, extension↔desktop parity,
and duplicated logic. Method: a Codex read-only review of `extension/src` (+ desktop
cross-check) plus targeted greps. **Line numbers are as of this audit — re-verify at
fix time.** Nothing in `extension/src` was modified by this audit.

> **Coordination:** an in-flight thread is adding the ignore-dictionary + self-learning
> feature, which touches `background/index.ts` (`filterIssues`), `content/highlighter.ts`
> (`ignoreIssue`/`addWordToDictionary`), `options/options.tsx`, and `content/autocorrect.ts`.
> Findings in those files are tagged **[dict-overlap]** — fix them in that thread (or
> coordinate) to avoid merge conflicts.

## Quick wins (safe, isolated)
- **`popup/popup.tsx:620`** — duplicate `type="button"` JSX prop → remove the dupe.
- **`background/index.ts:209`** — unknown `request.type` falls through with no response
  (sender hangs) → add a default `sendResponse({ error: 'unknown message type' })`.
- **`background/index.ts:80` (REPHRASE_TEXT), `:159` (GET_MODELS), `:171`
  (GET_OLLAMA_STATUS)** — these `.then(...)` handlers have no `.catch`; a rejected
  promise never calls `sendResponse`, so the sender hangs → wrap each so an error path
  always responds (empty list / unreachable status / error).
- **`options/options.tsx:487`** — settings export filename is `opengrammar-settings-*`
  → `ogrammar-settings-*`. **[dict-overlap]**

## Real bugs needing a decision
- **Default mismatch — autocomplete:** options default ON (`options.tsx:55,109`) but the
  content script treats unset as OFF (`content/index.ts:258`). Pick one default and use
  it everywhere. **[dict-overlap-ish]**
- **Default mismatch — LLM protected masking:** UI says OFF by default
  (`options.tsx:60,115`, `options/index.html:297`) but background initializes unset →
  `true` (`background/index.ts:1113`). Align.
- **Settings "Reset" nukes everything:** `options.tsx:526` clears ALL of
  `chrome.storage.sync` (provider/model/API-key/analytics/dictionary/ignoredIssues), not
  just toggles → reset only known setting keys, or repopulate defaults. **[dict-overlap]**
- **Unbounded analytics in sync storage:** `analyticsSummary.domains` grows without a cap
  (`background/index.ts:1183`) → cap entries or move analytics to `chrome.storage.local`.
- **Type vs storage shape:** `types.ts:148` `AnalyzeRequest.ignoredIssues?: string[]` but
  storage holds `IgnoredIssue[]` objects → fix the type/comment (it's IDs at request time).

## Message protocol (dead / ambiguous)
- `background/index.ts:95` **GET_SELECTION** — handled, never sent → remove or wire.
- `background/index.ts:123` + `content/index.ts:222` **GET_ACTIVE_TEXT** — handled in
  BOTH with different semantics → rename one / document routing.
- `content/index.ts:231` **APPLY_REWRITE** — handled, no sender → remove or wire.
- `background/index.ts:203` **GET_WRITING_HISTORY** — handled, never sent; writing history
  is saved (`:1215`) but no UI reads it → surface the feature or remove the dead path.

## Error handling
- `content/highlighter.ts:1216` — REWRITE_TEXT callback ignores `chrome.runtime.lastError`,
  so a provider/runtime failure shows the misleading "No change suggested." → check
  lastError and show the real error. **[dict-overlap]**
- `content/index.ts:1095` — `syncActiveContext` swallows ALL errors, including extension-
  context invalidation → handle invalidation consistently with the grammar-check path.

## Extension ↔ desktop parity
- **Spell engine default:** desktop is Harper-only (`ograms-engine/harper_engine.rs:52`);
  extension always blends the frequency spell-suggester (`harperEngine.ts:238`) → align
  the default (port the freq suggester to desktop, or document the intentional difference).
- **Autocorrect eligibility:** desktop safe auto-fix allows spelling/typo only
  (`harper_engine.rs:218` / `autocorrect.rs`), extension quick-fix also includes mechanical
  capitalization/punctuation (`issuePolicy.ts:196`). *(Partially narrowed by the #16
  capitalization guard on both sides; the residual is the spelling-vs-mechanical split.)*
- **Protected-text gaps:** desktop protects `host:port` (`protected.rs:202`), extension
  lacks `HOST_PORT_RE` (`protectedText.ts:47`); desktop command regex includes `sudo`
  (`protected.rs:219`), extension's doesn't (`protectedText.ts:63`) → add both to the
  extension for parity.
- **Quick-fix thresholds differ:** `issuePolicy.ts:5` (charOverlap + candidate checks) vs
  `autocorrect.rs:155` (edit-distance ≤ 2) → centralize the policy or add cross-platform
  tests so they can't silently diverge.
- **Learned-rejection storage:** extension syncs autocorrect rejections
  (`content/autocorrect.ts:18`, `chrome.storage.sync`), desktop keeps them local
  (`autocorrect.rs:39`) → decide one privacy/parity model. **[dict-overlap]**

## Duplicated / diverged logic (drift risk)
- **Harness ≠ shipped engine:** `scripts/test-suggestion-corpus.mjs:120` uses only Harper
  candidates + `rankCandidates`, while the shipped `harperEngine.ts:238` uses the
  frequency spell-suggester + `rankSpellByContext`. **The corpus test validates a path the
  product no longer ships.** Highest-value cleanup here: extract a chrome-free
  `harperLintCore` and import it in `fp-harness.mjs` + `test-suggestion-corpus.mjs` instead
  of re-implementing (`:103`/`:31`/`:176` also copy lint config + skip dialect).
- **Cross-language regex dup:** `shared/protectedText.ts:43` and
  `ograms-engine/protected.rs:199` duplicate the protected-text regexes → generate from a
  shared spec, or add a parity test that runs the same corpus through both.

## Shared-constant opportunities
- Default provider/model strings repeated (`background/index.ts:38,39,775`,
  `popup.tsx:471`) → one shared constant.
- LLM / autocomplete / debounce magic numbers (`content/index.ts:54,55,1054,1304`) → named
  shared constants.
- High-confidence / common-spelling override word lists overlap (`issuePolicy.ts:11`,
  `harperEngine.ts:78`) → one shared source.

## Branding residuals (minor; branding is the other thread's lane)
- Code comments only: `popup/popup.tsx:2`, `popup/popup.css:2`, `content/index.ts:416,494`
  still say "OpenGrammar" → rename to OGrammar.
- `options/index.html:361` footer "a fork of OpenGrammar" — likely deliberate upstream
  attribution; confirm intent before changing.
- `shared/protectedText.ts:78` `PROPER_NOUN_RE` lists `OpenGrammar` — keep (protects the
  legacy name harmlessly) unless you want it gone.
- `test-data/suggestion-corpus.json:383` uses "OpenGrammar" as a protected fixture — fine.

## Recommended order
1. Quick wins + the two default mismatches (small, high-signal).
2. Message-protocol cleanup (remove dead handlers; add the unknown-type default).
3. Protected-text parity (`HOST_PORT_RE`, `sudo`) + the type fix.
4. Bigger: extract `harperLintCore` (kills harness drift), centralize quick-fix policy +
   cross-platform parity tests, shared constants.
