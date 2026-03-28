import type { Rule } from './types.js';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Context-Aware Rule Filtering                                ║
 * ║  Auto-detect document type and enable/disable rule modules   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * In casual chat, users don't want 814 rules nagging about "gonna".
 * In academic papers, they want weasel word detection.
 * This module maps writing context → active rule module prefixes.
 */

export type WritingContext =
  | 'email' // Gmail, Outlook, Yahoo Mail
  | 'document' // Google Docs, Notion, Overleaf, Word
  | 'technical' // GitHub, StackOverflow, GitLab
  | 'social' // Twitter/X, Reddit, Facebook, LinkedIn
  | 'chat' // Slack, Discord, Teams, WhatsApp Web
  | 'academic' // Academic papers (detected by content or domain like Overleaf)
  | 'general'; // Default — full rule set

/**
 * Rule module prefixes — these are the first segment of each rule ID
 * or the export name pattern from each category file.
 * We use rule ID prefixes to classify which module a rule belongs to.
 */
const MODULE_PREFIXES: Record<string, string[]> = {
  // Grammar core
  grammar: [
    'SVA_',
    'VT_',
    'SS_',
    'PU_',
    'buyed',
    'drived',
    'catched',
    'finded',
    'goed',
    'runned',
    'swimmed',
    'thinked',
    'writed',
    'speaked',
    'breaked',
    'choosed',
    'drinked',
    'eated',
    'falled',
    'feeled',
    'flyed',
    'growed',
    'hided',
    'holded',
    'keeped',
    'knowed',
    'leaved',
    'meaned',
    'maked',
    'payed',
    'putted',
    'readed',
    'sayed',
    'seed',
    'selled',
    'sended',
    'singed',
    'sitted',
    'sleeped',
    'spended',
    'standed',
    'stealed',
    'taked',
    'teached',
    'telled',
    'understanded',
    'weared',
    'winned',
    'GR_',
  ],
  // Spelling
  spelling: ['SP_', 'CW_'],
  // Sentence structure
  'sentence-structure': ['SS_'],
  // Verb tense
  'verb-tense': [
    'VT_',
    'have_went',
    'have_broke',
    'have_ate',
    'should_have_',
    'could_have_',
    'would_have_',
    'must_have_',
    'might_have_',
    'may_have_',
  ],
  // Adjectives & adverbs
  'adjectives-adverbs': ['AA_'],
  // Nouns & pronouns
  'nouns-pronouns': ['NP_'],
  // Prepositions
  prepositions: ['PR_'],
  // Conjunctions / wordy
  conjunctions: ['CJ_'],
  // Punctuation
  punctuation: [
    'PU_',
    'dont',
    'doesnt',
    'didnt',
    'cant',
    'wont',
    'isnt',
    'arent',
    'wasnt',
    'werent',
    'shouldnt',
    'couldnt',
    'wouldnt',
    'hasnt',
    'havent',
    'hadnt',
    'its_vs_',
    'HYPH_',
  ],
  // Confused words
  'confused-words': ['CW_'],
  // Style & tone
  'style-tone': ['ST_'],
  // Formality
  formality: ['FR_'],
  // Formatting & idioms
  'formatting-idioms': ['IE_', 'NF_'],
  // Capitalization
  capitalization: ['CAP_'],
  // Academic writing
  'academic-writing': ['AW_'],
  // Business writing
  'business-writing': ['BW_'],
  // Inclusive language
  'inclusive-language': ['IL_'],
  // Readability
  readability: ['RD_'],
  // Clarity
  clarity: ['CLR_'],
  // Style base
  style: ['STY_'],
  // Grammar advanced
  'grammar-advanced': ['GR_'],
  // Spelling advanced
  'spelling-advanced': [
    'intents-purposes',
    'its-vs-its',
    'their-vs-there',
    'your-vs-youre',
    'who-vs-whom',
  ],
};

/**
 * Which module groups are ENABLED per writing context.
 * Modules not listed are DISABLED for that context.
 */
const CONTEXT_MODULES: Record<WritingContext, Set<string>> = {
  chat: new Set(['grammar', 'spelling', 'confused-words', 'punctuation', 'spelling-advanced']),

  social: new Set([
    'grammar',
    'spelling',
    'confused-words',
    'punctuation',
    'nouns-pronouns',
    'verb-tense',
    'spelling-advanced',
  ]),

  email: new Set([
    'grammar',
    'spelling',
    'confused-words',
    'punctuation',
    'sentence-structure',
    'verb-tense',
    'nouns-pronouns',
    'adjectives-adverbs',
    'prepositions',
    'capitalization',
    'business-writing',
    'formality',
    'clarity',
    'style-tone',
    'spelling-advanced',
    'grammar-advanced',
    'formatting-idioms',
  ]),

  technical: new Set([
    'grammar',
    'spelling',
    'confused-words',
    'punctuation',
    'sentence-structure',
    'verb-tense',
    'nouns-pronouns',
    'prepositions',
    'capitalization',
    'readability',
    'clarity',
    'spelling-advanced',
    'grammar-advanced',
  ]),

  document: new Set(Object.keys(MODULE_PREFIXES)),

  academic: new Set([
    'grammar',
    'spelling',
    'confused-words',
    'punctuation',
    'sentence-structure',
    'verb-tense',
    'nouns-pronouns',
    'adjectives-adverbs',
    'prepositions',
    'conjunctions',
    'capitalization',
    'academic-writing',
    'readability',
    'style-tone',
    'clarity',
    'inclusive-language',
    'formatting-idioms',
    'spelling-advanced',
    'grammar-advanced',
  ]),

  general: new Set(Object.keys(MODULE_PREFIXES)),
};

/**
 * Determine the module a rule belongs to based on its ID prefix.
 */
function getRuleModule(ruleId: string): string {
  for (const [moduleName, prefixes] of Object.entries(MODULE_PREFIXES)) {
    for (const prefix of prefixes) {
      if (ruleId.startsWith(prefix)) {
        return moduleName;
      }
    }
  }
  // Fallback: rules without a recognized prefix are always included
  return 'general';
}

/**
 * Filter rules based on writing context and user-defined disabled modules.
 * Returns only the rules that are relevant for the given context and not manually disabled.
 */
export function filterRulesByContext(
  rules: Rule[],
  context: WritingContext,
  disabledModules?: string[],
): Rule[] {
  // 1. First, apply manual user overrides (stripping out entire categories if disabled)
  // We map the UI categories (Grammar, Spelling, Punctuation, Style, Clarity)
  // to the internal MODULE_PREFIXES groups.
  const disabledPrefixGroups = new Set<string>();

  if (disabledModules && disabledModules.length > 0) {
    const dLower = disabledModules.map((d) => d.toLowerCase());
    if (dLower.includes('grammar')) {
      [
        'grammar',
        'grammar-advanced',
        'sentence-structure',
        'verb-tense',
        'nouns-pronouns',
        'adjectives-adverbs',
        'prepositions',
        'conjunctions',
      ].forEach((m) => disabledPrefixGroups.add(m));
    }
    if (dLower.includes('spelling')) {
      ['spelling', 'spelling-advanced', 'confused-words'].forEach((m) =>
        disabledPrefixGroups.add(m),
      );
    }
    if (dLower.includes('punctuation')) {
      ['punctuation', 'capitalization'].forEach((m) => disabledPrefixGroups.add(m));
    }
    if (dLower.includes('style')) {
      [
        'style',
        'style-tone',
        'formality',
        'academic-writing',
        'business-writing',
        'inclusive-language',
        'formatting-idioms',
      ].forEach((m) => disabledPrefixGroups.add(m));
    }
    if (dLower.includes('clarity')) {
      ['clarity', 'readability'].forEach((m) => disabledPrefixGroups.add(m));
    }
  }

  // 2. Map standard context
  const enabledContextModules = CONTEXT_MODULES[context];

  return rules.filter((rule) => {
    const module = getRuleModule(rule.id);

    // Manual override check: if the user disabled this entire module group, strip it out.
    if (disabledPrefixGroups.has(module)) {
      return false;
    }

    // Context filter check
    if (context === 'general' || context === 'document') {
      return true; // No context filtering
    }

    return module === 'general' || (enabledContextModules && enabledContextModules.has(module));
  });
}

/**
 * Detect writing context from domain URL.
 * This mirrors the detection in index.ts but returns our WritingContext type.
 */
export function detectWritingContext(domain?: string): WritingContext {
  if (!domain) return 'general';
  const d = domain.toLowerCase();

  // Chat
  if (
    d.includes('slack') ||
    d.includes('discord') ||
    d.includes('teams') ||
    d.includes('whatsapp') ||
    d.includes('telegram') ||
    d.includes('messenger')
  ) {
    return 'chat';
  }

  // Social
  if (
    d.includes('twitter') ||
    d.includes('x.com') ||
    d.includes('reddit') ||
    d.includes('facebook') ||
    d.includes('linkedin') ||
    d.includes('instagram') ||
    d.includes('threads') ||
    d.includes('mastodon') ||
    d.includes('bluesky')
  ) {
    return 'social';
  }

  // Email
  if (
    d.includes('mail.google') ||
    d.includes('outlook') ||
    d.includes('yahoo') ||
    d.includes('proton') ||
    d.includes('zoho') ||
    d.includes('fastmail')
  ) {
    return 'email';
  }

  // Academic
  if (
    d.includes('overleaf') ||
    d.includes('arxiv') ||
    d.includes('scholar.google') ||
    d.includes('academia.edu') ||
    d.includes('researchgate')
  ) {
    return 'academic';
  }

  // Technical
  if (
    d.includes('github') ||
    d.includes('gitlab') ||
    d.includes('stackoverflow') ||
    d.includes('stackexchange') ||
    d.includes('bitbucket') ||
    d.includes('codepen') ||
    d.includes('replit') ||
    d.includes('jsfiddle') ||
    d.includes('codesandbox')
  ) {
    return 'technical';
  }

  // Document
  if (
    d.includes('docs.google') ||
    d.includes('notion') ||
    d.includes('coda.io') ||
    d.includes('dropbox') ||
    d.includes('quip') ||
    d.includes('confluence') ||
    d.includes('sharepoint') ||
    d.includes('office.com') ||
    d.includes('word')
  ) {
    return 'document';
  }

  return 'general';
}

/**
 * Get a summary of how many rules are active per context.
 * Useful for debugging and the API response.
 */
export function getContextSummary(rules: Rule[]): Record<WritingContext, number> {
  const contexts: WritingContext[] = [
    'chat',
    'social',
    'email',
    'technical',
    'document',
    'academic',
    'general',
  ];
  const summary: Record<string, number> = {};

  for (const ctx of contexts) {
    summary[ctx] = filterRulesByContext(rules, ctx).length;
  }

  return summary as Record<WritingContext, number>;
}
