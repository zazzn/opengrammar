// Headless test for the ported sentence-start capitalization detector
// (src/shared/sentenceCaps.ts). Loads the TS via the same ts.transpileModule +
// data-URL pattern as scripts/parity-harness.mjs. The module is `import type`-only
// (no runtime imports), so it loads with no chrome/DOM/fetch shims.
//   node scripts/test-caps.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
function loadTs(p) {
  const js = ts.transpileModule(readFileSync(join(root, p), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const { findSentenceCapitalizations } = await loadTs('src/shared/sentenceCaps.ts');

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Helper: does the result flag the lowercase letter at `offset`?
function flagsAt(text, offset) {
  return findSentenceCapitalizations(text).some((i) => i.offset === offset);
}
// Helper: does it flag a lowercase start whose uppercased letter begins `word`?
function flagsWord(text, offset, original, suggestion) {
  return findSentenceCapitalizations(text).some(
    (i) => i.offset === offset && i.original === original && i.suggestion === suggestion,
  );
}

// 1) "i went home. it was late." → flags the "i" of "it" (offset 13).
{
  const text = 'i went home. it was late.';
  // offset 13 is the "i" in "it" ("i went home. " is 13 chars).
  check('case1: flags "i" of "it" at offset 13', flagsWord(text, 13, 'i', 'I'), JSON.stringify(findSentenceCapitalizations(text)));
}

// 2) "see e.g. this thing. another sentence here." → NOT "this"; DOES "another".
{
  const text = 'see e.g. this thing. another sentence here.';
  const thisOffset = text.indexOf('this');
  const anotherOffset = text.indexOf('another');
  check('case2: does NOT flag "this" after e.g.', !flagsAt(text, thisOffset), JSON.stringify(findSentenceCapitalizations(text)));
  check('case2: DOES flag "another"', flagsWord(text, anotherOffset, 'a', 'A'), JSON.stringify(findSentenceCapitalizations(text)));
}

// 3) "3.14 is pi. done now." → NOT inside "3.14"; flags "done".
{
  const text = '3.14 is pi. done now.';
  const issues = findSentenceCapitalizations(text);
  // No issue should land inside the "3.14" span [0,4).
  check('case3: does NOT flag inside "3.14"', !issues.some((i) => i.offset >= 0 && i.offset < 4), JSON.stringify(issues));
  const doneOffset = text.indexOf('done');
  check('case3: flags "done"', flagsWord(text, doneOffset, 'd', 'D'), JSON.stringify(issues));
}

console.log(`\nsentenceCaps: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
