# Contributing to OpenGrammar

Thank you for your interest in contributing! Whether you're adding a new grammar rule, refining the AI context, or building out a new front-end UI feature, we are incredibly excited to welcome you.

This document outlines everything you need to know about the engine structure.

---

## 🛠️ Local Development

### Prerequisites

- [Bun](https://bun.sh/) (>= 1.3)
- Node.js (>= 20) for the extension front-end

### Starting the Environment

The project is split into the `/backend` (Hono API) and `/extension` (Google Chrome frontend).

1. **Spin up the Backend:**
   ```bash
   cd backend
   bun install
   bun dev
   ```

2. **Spin up the Extension:**
   ```bash
   cd extension
   npm install
   npm run build # (Vite output goes to /extension/dist)
   npm run dev   # (To auto-recompile UI edits)
   ```

### Running Tests

We have strict performance and validation checks. Before pushing anywhere, run:

```bash
cd backend
bun test
bun run bench.ts
```

The 814+ rule engine should comfortably process 10,000 words in under a second (`1000ms`).

---

## 📖 The Rule Engine Architecture

OpenGrammar is fundamentally an offline-first system powered by the huge `CORE_RULES` library in `backend/src/rules/index.ts`.

It runs `RegexRules` and `NLPRules` to check every single chunk of a sentence. Before adding a new rule, search through the modules (`adjectives-adverbs.ts`, `style-tone.ts`, etc.) to see if your logical check fits an existing category.

### How to Add a Regex Rule
Regex rules are incredibly fast but lack contextual awareness (they don't know the difference between "a lead pipe" and "to lead a horse"). Write these when the error is deterministic.

**Example `backend/src/rules/categories/punctuation.ts`:**
```typescript
{
  id: 'PU_double_spaces',
  type: 'regex',
  pattern: '\\b[a-zA-Z]+\\s{2,}[a-zA-Z]+\\b',
  check: (text: string) => {
    return createRegexRule(
      'PU_double_spaces',
      /(\S)(\s{2,})(\S)/g,
      'grammar',
      '', // replacement dynamically handled below:
      'Avoid double spaces between words.',
      text
    ).map(issue => ({
      ...issue,
      suggestion: issue.original.replace(/\s{2,}/g, ' '),
      priority: 85
    }));
  }
}
```

### How to Add an NLP Rule
Using the `compromise` NLP library, we tag parts-of-speech (Verbs, Nouns, Adjectives). Use NLP rules when the phrasing is ambiguous and relies on grammar syntax.

**Example `backend/src/rules/categories/verb-tense.ts`:**
```typescript
{
  id: 'VT_stative_progressives',
  type: 'nlp',
  check: (text: string, doc: any) => {
    const issues: Issue[] = [];
    // Only target Present Participle Gerunds of stative verbs 
    const matches = doc.match('(is|am|are|was|were) (knowing|belonging|desiring|preferring|liking|loving|hating)');
    
    matches.forEach((m: any) => {
      const original = m.text();
      // Heuristically map "is knowing" -> "knows"
      issues.push({
        id: 'VT_stative_progressives',
        type: 'grammar',
        original,
        suggestion: fixStativeVerb(original),
        reason: 'Stative verbs like this generally do not take the progressive (-ing) tense.',
        offset: m.out('offset').start,
        length: original.length,
        priority: 90
      });
    });
    return issues;
  }
}
```

---

## 📝 Pull Request Guidelines

When submitting a PR:
1. Include passing tests in `engine.test.ts`. Every single rule MUST have at least one valid and invalid test assertion.
2. If introducing a `style` rule or `business-writing` check, make sure its `id` follows the appropriate `MODULE_PREFIX` mapping inside `context-filter.ts`. Otherwise, the context engine won't know when to disable it in casual chat apps!
3. Prefix your commits with `feat:`, `fix:`, or `chore:` following conventional commits.

We use **Biome** on GitHub Actions to auto-lint against the core codebase formatting (2 spaces, single quotes). You don't need to format it perfectly yourself, just ensure the build isn't spectacularly broken.

Welcome to OpenGrammar! 🎉
