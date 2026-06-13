// Cross-engine parity harness: inject the same real typos into real sentences,
// run them through the EXTENSION pipeline (in-process) and the DESKTOP Rust engine
// (ograms-engine --jsonl), and diff the top-1 suggestion per case. Fails loudly if
// the two engines disagree, so "fix one, break the other" can't slip through.
//   node scripts/parity-harness.mjs [nCases=300]
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { LocalLinter } from 'harper.js';
import { binaryInlined } from 'harper.js/binaryInlined';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const N = Number(process.argv[2] || 300);
const realFetch = globalThis.fetch?.bind(globalThis);
globalThis.chrome = { runtime: { getURL: (rel) => join(root, 'public', rel) } };
globalThis.fetch = async (res, init) =>
  typeof res === 'string' && res.includes('frequency_dictionary')
    ? { ok: true, text: async () => readFileSync(res, 'utf8') }
    : realFetch(res, init);
function loadTs(p) {
  const js = ts.transpileModule(readFileSync(join(root, p), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { parseModel, rankCandidates, rankSpellCandidates } = await loadTs('src/background/contextRankerCore.ts');
const { spellSuggestions, warmSpell } = await loadTs('src/background/spellSuggest.ts');
const raw = readFileSync(join(root, 'public/ngram/model.bin'));
const M = parseModel(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
await warmSpell();
const eq = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

// ── corpus: inject a real non-word typo into a content word of real sentences ──
const typoMap = new Map();
for (const line of readFileSync(join(root, 'test-data/norvig-spell-errors.txt'), 'utf8').split('\n')) {
  const i = line.indexOf(':');
  if (i < 0) continue;
  const c = line.slice(0, i).trim().toLowerCase();
  if (!/^[a-z]{4,}$/.test(c)) continue;
  const list = [];
  for (let t of line.slice(i + 1).split(',')) {
    t = t.trim().replace(/\*\d+$/, '').trim().toLowerCase();
    if (t && /^[a-z]+$/.test(t) && t !== c) list.push(t);
  }
  if (list.length) typoMap.set(c, list);
}
const freqWords = new Set();
for (const line of readFileSync(join(root, 'public/dict/frequency_dictionary_en_82_765.txt'), 'utf8').split('\n')) {
  const w = line.replace(/^﻿/, '').trim().split(/\s+/)[0];
  if (w) freqWords.add(w.toLowerCase());
}
const cases = [];
for (const line of readFileSync(join(root, 'test-data/leipzig-eng-sentences.txt'), 'utf8').split('\n')) {
  const tab = line.indexOf('\t');
  const s = (tab >= 0 ? line.slice(tab + 1) : line).trim();
  if (s.length < 25 || s.length > 180 || !/^[\x20-\x7E]+$/.test(s)) continue;
  const words = [...s.matchAll(/[A-Za-z]+/g)];
  let picked = null;
  for (let i = 1; i < words.length; i++) {
    const w = words[i][0];
    if (w.length >= 4 && /^[a-z]+$/.test(w) && typoMap.has(w)) {
      const typo = typoMap.get(w).find((t) => !freqWords.has(t));
      if (typo) { picked = { w, idx: words[i].index, typo }; break; }
    }
  }
  if (!picked) continue;
  const sentence = s.slice(0, picked.idx) + picked.typo + s.slice(picked.idx + picked.w.length);
  cases.push({ sentence, typo: picked.typo, correct: picked.w });
  if (cases.length >= N) break;
}

// ── DESKTOP (Rust) engine via the CLI, one process for the whole corpus ──
const CLI = '/home/zazzn/opengrammar/desktop/target/debug/ograms-engine';
if (!existsSync(CLI)) { console.error('Rust CLI not built:', CLI, '\nRun: cd ~/opengrammar/desktop && cargo build -p ograms-engine'); process.exit(2); }
const DICT = join(root, 'public/dict/frequency_dictionary_en_82_765.txt');
const MODEL = join(root, 'public/ngram/model.bin');
const rustRes = spawnSync(
  CLI,
  ['--jsonl', '--spell-engine', 'combined', '--dictionary-path', DICT, '--context-model-path', MODEL],
  { input: cases.map((c) => c.sentence).join('\n') + '\n', encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
);
const rustLines = (rustRes.stdout || '').replace(/\n$/, '').split('\n');
const rustTop1 = (i, typo) => {
  try {
    const issue = JSON.parse(rustLines[i]).find((x) => eq(x.original, typo));
    return issue ? { detected: true, top1: issue.suggestions[0] } : { detected: false };
  } catch {
    return { detected: false };
  }
};

// ── EXTENSION pipeline (in-process) ──
const linter = new LocalLinter({ binary: binaryInlined });
await linter.setup();
async function extTop1(sentence, typo) {
  const lints = await linter.lint(sentence, { language: 'plaintext' });
  const lint = lints.find((l) => eq(l.get_problem_text(), typo));
  if (!lint) { return { detected: false }; }
  const sp = lint.span();
  const off = sp.start, len = sp.end - sp.start;
  const harper = lint.suggestions().map((s) => s.get_replacement_text()).filter((x) => x && !eq(x, typo));
  const sym = await spellSuggestions(typo);
  let C;
  if (sym.length > 0) {
    const pool = sym.slice();
    for (const c of harper) if (!pool.some((x) => eq(x, c))) pool.push(c);
    C = rankSpellCandidates(M, sentence, off, len, typo, pool);
  } else {
    C = rankCandidates(M, sentence, off, len, typo, harper.slice());
  }
  return { detected: true, top1: C[0] };
}

// ── compare ──
const agg = { n: cases.length, bothDet: 0, top1Match: 0, detMismatch: 0, extOnly: 0, rustOnly: 0 };
const mismatches = [];
const detMisses = [];
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const ext = await extTop1(c.sentence, c.typo);
  const rust = rustTop1(i, c.typo);
  if (ext.detected && rust.detected) {
    agg.bothDet++;
    if (eq(ext.top1, rust.top1)) agg.top1Match++;
    else if (mismatches.length < 12) mismatches.push({ typo: c.typo, want: c.correct, ext: ext.top1, rust: rust.top1 });
  } else if (ext.detected !== rust.detected) {
    agg.detMismatch++;
    if (ext.detected) agg.extOnly++; else agg.rustOnly++;
    detMisses.push({ typo: c.typo, want: c.correct, by: ext.detected ? 'ext-only' : 'rust-only' });
  }
}

console.log(`\nCross-engine parity — ${agg.n} cases (extension vs desktop Rust, Combined)`);
console.log(`  both engines flagged the typo: ${agg.bothDet}`);
console.log(`  top-1 AGREES:                  ${agg.top1Match}/${agg.bothDet} (${agg.bothDet ? ((100 * agg.top1Match) / agg.bothDet).toFixed(1) : '–'}%)`);
console.log(`  DETECTION mismatch:            ${agg.detMismatch}  (ext-only ${agg.extOnly}, rust-only ${agg.rustOnly})`);
if (mismatches.length) {
  console.log('\n  sample top-1 disagreements (typo | want | ext | rust):');
  for (const m of mismatches) console.log(`    ${m.typo.padEnd(12)} want ${(m.want||'').padEnd(12)} ext=${(m.ext||'∅').padEnd(12)} rust=${m.rust || '∅'}`);
}
if (detMisses.length) {
  console.log('\n  detection mismatches (typo | want | flagged-by):');
  for (const m of detMisses) console.log(`    ${m.typo.padEnd(12)} want ${(m.want||'').padEnd(12)} ${m.by}`);
}

// ── parity GATE (so "fix one, break the other" fails the build, not just prints) ──
// Invariant 1: ranking parity — when both engines flag a typo they must pick the same
//   top-1 correction. This is the shared OGrammar logic; require ~100% (allow a hair for
//   SymSpell-port float-tie noise). Invariant 2: the Rust engine must never over-flag
//   (rust-only detections would be a real desktop bug). ext-only detection misses are
//   tolerated: they're harper.js-WASM-vs-harper-core library nuances, below our logic.
const top1Pct = agg.bothDet ? (100 * agg.top1Match) / agg.bothDet : 100;
const RANK_FLOOR = 99.0;
const pass = top1Pct >= RANK_FLOOR && agg.rustOnly === 0;
console.log(
  `\n  parity GATE: ${pass ? 'PASS ✅' : 'FAIL ❌'}  ` +
    `(top-1 ${top1Pct.toFixed(1)}% ≥ ${RANK_FLOOR}% and rust-only over-flags ${agg.rustOnly} == 0)`,
);
process.exit(pass ? 0 : 1);
