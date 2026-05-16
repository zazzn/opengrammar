/**
 * Back-test harness. Runs a corpus of error-laden + clean sentences through
 * the running /analyze endpoint and reports:
 *   - detections per case (type · original → suggestion)
 *   - NO-OP issues (suggestion == original after normalize)  [must be 0]
 *   - false positives on clean sentences                     [want ~0]
 *   - misses on sentences that clearly contain an error
 *
 * Usage:  node simulate.mjs            (defaults to http://localhost:8787)
 *         BACKEND=http://host:port node simulate.mjs
 */
const BASE = process.env.BACKEND || 'http://localhost:8787';

function norm(s) {
  return (s || '')
    .normalize('NFC')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// shouldFlag: true = we expect >=1 issue; false = clean (false-positive probe)
const CORPUS = [
  // --- the reported case: missing comma, otherwise identical ---
  { t: "I like them but it's not that bad actually which is why I like them.", flag: true, note: 'missing comma before "which"' },
  { t: 'I bought new pads and they work great which is why I recommend them.', flag: true, note: 'comma before nonrestrictive clause' },
  // --- spelling ---
  { t: 'I havn\'t tested the brakes yet.', flag: true, note: 'havn\'t' },
  { t: 'Please recomend a good brake pad.', flag: true, note: 'recomend' },
  { t: 'The calipers were definately seized.', flag: true, note: 'definately' },
  { t: 'I recieved the package yesterday.', flag: true, note: 'recieved' },
  { t: 'Teh rotors are warped.', flag: true, note: 'teh' },
  // --- contractions / apostrophes ---
  { t: 'I dont know which pad is best.', flag: true, note: 'dont' },
  { t: 'Its going to need new rotors.', flag: true, note: "Its -> It's" },
  { t: 'You should of replaced them sooner.', flag: true, note: 'should of' },
  // --- homophones / confused words (context) ---
  { t: 'I dont no which one to buy.', flag: true, note: 'no -> know' },
  { t: 'Their going to the track tomorrow.', flag: true, note: 'Their -> They\'re' },
  { t: 'The brakes are over they\'re by the bench.', flag: true, note: "they're -> there" },
  // --- subject-verb agreement ---
  { t: 'The brake pads is worn out.', flag: true, note: 'pads is -> pads are' },
  { t: 'He drive to the shop every day.', flag: true, note: 'He drive -> drives' },
  // --- tense ---
  { t: 'Yesterday I go to the parts store.', flag: true, note: 'go -> went' },
  // --- capitalization ---
  { t: 'i think the stoptechs are better.', flag: true, note: 'i -> I' },
  { t: 'the rotors are fine.', flag: true, note: 'sentence start cap' },
  // --- double word / run-on ---
  { t: 'The the pads are new.', flag: true, note: 'doubled "the"' },
  { t: 'I went to the shop I bought new pads it was great.', flag: true, note: 'run-on' },
  // --- a/an ---
  { t: 'I need a new brake kit and a oil filter.', flag: true, note: 'a -> an oil' },
  // --- CLEAN sentences (false-positive probes — expect 0 issues) ---
  { t: 'I replaced the brake pads last weekend and they work great.', flag: false },
  { t: "The StopTech rotors are excellent; I'd recommend them to anyone.", flag: false },
  { t: 'Dogs run quickly when they are excited.', flag: false },
  { t: 'She has tested several brake pads on her car.', flag: false },
  { t: "It's a well-known fact that ceramic pads produce less dust.", flag: false },
  { t: 'The cars were parked outside the garage overnight.', flag: false },
];

async function analyze(text) {
  const r = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', rst: '\x1b[0m', cyn: '\x1b[36m' };

(async () => {
  let noops = 0, fp = 0, misses = 0, totalIssues = 0;
  console.log(`\nBack-test against ${BASE}  (${CORPUS.length} cases)\n${'='.repeat(64)}`);
  for (const c of CORPUS) {
    let data;
    try { data = await analyze(c.t); } catch (e) { console.log(`${C.red}ERR${C.rst} ${c.t} :: ${e.message}`); continue; }
    const issues = data.issues || [];
    totalIssues += issues.length;
    const caseNoops = issues.filter((i) => i.type !== 'spelling' && norm(i.original) === norm(i.suggestion));
    noops += caseNoops.length;

    const tag = c.flag
      ? (issues.length ? `${C.grn}DETECT${C.rst}` : `${C.red}MISS  ${C.rst}`)
      : (issues.length ? `${C.yel}FP    ${C.rst}` : `${C.grn}CLEAN ${C.rst}`);
    if (c.flag && !issues.length) misses++;
    if (!c.flag && issues.length) fp++;

    console.log(`${tag} ${C.dim}${c.note ? '(' + c.note + ')' : ''}${C.rst}`);
    console.log(`   ${C.cyn}"${c.t}"${C.rst}`);
    for (const i of issues) {
      const bad = i.type !== 'spelling' && norm(i.original) === norm(i.suggestion);
      console.log(
        `     - ${i.type}: ${JSON.stringify(i.original)} -> ${JSON.stringify(i.suggestion)}` +
          (bad ? ` ${C.red}<<< NO-OP${C.rst}` : ''),
      );
    }
  }
  console.log(`${'='.repeat(64)}`);
  console.log(`Total issues: ${totalIssues}`);
  console.log(`${noops === 0 ? C.grn : C.red}No-op suggestions: ${noops}${C.rst}  (target 0 — the reported bug)`);
  console.log(`${fp === 0 ? C.grn : C.yel}False positives on clean text: ${fp}${C.rst}`);
  console.log(`${C.dim}Misses on error sentences: ${misses} (rule-only; many need the LLM)${C.rst}\n`);
  process.exit(noops > 0 ? 1 : 0);
})();
