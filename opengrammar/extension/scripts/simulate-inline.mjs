/**
 * Inline-engine regression harness for the Harper + local context re-ranker.
 * Runs the SAME shipped logic
 * (src/background/contextRankerCore.ts) against the SAME committed model
 * (public/ngram/model.bin) with real Harper, so it can't drift from what the
 * extension actually does. No server needed.
 *
 * Usage:  node scripts/simulate-inline.mjs       (or: npm run simulate:inline)
 * Exit:   non-zero if any case regresses.
 *
 * Case shape: { t, typo, expect, note }
 *   - find the Spelling lint whose problem text == `typo`
 *   - run it through the context re-ranker → assert the picked fix == `expect`
 *   - `clean: true` cases assert Harper raises NO spelling lint at all
 *   - `known: true` documents a real limitation (bigram-model ceiling,
 *     Harper-dictionary gap). Printed as KNOWN, NOT a build failure — the
 *     net locks in what works without hiding or over-fitting weak spots.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { LocalLinter } from 'harper.js';
import { binaryInlined } from 'harper.js/binaryInlined';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const coreSource = readFileSync(join(root, 'src/background/contextRankerCore.ts'), 'utf8');
const coreJs = ts.transpileModule(coreSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { parseModel, rankCandidates } = await import(
  `data:text/javascript;base64,${Buffer.from(coreJs).toString('base64')}`
);
const raw = readFileSync(join(root, 'public/ngram/model.bin'));
const M = parseModel(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));

const CORPUS = [
  // ── the reported defect: transposition decided by context ──────────────
  { t: 'the quick borwn fox jumps', typo: 'borwn', expect: 'brown', note: 'strong context' },
  { t: 'I have a borwn dog', typo: 'borwn', expect: 'brown', note: 'weak context + transposition reward' },
  { t: 'she was borwn in May', typo: 'borwn', expect: 'born', note: 'context must prefer "born"' },
  { t: 'he was borwn and raised here', typo: 'borwn', expect: 'born', note: '"born and raised"' },
  // ── must-not-regress: Harper already correct, ranker must abstain ───────
  { t: 'i dont know which one', typo: 'dont', expect: "don't", note: 'OOV incumbent → trust Harper' },
  { t: 'we recieved the package', typo: 'recieved', expect: 'received', note: 'Harper #1 kept' },
  { t: 'please fix the gramar', typo: 'gramar', expect: 'grammar', note: 'Harper #1 kept' },
  { t: 'this is definately wrong', typo: 'definately', expect: 'definitely', note: 'Harper #1 kept' },
  // ── KNOWN limitations (documented, non-failing) ────────────────────────
  {
    t: 'the leaves turned borwn in autumn',
    typo: 'borwn',
    expect: 'brown',
    known: true,
    note: 'bigram ceiling: "born in" (7.7M) swamps left "turned brown"; needs trigrams/bigger corpus',
  },
  {
    t: 'i havnt tested it yet',
    typo: 'havnt',
    expect: "haven't",
    known: true,
    note: 'Harper offers no "haven\'t" for "havnt"; better cands (hadn\'t/hasn\'t) are apostrophe-OOV',
  },
  // ── clean false-positive probes (no spelling lint expected) ────────────
  { t: 'The quick brown fox jumps over the lazy dog.', clean: true },
  { t: 'She was born in May and raised in Ohio.', clean: true },
  { t: 'We received the package yesterday afternoon.', clean: true },
];

const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', rst: '\x1b[0m', cyn: '\x1b[36m' };

const linter = new LocalLinter({ binary: binaryInlined });
await linter.setup();

let fails = 0;
let fps = 0;
let knownBad = 0;
console.log(`\nInline-engine back-test (Harper + context ranker, model V=${M.V})  (${CORPUS.length} cases)\n${'='.repeat(72)}`);

for (const c of CORPUS) {
  const lints = await linter.lint(c.t, { language: 'plaintext' });
  const spellings = lints.filter((l) => l.lint_kind() === 'Spelling');

  if (c.clean) {
    const bad = spellings.map((l) => l.get_problem_text());
    if (bad.length === 0) {
      console.log(`${C.grn}CLEAN ${C.rst} ${C.cyn}"${c.t}"${C.rst}`);
    } else {
      fps++;
      console.log(`${C.yel}FP    ${C.rst} ${C.cyn}"${c.t}"${C.rst}  ${C.red}spelling on: ${bad.join(', ')}${C.rst}`);
    }
    continue;
  }

  const lint = spellings.find(
    (l) => l.get_problem_text().toLowerCase() === c.typo.toLowerCase(),
  );
  if (!lint) {
    fails++;
    console.log(`${C.red}NO-LINT${C.rst} expected Harper to flag "${c.typo}"  ${C.cyn}"${c.t}"${C.rst}`);
    continue;
  }
  const sp = lint.span();
  const orig = lint.get_problem_text();
  const cands = lint
    .suggestions()
    .map((s) => s.get_replacement_text())
    .filter((tx) => tx && tx !== orig);
  const pick = rankCandidates(M, c.t, sp.start, sp.end - sp.start, orig, cands)[0];

  const ok = pick === c.expect;
  let tag;
  if (c.known) {
    if (!ok) knownBad++;
    tag = ok ? `${C.grn}KNOWN-OK${C.rst}` : `${C.yel}KNOWN   ${C.rst}`;
  } else {
    if (!ok) fails++;
    tag = ok ? `${C.grn}PASS${C.rst}    ` : `${C.red}FAIL${C.rst}    `;
  }
  console.log(
    `${tag} "${orig}" -> "${pick}" ${ok || c.known ? '' : `${C.red}(expected "${c.expect}")${C.rst}`} ` +
      `${C.dim}[harper: ${cands.join(', ')}] (${c.note})${C.rst}`,
  );
  console.log(`   ${C.cyn}"${c.t}"${C.rst}`);
}

console.log(`${'='.repeat(72)}`);
console.log(`${fails === 0 ? C.grn : C.red}Enforced failures: ${fails}${C.rst}  ${fps ? `${C.yel}False positives: ${fps}${C.rst}` : `${C.grn}False positives: 0${C.rst}`}  ${C.dim}Known-limitation cases still bad: ${knownBad}${C.rst}`);
process.exit(fails > 0 || fps > 0 ? 1 : 0);
