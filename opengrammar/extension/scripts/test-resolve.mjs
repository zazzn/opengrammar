// Focused unit test for resolveInString — the matcher behind sentence-rewrite apply.
// Reproduces the "Couldn't apply here — text changed" case: a long sentence whose live
// editor text differs from the analyzed text by smart quotes, a wrapped newline, and a
// double space, with a DRIFTED offset. Must still resolve (was returning null).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
function loadTs(p) {
  const js = ts.transpileModule(readFileSync(join(root, p), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { resolveInString } = await loadTs('src/content/textMap.ts');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

// The analyzed sentence (straight quotes) as the LLM returned it.
const original =
  "Hello, I'm having an issue, I left to sleep the othernight and came back to find my Codex was maxed on its usage, however, there shouldn't have been any tasks running.";

// The LIVE editor text: prefixed (so offset 0 is wrong/drifted), smart-quoted, with a
// hard newline where it wrapped and a double space — exactly what broke the exact match.
const live =
  "Earlier note here.\n\nHello, I’m having an issue, I left to sleep the\nothernight and came back to find my Codex was maxed on its  usage, however, there shouldn’t have been any tasks running.";

// 1) Drifted offset (0) + smart quotes + newline + double space → must resolve.
const r1 = resolveInString(live, 0, original.length, original);
check('hard case resolves (not null)', !!r1, JSON.stringify(r1));
if (r1) {
  const got = live.slice(r1.start, r1.end);
  check('span starts at the live "Hello"', got.startsWith('Hello'), JSON.stringify(got.slice(0, 20)));
  check('span ends at the live "running."', got.trimEnd().endsWith('running.'), JSON.stringify(got.slice(-20)));
}

// 2) Exact match still works unchanged (no regression).
const exact = 'go to the othernight okay';
const r2 = resolveInString(exact, exact.indexOf('othernight'), 'othernight'.length, 'othernight');
check('exact short match unchanged', r2 && exact.slice(r2.start, r2.end) === 'othernight', JSON.stringify(r2));

// 3) A genuinely absent original returns null (no false match).
const r3 = resolveInString('totally different content here', 0, 20, 'this string is not present at all');
check('absent original → null', r3 === null, JSON.stringify(r3));

console.log(`\nresolveInString: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
