# OGrammar Inline Detection Engine — False-Positive Audit & Improvement Report

Last updated: 2026-05-31

This report is the result of a structured false-positive audit of the OGrammar
inline (Harper) detection engine on the `og-rewrite` branch. Every empirical
claim below was reproduced through the **shipped** inline pipeline; the handful
of static-only findings (LLM-correction path, content-script labeling) cite
exact `file:line`.

It is a companion to:

- [22-og-rewrite-ai-handoff.md](22-og-rewrite-ai-handoff.md) — project handoff.
- [23-suggestion-testing-run.md](23-suggestion-testing-run.md) — the first
  suggestion/ignore testing pass and the `npm run test:suggestions` assertion
  harness (68 cases). New regression cases proposed here are meant to **extend**
  that suite.

---

## 1. Executive Summary

The engine has one dominant, cross-cutting failure mode:

> **Any reasonably-spelled out-of-vocabulary token is routed to the destructive
> one-click "quick-fix" route at confidence 0.96/0.94 and silently rewritten to
> a semantically unrelated real word.**

This hits exactly the vocabulary that legitimately appears in real prose but is
absent from Harper's American dictionary: proper nouns, brand/product names,
technical jargon, clinical terminology, non-US-dialect spellings, place names,
and chat slang.

The root cause is concentrated in a **single function** —
`issuePolicy.ts` `isHighConfidenceSpelling()` (lines 57–84) — whose quick-fix
gate is purely a function of **edit distance and token length** (accept branches
at lines 80–82), with no semantic-overlap, proper-noun, candidate-count, or
plausibility signal. Confirmed corruptions, all routed to **quick-fix @0.96**:

| Register | Example quick-fix corruption (all @0.96) |
|---|---|
| Technical / dev | `kubelet→sublet`, `fsync→franc`, `serde→serve`, `autoscaler→automaker`, `kubectl→subject`, `systemctl→system's` |
| Automotive | `Miata→Math` |
| Names / brands / places | `Niamh→Name`, `Aoife→Abide`, `Okafor→Orator`, `Supabase→Separate`, `Nginx→Nine`, `Galway→Gala` |
| Science / medical | `homozygous→homologous`, `creatinine→creatine`, `Methicillin→Penicillin`, `mannitol→magneto` |
| Casual chat | `soooo→scoop`, `finna→finny`, `Siobhan→Sideman` |
| Mixed / boundary | `Caddyfile→Caddie`, `Procfile→Profile`, `Brewfile→Refile` |

**Second cluster — dialect.** `harperEngine.ts:62` hardcodes `Dialect.American`
with no user setting, so `-our/-ise/-re/-ence/-lling` spellings and regionalisms
are flagged; **~83% of clean British/AU/CA prose (29 of 35 sample sentences)** is
flagged and most ships to quick-fix at 0.96, silently Americanizing correct text
for the entire non-US user base. Words with no clean US suffix-swap produce
absurd suggestions (`cheque→cheese`, `programme→programmer`). A user-configurable
dialect setting removes the cluster wholesale with **zero real-error coverage
loss** (verified — see §3).

**Third cluster — LLM `correctText()` over-suppression.** The safety gates in
`background/index.ts` are so conservative they silently **drop correct, safe
fixes**: single-word typo corrections (`Helo→Hello`) are categorically rejected
by a positional token-ratio, and a verbatim protected-fragment veto discards the
whole correction when the misspelled token is itself protected (`fucntion_call`,
`exmaple.com`). The content script then mislabels these as "the model did not
find a confident correction."

**Biggest wins, in order:**

1. Add semantic-overlap + proper-noun + ambiguity guards to
   `isHighConfidenceSpelling` — fixes ~20 of the highest-severity findings at once.
2. Make Harper dialect configurable — eliminates the entire dialect FP cluster.
3. Relax the LLM `correctText()` gates — restores dropped correct fixes.
4. Drop Harper space-insertion splits and disable `BoringWords` — quiet the
   sentence-review card.

**Scale of the audit:** 12 work-streams (8 domain corpora + 4 component audits),
each finding adversarially re-verified, **65 confirmed findings** kept after
verification: **23 high / 29 medium / 13 low**. By component: harper 23,
issuePolicy 19, protectedText 10, llmCorrection 7, contextRanker 5,
contentEntry 1. By category: false-positive 23, bad-suggestion 18, misroute 8,
false-negative 8, over-protection 4, under-protection 3, ux 1.

---

## 2. How this was produced (methodology)

### 2.1 New exploratory harness — `scripts/fp-harness.mjs`

The existing regression scripts (`simulate:inline`, `simulate:protected`) and the
`test:suggestions` assertion suite test pieces of the pipeline. To hunt for
*unknown* false positives we needed an **exploratory** harness: feed it any text,
get back exactly what the user would see.

`extension/scripts/fp-harness.mjs` runs the full shipped inline path —
`Harper lint + context re-ranker → protected-span filter → issue-policy routing` —
loading the real shipped modules (`protectedText.ts`, `issuePolicy.ts`,
`contextRankerCore.ts`) and the committed n-gram model; the Harper step is a
faithful port of `harperEngine.ts`. It emits JSON per input
(`{ text, skippedAsNonProse, protectedSpans, issues:[{type,original,suggestion,route,routeReason,confidence,...}] }`),
where `issues` is exactly the post-protected-filter, post-routing set the user
sees.

```bash
cd extension
node scripts/fp-harness.mjs scripts/.fp-corpora/<name>.json   # JSON array of strings / {text,note,expect}
node scripts/fp-harness.mjs --text "some sentence"
```

### 2.2 The agent fleet

A 3-phase workflow of 25 agents:

- **Find & Test (12 agents).** 8 domain corpus testers (technical-dev,
  casual-chat, automotive-forum, names/brands/places, business-email,
  science/medical, dialect/regional, mixed-protected-boundary) each generated a
  realistic 35–55-sentence corpus (≈70% clean to measure the FP rate, ≈30% with
  genuine errors to confirm catching) and ran it through the harness. 4 component
  auditors targeted `protectedText` regexes, `issuePolicy` thresholds,
  `contextRanker` + style-lint config, and the LLM correction safety gates.
- **Verify (12 agents, pipelined).** Each finder's findings were handed to an
  adversarial verifier that re-created the inputs, **re-ran the harness**, and
  rejected anything not reproducible, contrived, or "fixable" only by a change
  that would regress real-error coverage. Only `isReal=true` findings were kept.
- **Synthesize (1 agent).** Consolidated the verified findings into the themes,
  roadmap, and recommendations below.

### 2.3 Maintainer-side verification

Before publishing, the highest-impact P0 claims were re-run by hand (§3). All
reproduced exactly.

### 2.4 New artifacts left in the tree

- `extension/scripts/fp-harness.mjs` — the exploratory harness (keep).
- `extension/scripts/.fp-corpora/*.json` — the agent-generated corpora and
  maintainer spot-check inputs (raw evidence; useful as future fixtures).

> **Maintainability note (a finding in itself).** There are now **two**
> hand-replicated copies of `harperLint`'s logic — `scripts/test-suggestion-corpus.mjs`
> and `scripts/fp-harness.mjs` — neither of which imports the real
> `harperEngine.ts` (it depends on `chrome.runtime`). They can silently drift:
> the `test-suggestion-corpus.mjs` copy already carries a `teh→the`
> `COMMON_SPELLING_OVERRIDES` entry that is **not** present in the current
> `harperEngine.ts` (`{ adress: 'address' }` only), despite
> [23-suggestion-testing-run.md](23-suggestion-testing-run.md) stating it was
> added there. **Recommendation:** extract the chrome-free core of
> `harperLint()` into a pure module (mirroring how `contextRankerCore.ts` was
> split out) so both harnesses and the extension share one source of truth.

---

## 3. Verification evidence (re-run by hand)

**Quick-fix corruptions — `node scripts/fp-harness.mjs` (American default):**

```
> The kubelet writes to fsync and serde.
   - spelling 'kubelet'    -> 'sublet'      [quick-fix @0.96]
   - spelling 'fsync'      -> 'franc'       [quick-fix @0.96]
   - spelling 'serde'      -> 'serve'       [quick-fix @0.96]
> He dropped an LS3 into the Miata ...
   - spelling 'Miata'      -> 'Math'        [quick-fix @0.96]
> Niamh and Aoife are flying in from Dublin ...
   - spelling 'Niamh'      -> 'Name'        [quick-fix @0.96]
   - spelling 'Aoife'      -> 'Abide'       [quick-fix @0.96]
> Our account manager, Jane Okafor, will reach out.
   - spelling 'Okafor'     -> 'Orator'      [quick-fix @0.96]
> Supabase handles auth and Kubernetes ...
   - spelling 'Supabase'   -> 'Separate'    [quick-fix @0.96]
> Patients homozygous for the marker ...
   - spelling 'homozygous' -> 'homologous'  [quick-fix @0.96]
> The Caddyfile and the Procfile both need edits.
   - spelling 'Caddyfile'  -> 'Caddie'      [quick-fix @0.96]
   - spelling 'Procfile'   -> 'Profile'     [quick-fix @0.96]
> I ran kubectl get pods.
   - spelling 'kubectl'    -> 'subject'     [quick-fix @0.96]
> The inflamation resolved after antibiotics.
   - spelling 'inflamation'-> 'information' [quick-fix @0.96]   (correct 'inflammation' demoted to "Other suggestions")
> I recieved the package and definately liked it.
   - spelling 'recieved'   -> 'received'    [quick-fix @0.96]   (genuine typo — correct)
   - spelling 'definately' -> 'definitely'  [quick-fix @0.96]   (genuine typo — correct)
```

**Dialect — same sentences under American vs British (`LocalLinter` dialect swap):**

```
[US] 1 lint:  ["behaviour"]               <= His behaviour at the party ...
[US] 2 lints: ["organise","centre"]       <= We need to organise the meeting at the shopping centre.
[US] 1 lint:  ["licence"]                 <= You need a licence to drive a lorry.
[US] 1 lint:  ["cheque"]                  <= I will post the cheque to you tomorrow.
[US] 3 lints: ["colour","programme","grey"] <= The colour of the programme was grey.
--- same sentences under British ---
[GB] 0 lints  (all five sentences)
--- genuine typos under British (must still flag) ---
[GB] ["recieved","goverment","completly"] <= I recieved the goverment notice ...
[GB] ["definately","adress"]              <= This is definately the wrong adress.
```

This is the proof behind the P0 dialect recommendation: switching dialect
eliminates the entire dialect FP cluster **with zero real-error coverage loss**.

---

## 4. Headline metrics

- **Quick-fix (destructive) FPs:** confirmed across all 7 registers; ~20 P0
  findings of the highest-harm class (proper-noun/jargon → unrelated real word
  @0.96). Single root cause: `issuePolicy.ts:80–82`.
- **Dialect FP rate:** **29 / 35 = 83%** of clean non-US sentences flagged, all
  quick-fix @0.96. Under `Dialect.British`: **0** dialect lints, **all 6**
  genuine typos still caught. `Dialect` appears **once** in the entire `src` tree.
- **LLM `correctText()` false-negatives:** 9 distinct gate failures; single-word
  fixes **always** rejected (positional ratio 1.0 > maxRatio). Plus 3 admit-paths
  for meaning-changing edits and 1 content-script mislabel.
- **Harper space-insertion split FPs:** 13+ confirmed, **all non-destructive**
  (sentence-review @0.55) — noise, not corruption.
- **Context-ranker wrong-word quick-fixes:** 4 confirmed (`borwn→born`,
  `inflamation→information`, `mergd→merge`, `reviewd→review`).
- **Style noise (`BoringWords`):** `very→too`, `several→various`,
  `interesting→attractive` on clean prose @0.5.
- **False negatives (out of local scope):** `tests is` agreement, `its/it's`
  before a gerund, homophones (`than/then`, `to/too`, `grate/great`, `peddle/pedal`).

---

## 5. Themes (grouped by root cause)

### T1 — Quick-fix gate is distance/length only (P0, effort: medium) · ~20 findings
`isHighConfidenceSpelling()` (issuePolicy.ts:57–84) accepts a quick-fix when:

```
(transposition && len>=5)                      // line 80
|| (distance<=2 && len>=5)                      // line 81
|| (distance<=3 && len>=7 && optionCount<=3)    // line 82
```

There is **no character-overlap check, no proper-noun (initial-cap) demotion,
and no ambiguity/margin gate.** The separation is clean and verified: jargon /
proper-noun FPs cluster at LCS-overlap **0.60–0.80**, while every `len>=5`
genuine typo is **≥0.833** — so an overlap floor cleanly separates them.

### T2 — Hardcoded `Dialect.American` (P0, effort: low) · 5 findings
`harperEngine.ts:62` is the sole dialect reference in `src`. Most flagged
dialect words route to quick-fix and silently Americanize correct text. Words
with no simple US swap produce absurd suggestions (`cheque→cheese`,
`programme→programmer`) — a genuine bad-suggestion **regardless** of dialect
(even a US user who typed `cheque` deserves `check`, never `cheese`).

### T3 — LLM `correctText()` gates drop correct fixes (P0, effort: medium) · 9 findings
`background/index.ts`:
- `tokenChangeRatio` (286–306) is **positional**: returns 1.0 for any single-word
  change (so `Helo→Hello`, `definately→definitely` are always rejected) and
  mis-scores contractions (`dont→don't`).
- `maxRatio` 0.65 for ≤8 words rejects dense-but-correct short fixes
  (`i dont no wat u mean` = 0.667).
- `preservesProtectedFragments` (227–232) requires verbatim
  `candidate.includes(fragment)` for fragments drawn from the **original**; when
  the misspelled token is itself protected (`fucntion_call`, `exmaple.com`,
  `API_KYE`), the corrected token can never match, so the **entire** correction
  is discarded.
- The `corrections.every(low)` veto (319–320) and the model's own
  `protectedSpansPreserved:false` boolean (324–327) each fully veto
  locally-verified-correct fixes.
- `highlighter.ts` then renders "the model did not find a confident
  sentence-level correction" — a mislabel. *(static-only; `harnessConfirmed=false`)*

There are also three **admit-paths** for meaning-changing edits: non-JSON raw
output admitted verbatim (`running→restarting`, index.ts:313), and
`corrections:[]` bypassing the low-confidence gate (`can→should`). Close these
**as part of** relaxing the over-suppression, so net legitimate coverage rises
while unsupported rewrites are blocked.

### T4 — Harper space-insertion splits & garbage neighbours (P1, effort: low) · 8 findings
Single-candidate `Typo` lints whose only suggestion inserts a space —
`goroutines→"go routines"`, `downpipe→"down pipe"`, `overexpressed→"over expressed"` —
plus degenerate fragments (`poping→"p oping"`, `dosent→"do sent"`) and
possessive/substring garbage (`Anticoagulation→"Anticoagulant's"`,
`fetoprotein→"protein"`). These correctly **avoid quick-fix** (suggestion
contains a space ⇒ `isPlainWord` false at issuePolicy.ts:61) and route to
sentence-review @0.55, but they are noise on clean prose and feed the LLM card a
wrong premise.

### T5 — Protected spans over- and under-protect (P1, effort: medium) · 8 findings
- **Over-protection (hides real typos):** `COMMAND_RE` (protectedText.ts:51)
  greedy `[^\n`<>]*` tail swallows the whole sentence after `Run/Try` + tool name
  (`Try ollama run llama3.1 and see if the modle loads` hides `modle`).
  `DOMAIN_RE` (:38) protects any `word.word` with no TLD whitelist
  (`etc.somthing` hides `somthing`). `CODE_TOKEN_RE` (:65) over-broad digit/camel
  alternatives protect `recieveD`, `userNme`.
- **Under-protection (leaks to quick-fix):** bare CLI names (`kubectl`,
  `systemctl`) and `*file` config names (`Caddyfile`, `Procfile`, `Brewfile`) are
  absent from the allowlists, leak to Harper, and quick-fix to nonsense @0.96.
  `PROPER_NOUN_RE` (:63) is a tiny static literal missing
  `Supabase/Nginx/Fastly/Galway/Anaïs`.

### T6 — Context re-ranker picks the wrong candidate, then quick-fixes it (P1, effort: medium) · 4 findings
`rankCandidates` + the `MARGIN=2.0` override gate (contextRankerCore.ts:25; gate
204–210) keep/pick the wrong candidate, which `issuePolicy` quick-fixes @0.96
with no ambiguity check:
- `borwn→born` — the true anagram `brown` loses by the 2.0-nat gate.
- `inflamation→information` — the re-ranker **demotes** the correct distance-1
  `inflammation`.
- `mergd→merge` (should be `merged`), `reviewd→review` (should be `reviewed`).

### T7 — Style opt-ins & kind-mapping mis-grades (P2, effort: low) · 6 findings
`BoringWords:true` (harperEngine.ts:29–35) flags neutral vocabulary with
meaning-changing swaps (`very→too`, `several→various`) on clean prose @0.5.
`mapType` mis-routes by kind: `WordChoice` (`should of→should have`) falls
through to `style`@0.5 instead of `grammar`; `Repetition` (`the the`) maps to
`clarity`/sentence-review when an exact duplicate-word deletion is the most
mechanical possible quick-fix. `friday→Friday` arrives as `type=spelling`,
bypassing the case-only path, with bogus `fray/friar` alternates.

### T8 — Harper WASM coverage gaps (P2, effort: high — out of local scope) · 3 findings
Genuine in-scope errors Harper never emits: subject-verb agreement `tests is`,
possessive `its/it's` before a gerund, and contextual homophones
(`than/then`, `to/too`). Any local compensating rule must be **high-precision** —
a naive `its <participle>` regex false-positives on legitimate possessives, and a
plural-noun `+ is` rule must exempt mass/collective nouns (`the data is`).

---

## 6. Prioritized roadmap

### P0 — User-visible wrong fixes (do first)
1. **`isHighConfidenceSpelling` guards** (T1) — LCS-overlap ≥0.82 OR true
   transposition/anagram; demote initial-cap non-case-only tokens; ambiguity gate
   for equal-distance multi-candidate cases. *File: `issuePolicy.ts`.*
2. **Configurable dialect** (T2) — read from settings, options-page dropdown.
   *File: `harperEngine.ts:62`.*
3. **Relax `correctText()` gates** (T3) — char-level diff instead of positional
   ratio; per-fragment protected veto; drop the `protectedSpansPreserved`
   self-veto; soften all-low to a low-confidence show. *File: `index.ts`.*

### P1 — High-impact noise / hidden errors
4. **Drop space-insertion & low-quality Harper suggestions** (T4). *`harperEngine.ts`.*
5. **Close `correctText()` admit-paths** (T3) — suppress on parse failure and
   `corrections:[]` unsupported diffs. *`index.ts`.*
6. **Bound `COMMAND_RE` + add bare-CLI allowlist** (T5). *`protectedText.ts`.*
7. **Generalize `*file` protection; tighten `CODE_TOKEN_RE`/`DOMAIN_RE`** (T5).
   *`protectedText.ts`.*
8. **Anagram-aware adaptive MARGIN tie-break** (T6). *`contextRankerCore.ts`
   (+ ambiguity gate in `issuePolicy.ts`).*

### P2 — Polish
9. **Disable `BoringWords`; fix `mapType` (WordChoice→grammar, Repetition
   quick-fix); fix spelling-path case framing** (T7). *`harperEngine.ts`,
   `issuePolicy.ts`.*
10. **Curate slang/abbreviation + elongation protection** (narrow, non-English
    tokens only) (T1/T5). *`protectedText.ts`.*

### Backlog (out of local scope)
11. **Harper coverage gaps** (T8) — track upstream; any local rule must be
    high-precision.

---

## 7. Detailed recommendations (change / risk / regression test)

### R1 — Semantic-overlap + proper-noun + ambiguity guards (P0)
**Change** (`issuePolicy.ts`, before lines 80–82): (a) require LCS/character-
overlap ≥~0.82 OR a true transposition/anagram; (b) if `original` matches
`/^[A-Z][a-z]+$/` AND `bare(original)!==bare(suggestion)`, return false;
(c) when `optionCount>1` and the top two in-vocab candidates are within 1 edit,
return false. Keep lowercase transposition/distance typos on quick-fix.
**Risk:** a few low-overlap lowercase typos could demote to sentence-review
(still surfaced, just non-destructive). Overlap floor (0.82) sits below every
verified real typo and above every verified jargon FP.
**Regression test:** `quickfix-guard.json` —
`kubelet/fsync/serde/Miata/Niamh/Okafor/Supabase/homozygous/mergd` →
`sentence-review`; `recieved/definately/deploymnet/freind` → `quick-fix`.

### R2 — Configurable dialect (P0)
**Change** (`harperEngine.ts:62`): replace `Dialect.American` with a
settings-driven value; add an options-page dropdown
(American/British/Australian/Canadian/Indian). Default may stay American.
**Risk:** very low; only settings plumbing. Verified British config = 0 dialect
lints, all genuine typos still caught (§3).
**Regression test:** run the dialect corpus under British
(`colour/organise/centre/behaviour/lorry` → 0; `recieved/goverment` → flagged);
add a `dialect` param to `fp-harness.mjs` so this is reproducible.

### R3 — Relax `correctText()` conservatism (P0)
**Change** (`index.ts`): char-level edit distance for density (handles
contractions); exempt/scale very short inputs; per-fragment protected veto keyed
on structural punctuation (`/.@:#`); remove `parsed.protectedSpansPreserved` from
the safe AND; soften all-low to `shouldShow:true` + low-confidence flag.
**Risk:** medium — pair with R4 cross-check; char-level distance still bounds
total change. Controls verified (correctly-spelled `API_KEY` still
preserved/shown; full rewrite still rejected).
**Regression test:** `Helo→Hello`, `definately→definitely`,
`i dont no wat u mean→…`, `The fucntion_call failed.→…function_call…`,
`Visit teh exmaple.com page.→…the example.com…` all `shouldShow:true`.

### R4 — Close `correctText()` admit-paths (P1)
**Change** (`index.ts`): on parse failure (313) return
`{corrected:text, shouldShow:false}`; require `correctedText`'s diff to be
explained by `corrections[]` (suppress unsupported reworded edits).
**Risk:** low. Pairs with R3.
**Regression test:** non-JSON `server is restarting` for `…running.` →
`shouldShow:false`; `we should ship` with `corrections:[]` for `we can ship` →
`shouldShow:false`.

### R5 — Drop space-insertion & low-quality Harper suggestions (P1)
**Change** (`harperEngine.harperLint`): drop
`suggestion.replace(/\s+/g,'')===original`; drop append-`'s`-to-unrelated-stem
and `>3`-leading-char-substring candidates.
**Risk:** low — real fixes never have these identity properties. Verify
`alot→a lot` (BoundaryError, not Typo) unaffected. Note `comedo` (6 chars) needs
a non-length signal.
**Regression test:** `harper-splits.json` —
`goroutines/downpipe/valvetrain/overexpressed` → 0; `poping`/`dosent` → no
garbage split; `alot` → still flagged.

### R6 — Bound `COMMAND_RE` + bare-CLI allowlist (P1)
**Change** (`protectedText.ts:51`): bound non-npm tool tails like the npm branch
and/or stop at sentence connectors; add a prefix-independent CLI-binary list
(`kubectl, systemctl, npx, docker, terraform, ansible, psql, redis-cli`).
**Risk:** medium — keep npm-style bounding. Verify
`Run npm run build before you deploy to prod` protects only `npm run build`.
**Regression test:** `simulate-protected` —
`Try ollama run llama3.1 and see if the modle loads` → span ends at `llama3.1`,
`modle` flagged; `I ran kubectl get pods` → `kubectl` protected.

### R7 — Generalize `*file`; tighten `CODE_TOKEN_RE`/`DOMAIN_RE` (P1)
**Change** (`protectedText.ts`): `SPECIAL_FILE_RE:46` → add
`/\b[A-Z][A-Za-z]*file\b/`; `CODE_TOKEN_RE:65` → require ≥2 digits or a true
lower→Upper→lower transition, reject single trailing/leading digit or single
trailing capital; `DOMAIN_RE:38` → require a known TLD/path/port.
**Risk:** medium — could re-expose some identifiers. Validate each un-protected
example surfaces a **correct** fix before shipping (keep `mp3recieved` protected
— Harper has no good fix there).
**Regression test:** `Caddyfile/Procfile/Brewfile` flagged-then-protected
(Dockerfile still protected, `profile` untouched); `He recieveD the package.` →
`received`; `etc.somthing` → `something`.

### R8 — Anagram-aware adaptive MARGIN (P1)
**Change** (`contextRankerCore.ts`): adaptive MARGIN (full 2.0 only for
non-anagram challengers, ~0 for the unique anagram that already wins context);
decisive anagram channel reward; forbid demoting a strictly-closer-edit-distance
candidate. Plus the R1 ambiguity gate for equal-distance multi-candidate cases.
**Risk:** medium — re-ranker changes ripple. Verified `She was borwn in May`
keeps `born` by ~7.6 nats (unaffected). Validate against the full fp-corpora set.
**Regression test:** `audit-contextRanker` —
`the leaves turned borwn in autumn→brown`, `the borwn dog ran→brown`,
`inflamation resolved→inflammation`, `was mergd into main→merged`; control
`She was borwn in May→born`.

### R9 — Disable `BoringWords`; fix kind-mapping (P2)
**Change** (`harperEngine.ts` / `issuePolicy.ts`): remove `BoringWords` from
`STYLE_LINTS_TO_ENABLE:30`; add `WordChoice→grammar` to `mapType`; add a
determiner-only exact-duplicate quick-fix branch; on the spelling path, when
`bare(original)===bare(suggestion)` treat as soft capitalization and strip bogus
alternates.
**Risk:** low. Keep repetition quick-fix determiner-only (`that that` can be
grammatical).
**Regression test:** `very happy`/`several improvements`/`very interesting` → 0;
`should of gone` → grammar; `the the store` → quick-fix; `finally friday` →
Friday without `fray/friar`.

### R10 — Curate slang/abbreviation + elongation protection (P2)
**Change** (`protectedText.ts` `CHAT_SLANG_RE:61`): add non-English tokens
(`finna, periodt, lowkey, deadass, imma, ima, ight, gn, wyd`) and lowercase
standalone `u`/`ur`; add elongation guard
`/\b[A-Za-z]*([A-Za-z])\1{2,}[A-Za-z]*\b/` + defensive `/(.)\1{2,}/` short-circuit
in `isHighConfidenceSpelling`. Do **not** add ambiguous English words
(`cap, mid, bet, sus, fam`) or bare single letters.
**Risk:** low if the list stays non-English-only and elongation requires a 3× run.
**Regression test:** `finna/periodt/lowkey/deadass/imma/u/ur` → protected;
`soooo/yesss/sooooo` → protected; `definately/recieved` → still flagged.

---

## 8. Proposed regression corpus lines

These extend the existing `npm run test:suggestions` suite
([23-suggestion-testing-run.md](23-suggestion-testing-run.md)) and the
`simulate:*` scripts. Where a case needs the dialect param, add it to
`fp-harness.mjs` first (R2).

**`quickfix-guard` (expect `sentence-review`, NOT quick-fix):**
- `The kubelet writes to fsync and serde.`
- `We recieved a 502 right after the autoscaler kicked in.` (`recieved`→quick-fix; `autoscaler`→review)
- `He dropped an LS3 into the Miata and it sounds insane.`
- `Niamh and Aoife are flying in from Dublin on Friday.`
- `Our account manager, Jane Okafor, will reach out.`
- `Supabase handles auth and Kubernetes orchestrates the workers.`
- `Patients homozygous for the marker showed disease.`
- **REGRESSION:** `I recieved the package and definately liked it.` → both still quick-fix @0.96.

**`dialect` (run with `dialect=British` ⇒ 0 issues):**
- `His behaviour at the party was completely out of order.` / `We need to organise the meeting.` / `The shopping centre opened.` / `You need a licence to drive a lorry.`
- **REGRESSION (British):** `I recieved the goverment notice and it was completly wrong.` → still flagged.
- **(American):** `I'll post the cheque to you first thing tomorrow.` → `cheque` NOT → `cheese` (after R1 overlap guard).

**`harper-splits` (expect 0 issues):**
- `…two goroutines write to the same channel.` / `a catless downpipe` / `valvetrain issues` / `The tumour overexpressed HER2.`
- `The intercooler piping keeps poping off under boost.` → no `p oping`.
- **REGRESSION:** `I have alot of work.` → `a lot` still flagged.

**`style-noise`:**
- `I am very happy with the results…` / `…we implemented several process improvements.` → 0 after `BoringWords` off.
- `I should of gone home earlier that night.` → `should have` route grammar.
- `We need to to finalize the agenda.` → `to` quick-fix (duplicate deletion).

**`simulate-protected.mjs`:**
- `Try ollama run llama3.1 and see if the modle loads correctly.` → command span ends at `llama3.1`; `modle` flagged.
- **REGRESSION:** `Run npm run build before you deploy to prod.` → only `npm run build` protected.
- `I ran kubectl get pods and saw the the crash loop.` → `kubectl` protected.
- `The Caddyfile and the Procfile both need edits.` → both protected; `Dockerfile` still protected, `profile` untouched.
- `He recieveD the package.` → `received` surfaces; `We met at etc.somthing yesterday.` → `something` surfaces; `The mp3recieved was corrupt.` → keep protected.

**`simulate-inline.mjs` (casual):**
- `soooo tired today omg` / `yesss finally friday` / `finna pull up in 5` / `periodt that's the whole point` / `u up? wanna grab food rn` → 0 quick-fix issues.

**LLM `correctText()` harness (build a new gated harness, or unit-test the pure functions):**
- `Helo.→Hello.`, `i dont no wat u mean→I don't know what you mean.`,
  `The fucntion_call failed.→The function_call failed.`,
  `Visit teh exmaple.com page.→Visit the example.com page.` → all `shouldShow:true`.
- **REGRESSION:** non-JSON raw `server is restarting` for `…server is running.` →
  `shouldShow:false`; reworded `we should ship it` with `corrections:[]` for
  `we can ship it` → `shouldShow:false`.

---

## 9. Appendix — verified root-cause index (file:line)

| Cluster | File:line | Symbol |
|---|---|---|
| Quick-fix gate | `issuePolicy.ts:80–82` | `isHighConfidenceSpelling` accept branches |
| Short-word pre-empt | `issuePolicy.ts:72` | `LOW_CONTEXT_SHORT_WORD_MAX` returns false before contraction branch (74) |
| Case-only path | `issuePolicy.ts:99–100` | `isPunctuationOrCaseOnly` consulted only on grammar path |
| Dialect | `harperEngine.ts:62` | `new LocalLinter({ dialect: Dialect.American })` |
| BoringWords | `harperEngine.ts:29–35` | `STYLE_LINTS_TO_ENABLE` |
| kind mapping | `harperEngine.ts:116–144` | `mapType` (no WordChoice→grammar; Repetition→clarity) |
| LLM density | `index.ts:286–306` | `tokenChangeRatio` / `isConservativeCorrection` |
| LLM protected veto | `index.ts:227–232` | `preservesProtectedFragments` |
| LLM self-veto | `index.ts:319–327` | all-low + `protectedSpansPreserved` |
| LLM admit-path | `index.ts:313` | raw fallback on parse failure |
| Content mislabel | `highlighter.ts` | ignores `resp.shouldShow`/`resp.corrections` |
| COMMAND_RE tail | `protectedText.ts:51` | greedy non-npm `[^\n`<>]*` |
| DOMAIN_RE | `protectedText.ts:38` | no TLD whitelist |
| CODE_TOKEN_RE | `protectedText.ts:65` | over-broad digit/camel alternatives |
| SPECIAL_FILE_RE | `protectedText.ts:46` | literal `*file` list |
| PROPER_NOUN_RE | `protectedText.ts:63` | static literal allowlist |
| CHAT_SLANG_RE | `protectedText.ts:61` | fixed slang list |
| Context MARGIN | `contextRankerCore.ts:25`, gate `204–210` | `MARGIN=2.0` override gate |

---

## 10. Suggested execution order

1. **R1 + R2 together** (one PR): the two changes that remove the most
   user-visible harm. Land the `quickfix-guard` and `dialect` corpora first so the
   PR is test-driven.
2. **R3 + R4 together**: relax the LLM gates *and* close the admit-paths in the
   same change so net correctness only improves.
3. **R5, R6, R7, R8**: protected-span + ranker cleanups, each behind its own
   corpus.
4. **R9, R10**: polish.
5. **Refactor**: extract a chrome-free `harperLintCore` so `fp-harness.mjs` and
   `test-suggestion-corpus.mjs` stop re-implementing it (see §2.4).

After R1/R2 the expected effect is the elimination of essentially all
destructive quick-fix corruptions on proper nouns, jargon, and non-US spellings —
the single biggest perceived-quality problem in the current engine.
