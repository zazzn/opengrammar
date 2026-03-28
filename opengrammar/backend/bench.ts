import { RuleBasedAnalyzer } from './src/analyzer.js';
import { CORE_RULES } from './src/rules/index.js';

/**
 * ╔══════════════════════════════════════════════════╗
 * ║  OpenGrammar Performance Benchmark               ║
 * ╚══════════════════════════════════════════════════╝
 */

// Realistic English text with intentional errors sprinkled in
const BASE_TEXT = `The development team have been working extremely hard on the new product launch. 
Everyone are excited about the upcoming release, and the chairman said it will effect millions of users worldwide. 
We should of started earlier, but due to the fact that we had limited resources, the project was delayed. 
The team made a decision to utilize a new framework that would facilitate better performance. 
Some people say this approach is more better than the previous one. In my opinion, I think that we need to 
touch base with the stakeholders and circle back on the implementation details. For all intensive purposes, 
the system is working good. The ATM machine at the PIN number location needs a sneak peak review. 
She sings beautiful and plays good. The childs are gonna love this. Lemme know if you have questions btw.
The fireman and policeman discussed the manpower needed. We must ameliorate the situation and ascertain the facts.
Studies show that this is not uncommon. The elderly need support. I am writing to inform you that we need help.
Please advise on the next steps. Its a mute point whether we should of went ahead with this plan.
The weather will effect my mood. I will loose my keys if I am not careful about this.
Notwithstanding the aforementioned issues, the project is approximately on schedule.
The results demonstrate that our paradigm has proliferated and exacerbated the existing dichotomy.`;

function generateText(targetWords: number): string {
  const baseWords = BASE_TEXT.split(/\s+/).length;
  const repeats = Math.ceil(targetWords / baseWords);
  let text = '';
  for (let i = 0; i < repeats; i++) {
    text += BASE_TEXT + '\n\n';
  }
  // Trim to target word count
  const words = text.split(/\s+/);
  return words.slice(0, targetWords).join(' ');
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Performance targets from the plan
const TARGETS: Record<number, number> = {
  100: 50,
  500: 100,
  1000: 200,
  5000: 500,
  10000: 1000,
};

console.log(`\n╔══════════════════════════════════════════════════╗`);
console.log(`║  OpenGrammar Performance Benchmark               ║`);
console.log(`╠══════════════════════════════════════════════════╣`);
console.log(`║  Rules loaded: ${CORE_RULES.length.toString().padStart(4)}                             ║`);
console.log(`╚══════════════════════════════════════════════════╝\n`);

const sizes = [100, 500, 1000, 5000, 10000];
const results: Array<{
  words: number;
  chars: number;
  issues: number;
  timeMs: number;
  target: number;
  passed: boolean;
  rulesPerMs: number;
}> = [];

// Warm up (first run compiles regexes, loads dictionary, etc.)
console.log('Warming up...');
RuleBasedAnalyzer.analyze('This is a warm up sentence with gonna and buyed.', { writingContext: 'general' });
console.log('Warm-up complete.\n');

for (const wordCount of sizes) {
  const text = generateText(wordCount);
  const actualWords = text.split(/\s+/).length;
  const chars = text.length;

  // Run 3 times, take the median
  const times: number[] = [];
  let issues = 0;

  for (let run = 0; run < 3; run++) {
    const start = performance.now();
    const result = RuleBasedAnalyzer.analyze(text, { writingContext: 'general' });
    const elapsed = performance.now() - start;
    times.push(elapsed);
    issues = result.length;
  }

  times.sort((a, b) => a - b);
  const medianMs = times[1]!; // median of 3 runs
  const target = TARGETS[wordCount] || 1000;
  const passed = medianMs <= target;

  results.push({
    words: actualWords,
    chars,
    issues,
    timeMs: medianMs,
    target,
    passed,
    rulesPerMs: CORE_RULES.length / medianMs,
  });

  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}  ${actualWords.toString().padStart(6)} words | ${formatBytes(chars).padStart(8)} | ${formatMs(medianMs).padStart(8)} (target: ${formatMs(target)}) | ${issues} issues`);
}

// Summary table
console.log(`\n${'─'.repeat(80)}`);
console.log(`${'Words'.padStart(8)} | ${'Chars'.padStart(8)} | ${'Time'.padStart(8)} | ${'Target'.padStart(8)} | ${'Status'.padStart(8)} | Issues | Rules/ms`);
console.log(`${'─'.repeat(80)}`);
for (const r of results) {
  console.log(
    `${r.words.toString().padStart(8)} | ${formatBytes(r.chars).padStart(8)} | ${formatMs(r.timeMs).padStart(8)} | ${formatMs(r.target).padStart(8)} | ${(r.passed ? '✅ PASS' : '❌ FAIL').padStart(8)} | ${r.issues.toString().padStart(6)} | ${r.rulesPerMs.toFixed(1)}`
  );
}
console.log(`${'─'.repeat(80)}`);

const allPassed = results.every(r => r.passed);
console.log(`\n${allPassed ? '🎉 ALL BENCHMARKS PASSED!' : '⚠️  SOME BENCHMARKS FAILED — optimization needed'}\n`);

// Breakdown: measure individual component times for the largest document
console.log('─── Component Breakdown (10K words) ───');
const bigText = generateText(10000);

// 1. Spellcheck only
const spellStart = performance.now();
const { checkSpelling } = await import('./src/spellchecker.js');
checkSpelling(bigText);
const spellTime = performance.now() - spellStart;
console.log(`  Spellchecker:    ${formatMs(spellTime)}`);

// 2. NLP parse only
const nlpStart = performance.now();
try {
  const { NLPEngine } = await import('./src/nlp/nlp-engine.js');
  NLPEngine.parse(bigText);
} catch {}
const nlpTime = performance.now() - nlpStart;
console.log(`  NLP Parse:       ${formatMs(nlpTime)}`);

// 3. Rules only (no spellcheck, no NLP)
const rulesStart = performance.now();
for (const rule of CORE_RULES) {
  try {
    if (rule.type === 'regex') rule.check(bigText);
  } catch {}
}
const rulesTime = performance.now() - rulesStart;
console.log(`  Regex Rules:     ${formatMs(rulesTime)}`);

// 4. Deduplication (estimate)
const allIssues = RuleBasedAnalyzer.analyze(bigText, { writingContext: 'general' });
const dedupStart = performance.now();
// Re-run to measure dedup overhead
RuleBasedAnalyzer.analyze(bigText, { writingContext: 'general' });
const totalTime = performance.now() - dedupStart;
const dedupEstimate = totalTime - rulesTime - spellTime;
console.log(`  Dedup + Other:   ${formatMs(Math.max(0, dedupEstimate))}`);
console.log(`  Total:           ${formatMs(totalTime)}`);
console.log(`  Issues found:    ${allIssues.length}`);
console.log('');
