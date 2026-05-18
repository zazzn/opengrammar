// Builds the compact local n-gram model the inline context re-ranker uses to
// pick the right spelling candidate from Harper's list (e.g. "borwn" →
// "brown" not "born", decided by the neighbours "quick"/"fox").
//
// Source: Peter Norvig's web-scale frequency tables
//   https://norvig.com/ngrams/count_1w.txt  (unigram counts)
//   https://norvig.com/ngrams/count_2w.txt  (bigram counts)
// N-gram *counts are facts* (not copyrightable); dataset is attributed in
// the repo NOTICE. Corpora are cached under .ngram-cache/ so reruns are
// offline. Output: public/ngram/model.bin (committed; regenerate with
// `npm run build:ngram`). NOT run at predev/prebuild — the committed model
// is used directly so normal builds stay offline.
//
// Binary layout (little-endian):
//   magic   : 4 bytes "OGN1"
//   u32 V   : vocab size
//   u32 B   : bigram count
//   vocab   : V × (u8 len, len bytes UTF-8), in id order
//   unigram : Float32[V]  = ln(count / totalUnigram)
//   bigram  : B × (u32 w1, u32 w2, f32 lncond)  sorted by (w1,w2)
//             lncond = ln(count(w1,w2) / count(w1))
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const cacheDir = join(root, '.ngram-cache');
const outDir = join(root, 'public/ngram');
const outFile = join(outDir, 'model.bin');

const SOURCES = {
  uni: 'https://norvig.com/ngrams/count_1w.txt',
  bi: 'https://norvig.com/ngrams/count_2w.txt',
};
const TOP_V = 50000; // vocab cap (top words by unigram count)
const WORD_RE = /^[a-z][a-z'-]*$/;

async function fetchCached(name, url) {
  mkdirSync(cacheDir, { recursive: true });
  const cached = join(cacheDir, name);
  if (existsSync(cached)) {
    console.log(`[ngram] cache hit ${name} (${(statSync(cached).size / 1048576).toFixed(1)} MiB)`);
    return readFileSync(cached, 'utf8');
  }
  console.log(`[ngram] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(cached, text);
  return text;
}

function parseCounts(text, cols) {
  // Lines: "word\tcount" (uni) or "w1 w2\tcount" (bi). w1/w2 split on space.
  const out = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const tab = line.lastIndexOf('\t');
    if (tab < 0) continue;
    const left = line.slice(0, tab);
    const count = Number(line.slice(tab + 1));
    if (!Number.isFinite(count) || count <= 0) continue;
    if (cols === 1) {
      const w = left.toLowerCase();
      if (WORD_RE.test(w)) out.push([w, count]);
    } else {
      const sp = left.indexOf(' ');
      if (sp < 0) continue;
      const w1 = left.slice(0, sp).toLowerCase();
      const w2 = left.slice(sp + 1).toLowerCase();
      if (WORD_RE.test(w1) && WORD_RE.test(w2)) out.push([w1, w2, count]);
    }
  }
  return out;
}

const uniRaw = parseCounts(await fetchCached('count_1w.txt', SOURCES.uni), 1);
const biRaw = parseCounts(await fetchCached('count_2w.txt', SOURCES.bi), 2);

// Merge duplicate-after-lowercasing unigrams, then take top TOP_V by count.
const uniMap = new Map();
for (const [w, c] of uniRaw) uniMap.set(w, (uniMap.get(w) || 0) + c);
const sorted = [...uniMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_V);

const id = new Map();
const vocab = [];
const uniCount = [];
let totalUni = 0;
for (const [w, c] of sorted) {
  id.set(w, vocab.length);
  vocab.push(w);
  uniCount.push(c);
  totalUni += c;
}
const V = vocab.length;

// Keep only bigrams whose both words are in vocab; merge dups.
const biMap = new Map();
for (const [w1, w2, c] of biRaw) {
  const a = id.get(w1);
  const b = id.get(w2);
  if (a === undefined || b === undefined) continue;
  const key = a * V + b;
  biMap.set(key, (biMap.get(key) || 0) + c);
}
const biKeys = [...biMap.keys()].sort((x, y) => x - y);
const B = biKeys.length;

// ── Serialize ──────────────────────────────────────────────────────────────
const enc = new TextEncoder();
const vocabBytes = vocab.map((w) => enc.encode(w));
let vocabLen = 0;
for (const b of vocabBytes) vocabLen += 1 + b.length;

const headerLen = 4 + 4 + 4;
const uniLen = V * 4;
const biLen = B * 12;
const buf = new ArrayBuffer(headerLen + vocabLen + uniLen + biLen);
const dv = new DataView(buf);
const u8 = new Uint8Array(buf);
let o = 0;

u8.set(enc.encode('OGN1'), o);
o += 4;
dv.setUint32(o, V, true);
o += 4;
dv.setUint32(o, B, true);
o += 4;

for (const b of vocabBytes) {
  dv.setUint8(o, b.length);
  o += 1;
  u8.set(b, o);
  o += b.length;
}
for (let i = 0; i < V; i++) {
  dv.setFloat32(o, Math.log(uniCount[i] / totalUni), true);
  o += 4;
}
for (const key of biKeys) {
  const w1 = Math.floor(key / V);
  const w2 = key % V;
  const lncond = Math.log(biMap.get(key) / uniCount[w1]);
  dv.setUint32(o, w1, true);
  o += 4;
  dv.setUint32(o, w2, true);
  o += 4;
  dv.setFloat32(o, lncond, true);
  o += 4;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, u8);
console.log(
  `[ngram] V=${V} B=${B} → ${(statSync(outFile).size / 1048576).toFixed(2)} MiB public/ngram/model.bin`,
);
