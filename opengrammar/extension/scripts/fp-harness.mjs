/**
 * End-to-end false-positive harness for the OGrammar inline (CHECK_GRAMMAR) path.
 *
 * The shipped pipeline lives in src/background/index.ts:handleGrammarCheck:
 *
 *   harperLint(text)                      // Harper WASM + context re-ranker
 *     -> filterIssuesInProtectedSpans(..) // drop issues overlapping protected spans
 *     -> applyIssuePolicy(..)             // route quick-fix / sentence-review / suppress
 *     -> filterIssues(..)                 // user ignored-list + dictionary (skipped here)
 *
 * harperLint() itself (src/background/harperEngine.ts) cannot be imported in Node
 * because it depends on chrome.runtime.getURL + the chrome fetch model loader. So
 * this harness REPLICATES harperEngine.harperLint faithfully (same lint config,
 * same suggestion extraction, same mapType, same context re-rank, same common
 * spelling override) while loading the *real, shipped* pure modules:
 *   - src/background/contextRankerCore.ts  (rankCandidates)
 *   - src/shared/protectedText.ts          (findProtectedSpans / filter / non-prose)
 *   - src/background/issuePolicy.ts         (applyIssuePolicy)
 *   - public/ngram/model.bin                (committed n-gram model)
 *
 * => any divergence is confined to the harperEngine port below; everything that
 *    decides protection + routing is the exact shipped code.
 *
 * Usage:
 *   node scripts/fp-harness.mjs <corpus.json>           # JSON array of strings OR {text,note?,expect?}
 *   node scripts/fp-harness.mjs --text "some sentence"  # single ad-hoc string
 *   (no args) -> runs a tiny built-in smoke corpus
 *
 * Output: a JSON object on stdout: { model:{V,B}, results:[ { text, note?, issues:[...],
 *   skippedAsNonProse:bool } ], summary:{ texts, flagged, byRoute, byType } }
 * Each issue: { type, original, suggestion, route, routeReason, reason, offset, length,
 *   confidence, protectedFiltered:false }.  (protected-filtered issues are removed,
 *   exactly as the extension removes them, so "issues" == what the user would see.)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { LocalLinter, Dialect, SuggestionKind } from 'harper.js';
import { binaryInlined } from 'harper.js/binaryInlined';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';

async function loadTs(relPath) {
  const src = readFileSync(join(root, relPath), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const { parseModel, rankCandidates } = await loadTs('src/background/contextRankerCore.ts');
const { findProtectedSpans, filterIssuesInProtectedSpans, isProtectedNonProseText } =
  await loadTs('src/shared/protectedText.ts');
const { applyIssuePolicy } = await loadTs('src/background/issuePolicy.ts');

const rawModel = readFileSync(join(root, 'public/ngram/model.bin'));
const MODEL = parseModel(
  rawModel.buffer.slice(rawModel.byteOffset, rawModel.byteOffset + rawModel.byteLength),
);

// ── mirrors src/background/harperEngine.ts ───────────────────────────────────
const STYLE_LINTS_TO_ENABLE = {
  BoringWords: true,
  FillerWords: true,
  LongSentences: true,
  RepeatedWords: true,
  DiscourseMarkers: true,
};
const COMMON_SPELLING_OVERRIDES = { adress: 'address', hadd: 'had', teh: 'the' };

// Optional --dialect=British|Australian|Canadian|American (default American,
// matching the extension default). Mirrors harperEngine.resolveDialect().
const DIALECT_ARG = (process.argv.find((a) => a.startsWith('--dialect=')) || '').split('=')[1];
const DIALECT =
  { American: Dialect.American, British: Dialect.British, Australian: Dialect.Australian, Canadian: Dialect.Canadian }[
    DIALECT_ARG
  ] ?? Dialect.American;

function applyCommonSpellingOverride(original, suggestion) {
  const replacement = COMMON_SPELLING_OVERRIDES[original.toLowerCase()];
  if (!replacement) return suggestion;
  if (suggestion.toLowerCase() === replacement) return suggestion;
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
  const end = u16;
  return (cp) => {
    if (cp <= 0) return 0;
    if (cp >= map.length) return end;
    return map[cp];
  };
}

function mapType(kind) {
  const k = kind.toLowerCase();
  if (k.includes('spell') || k.includes('typo') || k.includes('eggcorn') || k.includes('malapropism'))
    return 'spelling';
  if (
    k.includes('capital') || k.includes('punctuation') || k.includes('grammar') ||
    k.includes('agreement') || k.includes('boundary') || k.includes('number') || k.includes('regional')
  )
    return 'grammar';
  if (k.includes('read') || k.includes('clarity') || k.includes('repetition')) return 'clarity';
  return 'style';
}

let linterPromise = null;
function getLinter() {
  if (!linterPromise) {
    linterPromise = (async () => {
      const linter = new LocalLinter({ binary: binaryInlined, dialect: DIALECT });
      await linter.setup();
      try {
        const current = await linter.getLintConfig();
        await linter.setLintConfig({ ...current, ...STYLE_LINTS_TO_ENABLE });
      } catch (e) {
        console.warn('[harper] could not enable style lints:', e?.message || e);
      }
      return linter;
    })();
  }
  return linterPromise;
}

/** Faithful port of harperEngine.harperLint (minus chrome plumbing). */
async function harperLint(text) {
  if (!text || !text.trim()) return [];
  const linter = await getLinter();
  const lints = await linter.lint(text, { language: 'plaintext' });
  const cpToU16 = buildCpToUtf16(text);
  const issues = [];

  for (const lint of lints) {
    try {
      if (lint.suggestion_count() === 0) continue;
      const span = lint.span();
      const startU16 = cpToU16(span.start);
      const endU16 = cpToU16(span.end);
      span.free();
      if (endU16 <= startU16) continue;
      const original = text.slice(startU16, endU16);

      const kind = lint.lint_kind();
      const type = mapType(kind);

      const rawSuggs = lint.suggestions();
      const sg = rawSuggs.map((s) => ({ k: s.kind(), t: s.get_replacement_text() }));
      for (const s of rawSuggs) s.free();
      if (sg.length === 0) continue;

      let suggestion;
      let reason = lint.message();

      if (type === 'spelling') {
        const cands = sg
          .filter((x) => x.k === SuggestionKind.Replace)
          .map((x) => x.t)
          .filter((t) => t && t !== original);
        if (cands.length === 0) continue;
        const ranked = rankCandidates(MODEL, text, startU16, endU16 - startU16, original, cands);
        suggestion = ranked[0];
        const alts = ranked.slice(1);
        if (alts.length > 0) reason = `${reason} Other suggestions: ${alts.join(', ')}.`;
      } else {
        const s0 = sg[0];
        switch (s0.k) {
          case SuggestionKind.Remove:
            suggestion = '';
            break;
          case SuggestionKind.InsertAfter:
            suggestion = original + s0.t;
            break;
          default:
            suggestion = s0.t;
            break;
        }
      }

      const before = suggestion;
      suggestion = applyCommonSpellingOverride(original, suggestion);
      if (suggestion !== before) reason = `Did you mean to spell \`${original}\` as \`${suggestion}\`?`;

      if (suggestion === original) continue;

      issues.push({
        type,
        original,
        suggestion,
        reason,
        offset: startU16,
        length: endU16 - startU16,
        source: 'rule',
        confidence: 0.95,
        kind, // extra: raw Harper lint_kind, for analysis (not in shipped Issue)
      });
    } finally {
      lint.free();
    }
  }
  return issues;
}

/** Full CHECK_GRAMMAR pipeline for one text. */
export async function runPipeline(text) {
  const skippedAsNonProse = isProtectedNonProseText(text);
  const harperIssues = await harperLint(text);
  const spans = findProtectedSpans(text);
  const contextSafe = filterIssuesInProtectedSpans(harperIssues, spans);
  const routed = applyIssuePolicy(contextSafe);
  return {
    text,
    skippedAsNonProse,
    protectedSpans: spans.map((s) => ({ ...s, fragment: text.slice(s.start, s.end) })),
    issues: routed,
  };
}

function loadCorpus(argv) {
  const i = argv.indexOf('--text');
  if (i !== -1 && argv[i + 1]) return [{ text: argv[i + 1] }];
  const file = argv.find((a) => a.endsWith('.json'));
  if (file) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return data.map((d) => (typeof d === 'string' ? { text: d } : d));
  }
  return [
    { text: 'I recieved your adress yesterday.', note: 'smoke: two real typos' },
    { text: 'The 2JZ NA-T made 700hp at the track.', note: 'smoke: must NOT flag automotive' },
    { text: 'Run npm run build before you deploy to prod.', note: 'smoke: must NOT flag command' },
    { text: 'She was borwn in May.', note: 'smoke: context must pick born' },
  ];
}

async function main() {
  const corpus = loadCorpus(process.argv.slice(2));
  const results = [];
  const summary = { texts: corpus.length, flagged: 0, byRoute: {}, byType: {} };

  for (const item of corpus) {
    const r = await runPipeline(item.text);
    if (item.note) r.note = item.note;
    if (item.expect) r.expect = item.expect;
    if (r.issues.length > 0) summary.flagged++;
    for (const issue of r.issues) {
      summary.byRoute[issue.route] = (summary.byRoute[issue.route] || 0) + 1;
      summary.byType[issue.type] = (summary.byType[issue.type] || 0) + 1;
    }
    results.push(r);
  }

  process.stdout.write(
    JSON.stringify({ model: { V: MODEL.V, B: MODEL.bi.size }, summary, results }, null, 2) + '\n',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
