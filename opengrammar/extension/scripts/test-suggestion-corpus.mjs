import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { LocalLinter, SuggestionKind } from 'harper.js';
import { binaryInlined } from 'harper.js/binaryInlined';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const corpusPath = join(root, 'test-data/suggestion-corpus.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));

function loadTsModule(path) {
  const source = readFileSync(join(root, path), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const { findProtectedSpans, filterIssuesInProtectedSpans } = await loadTsModule(
  'src/shared/protectedText.ts',
);
const { applyIssuePolicy } = await loadTsModule('src/background/issuePolicy.ts');
const { parseModel, rankCandidates } = await loadTsModule('src/background/contextRankerCore.ts');

const rawModel = readFileSync(join(root, 'public/ngram/model.bin'));
const contextModel = parseModel(
  rawModel.buffer.slice(rawModel.byteOffset, rawModel.byteOffset + rawModel.byteLength),
);

const COMMON_SPELLING_OVERRIDES = {
  adress: 'address',
  hadd: 'had',
  teh: 'the',
};

const STYLE_LINTS_TO_ENABLE = {
  FillerWords: true,
  RepeatedWords: true,
  DiscourseMarkers: true,
  Readability: false,
  LongSentences: false,
  BoringWords: false,
};

function applyCommonSpellingOverride(original, suggestion) {
  const replacement = COMMON_SPELLING_OVERRIDES[original.toLowerCase()];
  if (!replacement) return suggestion;
  if (original.toUpperCase() === original) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function buildCpToUtf16(text) {
  const map = [];
  let u16 = 0;
  for (const ch of text) {
    map.push(u16);
    u16 += ch.length;
  }
  map.push(u16);
  return (cp) => {
    if (cp <= 0) return 0;
    if (cp >= map.length) return u16;
    return map[cp];
  };
}

function mapType(kind) {
  const k = kind.toLowerCase();
  if (k.includes('spell') || k.includes('typo') || k.includes('eggcorn') || k.includes('malapropism')) {
    return 'spelling';
  }
  if (
    k.includes('capital') ||
    k.includes('punctuation') ||
    k.includes('grammar') ||
    k.includes('agreement') ||
    k.includes('boundary') ||
    k.includes('number') ||
    k.includes('regional')
  ) {
    return 'grammar';
  }
  if (k.includes('read') || k.includes('clarity') || k.includes('repetition')) {
    return 'clarity';
  }
  return 'style';
}

async function lintLikeExtension(linter, text) {
  const lints = await linter.lint(text, { language: 'plaintext' });
  const cpToU16 = buildCpToUtf16(text);
  const issues = [];

  for (const lint of lints) {
    try {
      if (lint.suggestion_count() === 0) continue;
      const span = lint.span();
      const start = cpToU16(span.start);
      const end = cpToU16(span.end);
      span.free();
      if (end <= start) continue;

      const original = text.slice(start, end);
      const type = mapType(lint.lint_kind());
      const suggestions = lint.suggestions();
      const rawSuggestions = suggestions.map((s) => ({
        kind: s.kind(),
        text: s.get_replacement_text(),
      }));
      for (const suggestion of suggestions) suggestion.free();
      if (rawSuggestions.length === 0) continue;

      let replacement = '';
      let reason = lint.message();
      if (type === 'spelling') {
        const candidates = rawSuggestions
          .filter((s) => s.kind === SuggestionKind.Replace)
          .map((s) => s.text)
          .filter((s) => s && s !== original);
        if (candidates.length === 0) continue;
        const ranked = rankCandidates(contextModel, text, start, end - start, original, candidates);
        replacement = ranked[0];
        const alternatives = ranked.slice(1);
        if (alternatives.length > 0) {
          reason = `${reason} Other suggestions: ${alternatives.join(', ')}.`;
        }
      } else {
        const first = rawSuggestions[0];
        if (first.kind === SuggestionKind.Remove) replacement = '';
        else if (first.kind === SuggestionKind.InsertAfter) replacement = original + first.text;
        else replacement = first.text;
      }

      replacement = applyCommonSpellingOverride(original, replacement);
      if (replacement === original) continue;

      issues.push({
        type,
        original,
        suggestion: replacement,
        reason,
        offset: start,
        length: end - start,
        source: 'rule',
        confidence: 0.95,
      });
    } finally {
      lint.free();
    }
  }

  return applyIssuePolicy(filterIssuesInProtectedSpans(issues, findProtectedSpans(text)));
}

function spanCovers(spans, text, fragment) {
  const start = text.indexOf(fragment);
  if (start < 0) return false;
  const end = start + fragment.length;
  return spans.some((span) => start >= span.start && end <= span.end);
}

function findIssue(issues, expected) {
  return issues.find((issue) => {
    if (issue.original !== expected.original) return false;
    if (expected.suggestion !== undefined && issue.suggestion !== expected.suggestion) return false;
    if (expected.route !== undefined && issue.route !== expected.route) return false;
    return true;
  });
}

const linter = new LocalLinter({ binary: binaryInlined });
await linter.setup();
const lintConfig = await linter.getLintConfig();
await linter.setLintConfig({ ...lintConfig, ...STYLE_LINTS_TO_ENABLE });

const results = [];
const byBucket = new Map();

function record(test, check, ok, detail = '') {
  const known = test.status === 'known-gap';
  const status = ok ? 'pass' : known ? 'gap' : 'fail';
  results.push({ id: test.id, category: test.category, bucket: test.bucket, check, status, detail });
  const bucket = test.bucket || 'uncategorized';
  const summary = byBucket.get(bucket) || { pass: 0, gap: 0, fail: 0 };
  summary[status] += 1;
  byBucket.set(bucket, summary);
}

for (const test of corpus) {
  const protectedSpans = findProtectedSpans(test.text);

  for (const fragment of test.protected || []) {
    record(
      test,
      `protected:${fragment}`,
      spanCovers(protectedSpans, test.text, fragment),
      'fragment must be covered by one protected span',
    );
  }

  if (test.manual) {
    record(test, 'manual', true, 'manual browser test case recorded');
    continue;
  }

  const needsLint =
    test.expectNoLocalIssues || (Array.isArray(test.localIssues) && test.localIssues.length > 0);
  if (!needsLint) continue;

  const issues = await lintLikeExtension(linter, test.text);

  if (test.expectNoLocalIssues) {
    record(
      test,
      'local:no-issues',
      issues.length === 0,
      issues.map((i) => `${i.route}:${i.original}->${i.suggestion}`).join(' | '),
    );
  }

  for (const expected of test.localIssues || []) {
    record(
      test,
      `local:${expected.original}`,
      Boolean(findIssue(issues, expected)),
      issues.map((i) => `${i.route}:${i.original}->${i.suggestion}`).join(' | '),
    );
  }
}

const pass = results.filter((r) => r.status === 'pass').length;
const gaps = results.filter((r) => r.status === 'gap');
const fails = results.filter((r) => r.status === 'fail');

console.log(`Suggestion corpus: ${corpus.length} cases, ${results.length} checks`);
console.log(`Pass: ${pass}  Known gaps: ${gaps.length}  Failures: ${fails.length}`);
console.log('');
console.log('Bucket summary');
for (const [bucket, summary] of [...byBucket.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(
    `  ${bucket.padEnd(28)} pass=${String(summary.pass).padStart(2)} gap=${String(summary.gap).padStart(2)} fail=${String(summary.fail).padStart(2)}`,
  );
}

if (gaps.length > 0) {
  console.log('\nKnown gaps');
  for (const gap of gaps) {
    console.log(`  ${gap.id} [${gap.check}] ${gap.detail ? `- ${gap.detail}` : ''}`);
  }
}

if (fails.length > 0) {
  console.log('\nFailures');
  for (const fail of fails) {
    console.log(`  ${fail.id} [${fail.check}] ${fail.detail ? `- ${fail.detail}` : ''}`);
  }
}

process.exit(fails.length > 0 ? 1 : 0);
