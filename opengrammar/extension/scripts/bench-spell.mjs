/**
 * Spell-suggestion accuracy benchmark — compares the configs that distinguish
 * the two OGrammar engines, across synthetic + real typo corpora, with an
 * optional local-LLM (Ollama) track to quantify the "LLM as source of truth"
 * headroom.
 *
 * Configs (all share Harper for DETECTION; they differ only in how the
 * SUGGESTION is generated + ranked — the real engine difference):
 *   A harper        Harper's own top suggestion        (current DESKTOP default)
 *   B harper+ctx    Harper cands re-ranked by n-gram
 *   C symspell+ctx  SymSpell pool + n-gram             (current EXTENSION default)
 *   D C + tiering   C + edit-distance tiering          (proposed "solution #1")
 *
 * Tracks:
 *   synthetic  single-edit typos generated from the frequency dictionary
 *   norvig     test-data/norvig-testset{1,2}.txt   ("correct: typo typo ...")
 *   wikipedia  test-data/wikipedia-misspellings.txt ("typo->correct" lines)
 *
 * Usage:
 *   node scripts/bench-spell.mjs [synthWords=6000]
 *   OLLAMA_MODEL=qwen2.5:7b LLM_SAMPLE=250 node scripts/bench-spell.mjs 6000
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { LocalLinter } from 'harper.js';
import { binaryInlined } from 'harper.js/binaryInlined';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const SYNTH_WORDS = Number(process.argv[2] || 6000);
const LLM_SAMPLE = Number(process.env.LLM_SAMPLE || 250);
// LLM_TARGETS="ollama:qwen3.5:4b,ollama:qwen2.5:7b,deepseek:deepseek-chat"
const LLM_TARGETS = (process.env.LLM_TARGETS || '').split(',').map((s) => s.trim()).filter(Boolean);

// spellSuggest.ts's loadFreq() uses chrome.runtime.getURL + fetch — stub them so
// the SHIPPED module runs unchanged in Node; delegate all other fetch (Harper
// WASM, Ollama) to the real one.
const realFetch = globalThis.fetch?.bind(globalThis);
globalThis.chrome = { runtime: { getURL: (rel) => join(root, 'public', rel) } };
globalThis.fetch = async (resource, init) => {
  if (typeof resource === 'string' && resource.includes('frequency_dictionary')) {
    return { ok: true, text: async () => readFileSync(resource, 'utf8') };
  }
  if (realFetch) return realFetch(resource, init);
  throw new Error('no fetch available for ' + resource);
};

function loadTs(path) {
  const src = readFileSync(join(root, path), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const { parseModel, rankCandidates, rankSpellCandidates } = await loadTs(
  'src/background/contextRankerCore.ts',
);
const { spellSuggestions, warmSpell } = await loadTs('src/background/spellSuggest.ts');
const raw = readFileSync(join(root, 'public/ngram/model.bin'));
const M = parseModel(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
await warmSpell();

const freq = new Map();
for (const line of readFileSync(
  join(root, 'public/dict/frequency_dictionary_en_82_765.txt'),
  'utf8',
).split('\n')) {
  const t = line.replace(/^﻿/, '').trim();
  if (!t) continue;
  const sp = t.split(/\s+/);
  const n = Number(sp[1]);
  if (sp[0] && Number.isFinite(n)) freq.set(sp[0].toLowerCase(), n);
}

const eq = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();
const hit = (arr, k, expect) => arr.slice(0, k).some((x) => eq(x, expect));

// Solution #1 (proposed): edit-distance TIERING — closest-distance candidates
// first, ties broken WITHIN a tier by the existing context+channel score.
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
function tieredRankSpell(text, off, len, typo, pool) {
  const byDist = new Map();
  for (const c of pool) {
    const d = lev(typo.toLowerCase(), c.toLowerCase());
    if (!byDist.has(d)) byDist.set(d, []);
    byDist.get(d).push(c);
  }
  const out = [];
  for (const d of [...byDist.keys()].sort((a, b) => a - b)) {
    out.push(...rankSpellCandidates(M, text, off, len, typo, byDist.get(d)));
  }
  return out;
}

// ── corpora ──────────────────────────────────────────────────────────────
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
function typosFor(w) {
  const out = [];
  const mid = Math.floor(w.length / 2);
  out.push(w.slice(0, mid) + (w[mid] === 'a' ? 'e' : 'a') + w.slice(mid + 1)); // sub
  if (mid >= 1) out.push(w.slice(0, mid - 1) + w[mid] + w[mid - 1] + w.slice(mid + 1)); // transpose
  out.push(w.slice(0, mid) + w.slice(mid + 1)); // delete
  return [...new Set(out)].filter((t) => t.length >= 3 && t !== w && !freq.has(t));
}
function synthCorpus(nWords) {
  const sources = [...freq.entries()]
    .filter(([w]) => /^[a-z]{4,}$/.test(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, nWords)
    .map(([w]) => w);
  const out = [];
  for (const w of sources) for (const t of typosFor(w)) out.push({ typo: t, expect: w, track: 'synthetic' });
  return out;
}
function parseNorvig() {
  const out = [];
  for (const f of ['norvig-testset1.txt', 'norvig-testset2.txt']) {
    const p = join(root, 'test-data', f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const correct = line.slice(0, i).trim().toLowerCase();
      if (!/^[a-z]+$/.test(correct)) continue;
      for (const typo of line.slice(i + 1).trim().split(/\s+/)) {
        const t = typo.toLowerCase();
        if (t && /^[a-z]+$/.test(t) && t !== correct) out.push({ typo: t, expect: correct, track: 'norvig' });
      }
    }
  }
  return out;
}
function parseWiki() {
  const p = join(root, 'test-data', 'wikipedia-misspellings.txt');
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([a-z][a-z'-]*)->(.+)$/i);
    if (!m) continue;
    const typo = m[1].toLowerCase().trim();
    const correct = m[2].split(',')[0].trim().toLowerCase(); // first correction only
    if (/^[a-z]+$/.test(typo) && /^[a-z]+$/.test(correct) && typo !== correct) {
      out.push({ typo, expect: correct, track: 'wikipedia' });
    }
  }
  return out;
}
function parseSpellErrors() {
  // norvig-spell-errors.txt: "correct: wrong1, wrong2*3, ..." (aggregated from
  // Wikipedia/Birkbeck/Aspell; *N = observed frequency, stripped).
  const p = join(root, 'test-data', 'norvig-spell-errors.txt');
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const correct = line.slice(0, i).trim().toLowerCase();
    if (!/^[a-z]+$/.test(correct)) continue;
    for (let tok of line.slice(i + 1).split(',')) {
      tok = tok.trim().replace(/\*\d+$/, '').trim().toLowerCase();
      if (tok && /^[a-z]+$/.test(tok) && tok !== correct) {
        out.push({ typo: tok, expect: correct, track: 'spell-errors' });
      }
    }
  }
  return out;
}

const linter = new LocalLinter({ binary: binaryInlined });
await linter.setup();

async function evalCase(typo, expect) {
  const lints = await linter.lint(typo, { language: 'plaintext' });
  const lint = lints.find((l) => l.lint_kind() === 'Spelling' && eq(l.get_problem_text(), typo));
  if (!lint) {
    for (const l of lints) l.free();
    return { detected: false };
  }
  const sp = lint.span();
  const off = sp.start;
  const len = sp.end - sp.start;
  sp.free();
  const sgs = lint.suggestions();
  const harper = sgs.map((s) => s.get_replacement_text()).filter((x) => x && !eq(x, typo));
  for (const s of sgs) s.free();
  for (const l of lints) l.free();

  const A = harper;
  const B = rankCandidates(M, typo, off, len, typo, harper.slice());
  const sym = await spellSuggestions(typo);
  let C, D;
  if (sym.length > 0) {
    const pool = sym.slice();
    for (const c of harper) if (!pool.some((x) => eq(x, c))) pool.push(c);
    C = rankSpellCandidates(M, typo, off, len, typo, pool);
    D = tieredRankSpell(typo, off, len, typo, pool);
  } else {
    C = rankCandidates(M, typo, off, len, typo, harper.slice());
    D = tieredRankSpell(typo, off, len, typo, harper.slice());
  }
  return {
    detected: true,
    A1: eq(A[0], expect), A3: hit(A, 3, expect),
    B1: eq(B[0], expect), B3: hit(B, 3, expect),
    C1: eq(C[0], expect), C3: hit(C, 3, expect),
    D1: eq(D[0], expect), D3: hit(D, 3, expect),
  };
}

const MAX_SE = Number(process.env.MAX_SE || 0); // cap spell-errors for quick LLM runs
let se = parseSpellErrors();
if (MAX_SE > 0) se = se.slice(0, MAX_SE);
const tracks = [...synthCorpus(SYNTH_WORDS), ...parseNorvig(), ...se];
const byTrack = new Map();
const blank = () => ({ n: 0, detected: 0, A1: 0, A3: 0, B1: 0, B3: 0, C1: 0, C3: 0, D1: 0, D3: 0 });

const t0 = Date.now();
const evaluated = []; // keep for LLM sampling: {typo, expect, track, C1}
for (const c of tracks) {
  const r = await evalCase(c.typo, c.expect);
  for (const key of [c.track, 'OVERALL']) {
    if (!byTrack.has(key)) byTrack.set(key, blank());
    const a = byTrack.get(key);
    a.n++;
    if (r.detected) {
      a.detected++;
      for (const k of ['A1', 'A3', 'B1', 'B3', 'C1', 'C3', 'D1', 'D3']) if (r[k]) a[k]++;
    }
  }
  if (r.detected) evaluated.push({ ...c, C1: r.C1 });
}
const secs = ((Date.now() - t0) / 1000).toFixed(0);

console.log(`\nSpell-suggestion benchmark  (${tracks.length} cases, ${secs}s)`);
console.log('top-1 / top-3 accuracy over DETECTED cases:');
console.log('  track        n(det)     A harper     B +ctx       C symspell   D +tiering');
for (const t of ['synthetic', 'norvig', 'spell-errors', 'OVERALL']) {
  const a = byTrack.get(t);
  if (!a) continue;
  const p = (x) => (a.detected ? ((100 * x) / a.detected).toFixed(1) : '  -').padStart(5);
  console.log(
    `  ${t.padEnd(11)} ${String(a.detected).padStart(5)}    ` +
      `${p(a.A1)}/${p(a.A3)}  ${p(a.B1)}/${p(a.B3)}  ${p(a.C1)}/${p(a.C3)}  ${p(a.D1)}/${p(a.D3)}`,
  );
}

// ── optional LLM track(s): "ollama:<model>" or "deepseek:<model>" ────────────
// Mirrors the app's real calls: Ollama NATIVE /api/chat with think:false for
// qwen3* thinking tags; DeepSeek via the OpenAI-compatible endpoint (key read
// from ~/.ogrammar-bench/deepseek.key, never entered here).
function readKey(p) { try { return readFileSync(p, 'utf8').trim(); } catch { return ''; } }
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || readKey('/home/zazzn/.ogrammar-bench/deepseek.key');
const LLM_SYS =
  'You are a spelling corrector. Output ONLY the single correctly-spelled English ' +
  'word the user intended — lowercase, no punctuation, no quotes, no explanation.';
const extractWord = (s) =>
  ((s || '').replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '').match(/[a-zA-Z']+/) || [''])[0].toLowerCase();

async function llmCorrect(spec, word) {
  const ci = spec.indexOf(':');
  const provider = spec.slice(0, ci);
  const model = spec.slice(ci + 1);
  const msgs = [{ role: 'system', content: LLM_SYS }, { role: 'user', content: word }];
  try {
    if (provider === 'ollama') {
      const thinking = /\bqwen3\b/i.test(model) && !/instruct/i.test(model);
      const body = { model, messages: msgs, stream: false, options: { temperature: 0, num_ctx: 4096, num_predict: 16 } };
      if (thinking) body.think = false;
      const res = await realFetch('http://localhost:11434/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return extractWord((await res.json()).message?.content);
    }
    if (provider === 'deepseek') {
      if (!DEEPSEEK_KEY) return '';
      const res = await realFetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({ model, messages: msgs, temperature: 0, max_tokens: 16 }),
      });
      return extractWord((await res.json()).choices?.[0]?.message?.content);
    }
  } catch {
    return '';
  }
  return '';
}

if (LLM_TARGETS.length) {
  const step = Math.max(1, Math.floor(evaluated.length / LLM_SAMPLE));
  const sample = [];
  for (let i = 0; i < evaluated.length && sample.length < LLM_SAMPLE; i += step) sample.push(evaluated[i]);
  const cHit = sample.filter((c) => c.C1).length;
  console.log(`\nLLM track — ${sample.length} sampled cases (bare word, no context)`);
  console.log(`  C symspell top-1 on this sample: ${((100 * cHit) / sample.length).toFixed(1)}%`);
  console.log('  target                          top-1    rescue of C-failures   time');
  const rows = [];
  for (const spec of LLM_TARGETS) {
    if (spec.startsWith('deepseek') && !DEEPSEEK_KEY) {
      console.log(`  ${spec.padEnd(30)} (no key — skipped)`);
      continue;
    }
    let llm1 = 0, cWrong = 0, rescued = 0;
    const lt0 = Date.now();
    for (const c of sample) {
      const ok = eq(await llmCorrect(spec, c.typo), c.expect);
      if (ok) llm1++;
      if (!c.C1) { cWrong++; if (ok) rescued++; }
    }
    const r = {
      spec, top1: (100 * llm1) / sample.length,
      rescuePct: cWrong ? (100 * rescued) / cWrong : 0, rescued, cWrong,
      secs: ((Date.now() - lt0) / 1000).toFixed(0),
    };
    rows.push(r);
    console.log(
      `  ${spec.padEnd(30)} ${r.top1.toFixed(1).padStart(5)}%   ` +
        `${rescued}/${cWrong} (${r.rescuePct.toFixed(0)}%)`.padEnd(22) + `  ${r.secs}s`,
    );
  }
  writeFileSync('/tmp/bench-llm.json', JSON.stringify({ sampleN: sample.length, cTop1: (100 * cHit) / sample.length, rows }, null, 2));
}

writeFileSync('/tmp/bench-spell.json', JSON.stringify([...byTrack], null, 2));
console.log('\n(per-track aggregates written to /tmp/bench-spell.json)');
