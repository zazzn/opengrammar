import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';

function loadTsModule(path) {
  const source = readFileSync(join(root, path), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const { findProtectedSpans } = await loadTsModule('src/shared/protectedText.ts');
const {
  hiddenOllamaWritingModels,
  visibleOllamaWritingModels,
  pickRecommendedOllamaWritingModel,
} = await loadTsModule('src/shared/ollamaModels.ts');

const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const INCLUDE_EXCLUDED = process.argv.includes('--include-excluded');
const MODELS_ARG = process.argv.find((arg) => arg.startsWith('--models='));

function replaceOnce(text, original, replacement) {
  const index = text.indexOf(original);
  if (index < 0) return text;
  return text.slice(0, index) + replacement + text.slice(index + original.length);
}

function expectedFromCorpus(entry) {
  if (entry.llmCorrection) return entry.llmCorrection;
  if (Array.isArray(entry.localIssues) && entry.localIssues.length) {
    return entry.localIssues.reduce(
      (text, issue) => replaceOnce(text, issue.original, issue.suggestion),
      entry.text,
    );
  }
  return entry.text;
}

function weightFor(entry) {
  if (entry.bucket === 'protected-span') return 4;
  if (entry.bucket === 'ignore') return 3;
  if (entry.bucket === 'sentence-review') return 2;
  return 1;
}

const corpus = JSON.parse(readFileSync(join(root, 'test-data/suggestion-corpus.json'), 'utf8'));
const CASES = corpus
  .filter((entry) => !entry.manual && entry.status !== 'known-gap')
  .filter((entry) => ['quick-fix', 'sentence-review', 'protected-span', 'ignore'].includes(entry.bucket))
  .map((entry) => ({
    id: entry.id,
    name: `${entry.id} ${entry.category}`,
    bucket: entry.bucket,
    text: entry.text,
    expected: [expectedFromCorpus(entry)],
    protected: entry.protected || [],
    mustNotChange: entry.bucket === 'ignore' || (entry.bucket === 'protected-span' && !entry.localIssues?.length),
    weight: weightFor(entry),
  }));

const SYSTEM_PROMPT =
  'You are a conservative proofreading engine. Correct only objective ' +
  'errors: spelling, grammar, punctuation, capitalization, and obvious ' +
  'word-form mistakes. Do not improve style, tone, clarity, slang, or ' +
  'wording unless explicitly asked. Preserve meaning and casual voice. ' +
  'Do not normalize phonetic casual speech such as whadda, whaddya, ' +
  'whatcha, gotta, wanna, kinda, yall, or lol in correction mode. ' +
  'Preserve every protected fragment EXACTLY. If the sentence is ' +
  'acceptable as written, or if confidence is low, return shouldShow=false. ' +
  'Return JSON only with this shape: ' +
  '{"originalText":string,"correctedText":string,"shouldShow":boolean,' +
  '"protectedSpansPreserved":boolean,"corrections":[{"original":string,' +
  '"replacement":string,"start":number,"end":number,"type":"spelling|grammar|punctuation|capitalization|word-form","confidence":"high|medium|low","explanation":string}]}.';

function norm(s) {
  return String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function protectedFragments(text) {
  return findProtectedSpans(text)
    .map((span) => text.slice(span.start, span.end))
    .filter((fragment) => fragment.trim().length > 1);
}

function countOccurrences(text, fragment) {
  if (!fragment) return 0;
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(fragment, index)) !== -1) {
    count++;
    index += fragment.length;
  }
  return count;
}

function hasProtectedDamage(original, corrected, fragments) {
  return fragments.some((fragment) => {
    const originalCount = countOccurrences(original, fragment);
    return originalCount > 0 && countOccurrences(corrected, fragment) !== originalCount;
  });
}

function stripReasoning(s) {
  return String(s || '')
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think\b[^>]*>/gi, '')
    .replace(/\/(?:no_)?think\b/gi, '')
    .trim();
}

function parseCorrection(raw, original) {
  const cleaned = stripReasoning(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return { validJson: false, corrected: cleaned || original, shouldShow: true };
  }
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const shouldShow = parsed.shouldShow !== false;
    return {
      validJson: true,
      corrected: shouldShow ? String(parsed.correctedText || original).trim() : original,
      shouldShow,
    };
  } catch {
    return { validJson: false, corrected: cleaned || original, shouldShow: true };
  }
}

async function fetchJson(path, init, timeoutMs = 180000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${OLLAMA.replace(/\/+$/, '')}${path}`, {
      ...init,
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function unload(model) {
  try {
    await fetchJson('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: 0 }),
    }, 15000);
  } catch {
    // Best effort only.
  }
}

async function timedChat(model, test) {
  const started = Date.now();
  const data = await fetchJson('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `${/\bqwen3\b/i.test(model) ? '/no_think\n' : ''}${SYSTEM_PROMPT}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            text: test.text,
            protectedFragments: protectedFragments(test.text),
          }),
        },
      ],
      temperature: 0,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      keep_alive: '2m',
    }),
  });
  const elapsedMs = Date.now() - started;
  const raw = data?.choices?.[0]?.message?.content || '';
  return { elapsedMs, raw, parsed: parseCorrection(raw, test.text) };
}

const tagData = await fetchJson('/api/tags', {}, 10000);
let installed = (tagData.models || []).map((m) => m.name).filter(Boolean);
if (MODELS_ARG) {
  const allowed = new Set(MODELS_ARG.replace(/^--models=/, '').split(',').map((s) => s.trim()));
  installed = installed.filter((m) => allowed.has(m));
}

const hidden = hiddenOllamaWritingModels(installed);
const models = INCLUDE_EXCLUDED ? installed : visibleOllamaWritingModels(installed);
if (models.length === 0) throw new Error('No Ollama models found to benchmark.');

console.log(`Ollama: ${OLLAMA}`);
console.log(`Benchmarking: ${models.join(', ')}`);
if (!INCLUDE_EXCLUDED && hidden.length) {
  console.log(`Skipped non-writing models: ${hidden.join(', ')}`);
}
console.log('');

const results = [];
for (const model of models) {
  let passed = 0;
  let validJson = 0;
  let protectedOk = 0;
  let falsePositiveOk = 0;
  let sentenceReviewPassed = 0;
  let sentenceReviewTotal = 0;
  let totalMs = 0;
  let weightedScore = 0;
  let weightedTotal = 0;
  let hardFailures = 0;
  const details = [];

  let loadMs = 0;
  try {
    await unload(model);
    const coldStart = Date.now();
    await fetchJson('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: 'ok',
        stream: false,
        options: { num_predict: 1 },
        keep_alive: '2m',
      }),
    }, 180000);
    loadMs = Date.now() - coldStart;

    for (const test of CASES) {
      const { elapsedMs, parsed } = await timedChat(model, test);
      totalMs += elapsedMs;
      const fragments = [...new Set([...protectedFragments(test.text), ...test.protected])];
      const protects = !hasProtectedDamage(test.text, parsed.corrected, fragments);
      const expectedOk = test.expected.some((expected) => norm(expected) === norm(parsed.corrected));
      const effectivelyShows = parsed.shouldShow && norm(parsed.corrected) !== norm(test.text);
      const noFalsePositive = !test.mustNotChange || !effectivelyShows;
      const ok = parsed.validJson && protects && expectedOk && noFalsePositive;
      const weight = test.weight || 1;
      weightedTotal += weight;
      if (ok) passed++;
      if (ok) weightedScore += weight;
      if (parsed.validJson) validJson++;
      if (protects) protectedOk++;
      if (noFalsePositive) falsePositiveOk++;
      if (test.bucket === 'sentence-review') {
        sentenceReviewTotal++;
        if (ok) sentenceReviewPassed++;
      }
      if (!protects || !noFalsePositive || !parsed.validJson) hardFailures++;
      details.push({
        name: test.name,
        ok,
        protects,
        noFalsePositive,
        validJson: parsed.validJson,
        elapsedMs,
        corrected: norm(parsed.corrected),
      });
    }
  } finally {
    await unload(model);
  }

  const avgMs = Math.round(totalMs / CASES.length);
  const result = {
    model,
    passed,
    total: CASES.length,
    accuracy: passed / CASES.length,
    weightedScore,
    weightedTotal,
    validJson,
    protectedOk,
    falsePositiveOk,
    sentenceReviewPassed,
    sentenceReviewTotal,
    hardFailures,
    loadMs,
    avgMs,
    details,
  };
  results.push(result);
  console.log(`${model}: ${passed}/${CASES.length} correct, weighted ${weightedScore}/${weightedTotal}, hardFailures ${hardFailures}, avg ${avgMs}ms, load ${loadMs}ms`);
  for (const d of details) {
    const gates = d.ok ? '' : ` gates=json:${d.validJson ? 'Y' : 'N'} protect:${d.protects ? 'Y' : 'N'} fp:${d.noFalsePositive ? 'Y' : 'N'}`;
    console.log(`  ${d.ok ? 'OK ' : 'BAD'} ${String(d.elapsedMs).padStart(5)}ms ${d.name}${gates}: ${d.corrected}`);
  }
  console.log('');
}

results.sort(
  (a, b) =>
    a.hardFailures - b.hardFailures ||
    b.weightedScore - a.weightedScore ||
    b.passed - a.passed ||
    a.avgMs - b.avgMs ||
    a.loadMs - b.loadMs,
);
const recommended = results[0]?.model || pickRecommendedOllamaWritingModel(installed);
console.log('Summary');
for (const r of results) {
  console.log(`  ${r.model.padEnd(28)} ${r.passed}/${r.total} weighted=${r.weightedScore}/${r.weightedTotal} hard=${r.hardFailures} json=${r.validJson}/${r.total} protect=${r.protectedOk}/${r.total} fp=${r.falsePositiveOk}/${r.total} sent=${r.sentenceReviewPassed}/${r.sentenceReviewTotal} avg=${r.avgMs}ms load=${r.loadMs}ms`);
}
console.log(`Recommended by benchmark: ${recommended}`);
