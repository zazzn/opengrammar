#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const engineRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(engineRoot, '..', '..');
const extensionRoot = path.join(workspaceRoot, 'opengrammar', 'extension');

const args = parseArgs(process.argv.slice(2));
const binary = path.resolve(engineRoot, args.binary ?? 'target/release/ograms-engine');
const spellEngine = args.spellEngine ?? 'harper';
const dictionaryPath =
  args.dictionaryPath ?? path.join(extensionRoot, 'public/dict/frequency_dictionary_en_82_765.txt');
const contextModelPath = args.contextModelPath ?? path.join(extensionRoot, 'public/ngram/model.bin');

if (!args.skipBuild && !existsSync(binary)) {
  runOrExit('cargo', ['build', '--release'], { cwd: engineRoot });
}

if (!existsSync(binary)) {
  fail(`Engine binary not found: ${binary}`);
}

const cases = loadCases();
const results = [];
const summary = {
  total: cases.length,
  judged: 0,
  matches: 0,
  regressions: 0,
  improvements: 0,
  falsePositives: 0,
  exploratory: 0,
  engineFailures: 0,
};

for (const testCase of cases) {
  const run = runEngine(testCase.text);
  if (run.error) {
    summary.engineFailures++;
    results.push({ ...testCase, status: 'ENGINE_FAILURE', detail: run.error });
    continue;
  }

  const verdicts = judge(testCase, run.issues);
  for (const verdict of verdicts) {
    results.push({ ...testCase, issues: run.issues, ...verdict });
    if (verdict.status === 'EXPLORATORY') {
      summary.exploratory++;
      continue;
    }
    summary.judged++;
    if (verdict.status === 'MATCH') summary.matches++;
    if (verdict.status === 'REGRESSION') summary.regressions++;
    if (verdict.status === 'IMPROVEMENT') summary.improvements++;
    if (verdict.status === 'FALSE_POSITIVE') summary.falsePositives++;
  }
}

printSummary(summary, results);
if (args.json) {
  process.stdout.write(
    JSON.stringify({ spellEngine, binary, dictionaryPath, contextModelPath, summary, results }, null, 2) + '\n',
  );
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--skip-build') parsed.skipBuild = true;
    else if (arg === '--json') parsed.json = true;
    else if (arg === '--no-protect') parsed.noProtect = true;
    else if (arg === '--binary') parsed.binary = argv[++i];
    else if (arg.startsWith('--binary=')) parsed.binary = arg.slice('--binary='.length);
    else if (arg === '--spell-engine') parsed.spellEngine = argv[++i];
    else if (arg.startsWith('--spell-engine=')) parsed.spellEngine = arg.slice('--spell-engine='.length);
    else if (arg === '--dictionary-path') parsed.dictionaryPath = argv[++i];
    else if (arg.startsWith('--dictionary-path=')) parsed.dictionaryPath = arg.slice('--dictionary-path='.length);
    else if (arg === '--context-model-path') parsed.contextModelPath = argv[++i];
    else if (arg.startsWith('--context-model-path=')) parsed.contextModelPath = arg.slice('--context-model-path='.length);
    else if (arg === '--help' || arg === '-h') usage();
    else fail(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function usage() {
  console.log(`Usage:
  node scripts/parity-check.mjs [--spell-engine harper|symspell|combined] [--skip-build] [--json]
  node scripts/parity-check.mjs --binary target/debug/ograms-engine --spell-engine combined

The harness reads extension/test-data/suggestion-corpus.json and extension/scripts/.fp-corpora/*.json,
then pipes each sentence to the native engine and compares JSON issues against corpus expectations.`);
  process.exit(0);
}

function loadCases() {
  const out = [];
  const suggestionPath = path.join(extensionRoot, 'test-data/suggestion-corpus.json');
  const suggestionCorpus = JSON.parse(readFileSync(suggestionPath, 'utf8'));
  suggestionCorpus.forEach((item, index) => {
    out.push(normalizeCase(item, `suggestion-corpus:${index}`, 'suggestion-corpus.json'));
  });

  const fpDir = path.join(extensionRoot, 'scripts/.fp-corpora');
  for (const file of readdirSync(fpDir).filter((name) => name.endsWith('.json')).sort()) {
    const data = JSON.parse(readFileSync(path.join(fpDir, file), 'utf8'));
    if (!Array.isArray(data)) continue;
    data.forEach((item, index) => {
      out.push(normalizeCase(item, `${file}:${index}`, file));
    });
  }
  return out.flatMap((item) => expandCase(item));
}

function normalizeCase(item, fallbackId, source) {
  const raw = typeof item === 'string' ? { text: item } : item;
  const expectedIssues = Array.isArray(raw.localIssues)
    ? raw.localIssues.map((issue) => ({
        original: issue.original,
        suggestions: issue.suggestion === undefined ? [] : [issue.suggestion],
        source: 'localIssues',
      }))
    : [];

  const noteExpectation = parseNoteExpectation(raw.note);
  let kind = 'exploratory';
  if (raw.expectNoLocalIssues || raw.expect === 'clean') kind = 'clean';
  else if (expectedIssues.length > 0) kind = 'expected-issues';
  else if (raw.expect === 'error') kind = noteExpectation ? 'expected-issues' : 'expected-any-error';
  else if (typeof raw.expect === 'string' && raw.expect && raw.expect !== 'maybe style' && raw.expect !== 'style flags') {
    if (raw.expect.includes('clean')) kind = 'clean';
    else if (raw.expect.includes('or keep')) kind = 'expected-optional';
    else kind = 'expected-issues';
  }

  const expected = [...expectedIssues];
  if (noteExpectation && expected.length === 0) expected.push(noteExpectation);
  if (kind === 'expected-issues' && expected.length === 0 && typeof raw.expect === 'string') {
    expected.push({ original: undefined, suggestions: raw.expect.split(/\s+or\s+/i), source: 'expect' });
  }

  return {
    id: raw.id ?? fallbackId,
    source,
    bucket: raw.bucket,
    category: raw.category,
    statusHint: raw.status,
    text: raw.text,
    note: raw.note ?? raw.notes,
    kind,
    expected,
  };
}

function expandCase(testCase) {
  if (testCase.kind !== 'expected-issues' || testCase.expected.length <= 1) return [testCase];
  return testCase.expected.map((expected, index) => ({
    ...testCase,
    id: `${testCase.id}#${index + 1}`,
    expected: [expected],
  }));
}

function parseNoteExpectation(note) {
  if (!note) return null;
  const match = String(note).match(/(?:typo|GENUINE typo|grammar|agreement|note):?\s*([^.;,]+?)\s*->\s*([^.;,]+)/i);
  if (!match) return null;
  return {
    original: cleanExpectedToken(match[1]),
    suggestions: [cleanExpectedToken(match[2])],
    source: 'note',
  };
}

function cleanExpectedToken(value) {
  return value
    .replace(/^[^A-Za-z']+/, '')
    .replace(/[^A-Za-z'][^A-Za-z'\s-]*$/g, '')
    .trim();
}

function runEngine(text) {
  const engineArgs = ['--spell-engine', spellEngine];
  if (spellEngine !== 'harper') engineArgs.push('--dictionary-path', dictionaryPath);
  if (spellEngine !== 'harper') engineArgs.push('--context-model-path', contextModelPath);
  if (args.noProtect) engineArgs.push('--no-protect');

  const result = spawnSync(binary, engineArgs, {
    input: text,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) return { error: result.error.message };
  if (result.status !== 0) return { error: result.stderr || `exit ${result.status}` };
  try {
    return { issues: JSON.parse(result.stdout) };
  } catch (error) {
    return { error: `invalid JSON: ${error.message}\n${result.stdout.slice(0, 500)}` };
  }
}

function judge(testCase, issues) {
  if (testCase.kind === 'clean') {
    if (issues.length === 0) return [{ status: 'MATCH', check: 'no issues', detail: '' }];
    return [
      {
        status: 'FALSE_POSITIVE',
        check: 'no issues',
        detail: issueSummary(issues),
      },
    ];
  }

  if (testCase.kind === 'expected-any-error') {
    if (issues.length > 0) {
      return [{ status: 'IMPROVEMENT', check: 'any issue', detail: issueSummary(issues) }];
    }
    return [{ status: 'REGRESSION', check: 'any issue', detail: 'native emitted no issues' }];
  }

  if (testCase.kind === 'expected-optional') {
    if (issues.length === 0) return [{ status: 'MATCH', check: 'optional clean', detail: '' }];
    const expected = testCase.expected[0];
    return suggestionsContain(issues, expected)
      ? [{ status: 'MATCH', check: expectedSummary(expected), detail: issueSummary(issues) }]
      : [{ status: 'EXPLORATORY', check: 'optional issue', detail: issueSummary(issues) }];
  }

  if (testCase.kind === 'expected-issues') {
    return testCase.expected.map((expected) => {
      if (suggestionsContain(issues, expected)) {
        return { status: 'MATCH', check: expectedSummary(expected), detail: issueSummary(issues) };
      }
      return {
        status: testCase.statusHint === 'known-gap' ? 'IMPROVEMENT' : 'REGRESSION',
        check: expectedSummary(expected),
        detail: issues.length ? issueSummary(issues) : 'native emitted no issues',
      };
    });
  }

  return [
    {
      status: 'EXPLORATORY',
      check: 'unlabelled',
      detail: issues.length ? issueSummary(issues) : 'no issues',
    },
  ];
}

function suggestionsContain(issues, expected) {
  if (!expected) return false;
  return issues.some((issue) => {
    if (expected.original && issue.original !== expected.original) return false;
    if (!expected.suggestions || expected.suggestions.length === 0) return true;
    return expected.suggestions.some((expectedSuggestion) =>
      issue.suggestions?.some((suggestion) => suggestion === expectedSuggestion),
    );
  });
}

function expectedSummary(expected) {
  const left = expected.original ?? '*';
  const right = expected.suggestions?.length ? expected.suggestions.join(' | ') : '*';
  return `${left}->${right}`;
}

function issueSummary(issues) {
  return issues
    .map((issue) => `${issue.original}->${(issue.suggestions ?? []).join('|')} [${issue.lint_kind}]`)
    .join(' ; ');
}

function printSummary(summary, results) {
  console.log(`Native engine parity (${spellEngine})`);
  console.log(`Cases: ${summary.total}`);
  console.log(
    `Judged checks: ${summary.judged}  MATCHES: ${summary.matches}  REGRESSIONS: ${summary.regressions}  IMPROVEMENTS: ${summary.improvements}  FALSE POSITIVES: ${summary.falsePositives}`,
  );
  console.log(`Exploratory checks: ${summary.exploratory}  Engine failures: ${summary.engineFailures}`);

  printSection('REGRESSIONS', results.filter((result) => result.status === 'REGRESSION'));
  printSection('FALSE POSITIVES', results.filter((result) => result.status === 'FALSE_POSITIVE'));
  printSection('IMPROVEMENTS', results.filter((result) => result.status === 'IMPROVEMENT'));
}

function printSection(title, rows) {
  if (rows.length === 0) return;
  console.log(`\n${title}`);
  for (const row of rows.slice(0, 50)) {
    console.log(`  ${row.id} (${row.source}) [${row.check}]`);
    console.log(`    ${row.text}`);
    console.log(`    ${row.detail}`);
  }
  if (rows.length > 50) console.log(`  ... ${rows.length - 50} more`);
}

function runOrExit(command, commandArgs, options) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
