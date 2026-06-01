import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const source = readFileSync(join(root, 'src/shared/protectedText.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  findProtectedSpans,
  filterIssuesInProtectedSpans,
  isProtectedNonProseText,
} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const cases = [
  {
    text: 'Damn, that is hilarious lol.',
    protected: ['lol'],
  },
  {
    text: "Whadda you know lol. I gotta admit y'all made a kinda wild setup.",
    protected: ['Whadda', 'lol', 'gotta', "y'all", 'kinda'],
  },
  {
    text: 'Whaddada you know lol. Whaddya think about this?',
    protected: ['Whaddada', 'lol', 'Whaddya'],
  },
  {
    text: 'The build failed at https://example.com/adress/recieved?key=OPENAI_API_KEY.',
    protected: ['https://example.com/adress/recieved?key=OPENAI_API_KEY'],
  },
  {
    text: 'Run NODE_ENV=production npm run build -- --watch before deploy.',
    protected: ['NODE_ENV=production npm run build -- --watch'],
  },
  {
    text: 'Use @vitejs/plugin-react with node:fs and react-dom/client.',
    protected: ['@vitejs/plugin-react', 'node:fs', 'react-dom/client'],
  },
  {
    text: 'The 2JZ NA-T setup made 700hp at 60-70psi with C++ logging.',
    protected: ['2JZ', 'NA-T', '700hp', '60-70psi', 'C++'],
  },
  {
    text: 'Config: base_url: http://localhost:11434 and sk-abcdefghijklmnopqrstuvwxyz.',
    protected: ['base_url: http://localhost:11434', 'sk-abcdefghijklmnopqrstuvwxyz'],
  },
  {
    text: 'See OG-104, PR #42, Dockerfile, .env.local, and package-lock.json.',
    protected: ['OG-104', 'PR #42', 'Dockerfile', '.env.local', 'package-lock.json'],
  },
  {
    text: 'Clone git@github.com:zazzn/opengrammar.git or use [::1]:3000.',
    protected: ['git@github.com:zazzn/opengrammar.git', '[::1]:3000'],
  },
];

let failed = 0;

function spanCovers(spans, text, fragment) {
  const start = text.indexOf(fragment);
  if (start === -1) return false;
  const end = start + fragment.length;
  return spans.some((span) => start >= span.start && end <= span.end);
}

for (const test of cases) {
  const spans = findProtectedSpans(test.text);
  for (const fragment of test.protected) {
    if (!spanCovers(spans, test.text, fragment)) {
      failed++;
      console.error(`FAIL protected fragment not covered: ${fragment}\n  ${test.text}`);
    }
  }
}

const filterText = 'Fix adress but not https://example.com/adress or lol.';
const protectedSpans = findProtectedSpans(filterText);
const filtered = filterIssuesInProtectedSpans(
  [
    { offset: 4, length: 6, original: 'adress' },
    { offset: filterText.indexOf('adress', 20), length: 6, original: 'adress' },
    { offset: filterText.indexOf('lol'), length: 3, original: 'lol' },
  ],
  protectedSpans,
);
if (filtered.length !== 1 || filtered[0]?.original !== 'adress') {
  failed++;
  console.error(`FAIL protected issue filtering returned ${JSON.stringify(filtered)}`);
}

for (const single of [
  'https://example.com/adress',
  'OPENAI_API_KEY',
  'node:fs',
  '700hp',
  'lol',
  '.env.local',
]) {
  if (!isProtectedNonProseText(single)) {
    failed++;
    console.error(`FAIL single-token non-prose was not protected: ${single}`);
  }
}

if (failed > 0) {
  console.error(`Protected-text regressions: ${failed}`);
  process.exit(1);
}

console.log(`Protected-text checks passed (${cases.length} cases).`);
