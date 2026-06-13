// One-off parity probe: run the EXTENSION's shipped C pipeline (Harper + SymSpell
// pool + n-gram re-rank) on a single sentence and print the ranked suggestions,
// so we can diff against the Rust engine CLI for the same input.
//   node scripts/parity-one.mjs "<sentence>" "<typo>"
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { LocalLinter } from 'harper.js';
import { binaryInlined } from 'harper.js/binaryInlined';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const realFetch = globalThis.fetch?.bind(globalThis);
globalThis.chrome = { runtime: { getURL: (rel) => join(root, 'public', rel) } };
globalThis.fetch = async (res, init) => {
  if (typeof res === 'string' && res.includes('frequency_dictionary')) {
    return { ok: true, text: async () => readFileSync(res, 'utf8') };
  }
  return realFetch(res, init);
};
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

const sentence = process.argv[2] || 'A 1975 clas ring from Robert E Lee High School';
const typo = process.argv[3] || 'clas';
const linter = new LocalLinter({ binary: binaryInlined });
await linter.setup();
const lints = await linter.lint(sentence, { language: 'plaintext' });
const lint = lints.find((l) => eq(l.get_problem_text(), typo));
if (!lint) {
  console.log('no lint for', typo, '— kinds:', lints.map((l) => `${l.lint_kind()}:${l.get_problem_text()}`).join(' | '));
  process.exit(0);
}
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
console.log('sentence  :', sentence);
console.log('lint_kind :', lint.lint_kind());
console.log('harper    :', harper.join(', '));
console.log('symspell  :', sym.slice(0, 12).join(', '));
console.log('C ranked  :', C.slice(0, 13).join(', '));
console.log('C top-1   :', C[0]);
