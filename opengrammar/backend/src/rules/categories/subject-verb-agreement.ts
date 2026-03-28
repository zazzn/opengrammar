import { createRegexRule, type Rule } from '../types.js';

/**
 * ════════════════════════════════════════════════════════
 *  Subject-Verb Agreement — SVA Module
 *  The #1 grammar error category worldwide.
 * ════════════════════════════════════════════════════════
 */
export const subjectVerbAgreementRules: Rule[] = [

  // ─── PLURAL PRONOUNS + WAS ───
  createRegexRule({
    id: 'SVA_they_was',
    category: 'grammar',
    pattern: /\bthey\s+was\b/i,
    suggestion: 'they were',
    reason: 'Use "were" with plural subjects: "they were".',
  }),
  createRegexRule({
    id: 'SVA_we_was',
    category: 'grammar',
    pattern: /\bwe\s+was\b/i,
    suggestion: 'we were',
    reason: 'Use "were" with plural subjects: "we were".',
  }),
  createRegexRule({
    id: 'SVA_you_was',
    category: 'grammar',
    pattern: /\byou\s+was\b/i,
    suggestion: 'you were',
    reason: 'Use "were" with "you": "you were".',
  }),

  // ─── 3RD PERSON SINGULAR: DON'T / DOESN'T ───
  createRegexRule({
    id: 'SVA_he_dont',
    category: 'grammar',
    pattern: /\b(he|she|it)\s+don'?t\b/i,
    suggestion: (m) => `${m[1]} doesn't`,
    reason: 'Use "doesn\'t" (not "don\'t") with he/she/it.',
  }),
  createRegexRule({
    id: 'SVA_name_dont',
    category: 'grammar',
    pattern: /\b(John|Jane|Mary|David|Sarah|Mike|Tom|Anna|Bob|Alice|Peter|Paul|Mark|Luke|James|Emma|Olivia|Liam|Noah|Sophia|Ava|student|teacher|manager|doctor|user|player|person|child|boy|girl|man|woman)\s+don'?t\b/i,
    suggestion: (m) => `${m[1]} doesn't`,
    reason: 'Use "doesn\'t" (not "don\'t") with a singular third-person subject.',
  }),

  // ─── 3RD PERSON SINGULAR: DO → DOES ───
  createRegexRule({
    id: 'SVA_he_do',
    category: 'grammar',
    pattern: /\b(he|she|it)\s+do\s+(not|well|better|worse|good|badly|much|little|more|less|anything|everything|nothing|something)\b/i,
    suggestion: (m) => `${m[1]} does ${m[2]}`,
    reason: 'Use "does" (not "do") with he/she/it.',
  }),

  // ─── SINGULAR INDEFINITE PRONOUNS + PLURAL VERB ───
  createRegexRule({
    id: 'SVA_everyone_have',
    category: 'grammar',
    pattern: /\b(everyone|everybody|someone|somebody|anyone|anybody|no one|nobody|each|either|neither)\s+have\b/i,
    suggestion: (m) => `${m[1]} has`,
    reason: `"${'"Everyone/somebody/each"'}" is singular. Use "has", not "have".`,
  }),
  createRegexRule({
    id: 'SVA_everyone_are',
    category: 'grammar',
    pattern: /\b(everyone|everybody|someone|somebody|anyone|anybody|nobody|each)\s+are\b/i,
    suggestion: (m) => `${m[1]} is`,
    reason: 'Indefinite pronouns like "everyone" are singular. Use "is", not "are".',
  }),
  createRegexRule({
    id: 'SVA_everyone_were',
    category: 'grammar',
    pattern: /\b(everyone|everybody|someone|somebody|anyone|anybody|nobody|each)\s+were\b(?!\s+to\b)/i,
    suggestion: (m) => `${m[1]} was`,
    reason: 'Indefinite pronouns like "everyone" are singular. Use "was", not "were".',
  }),

  // ─── NEITHER/EITHER + OF + PLURAL + PLURAL VERB ───
  createRegexRule({
    id: 'SVA_neither_of_are',
    category: 'grammar',
    pattern: /\b(neither|either)\s+of\s+(them|us|the\s+\w+)\s+are\b/i,
    suggestion: (m) => `${m[1]} of ${m[2]} is`,
    reason: '"Neither of" and "either of" take a singular verb.',
  }),
  createRegexRule({
    id: 'SVA_neither_of_were',
    category: 'grammar',
    pattern: /\b(neither|either)\s+of\s+(them|us|the\s+\w+)\s+were\b/i,
    suggestion: (m) => `${m[1]} of ${m[2]} was`,
    reason: '"Neither of" and "either of" take a singular verb.',
  }),
  createRegexRule({
    id: 'SVA_neither_of_have',
    category: 'grammar',
    pattern: /\b(neither|either)\s+of\s+(them|us|the\s+\w+)\s+have\b/i,
    suggestion: (m) => `${m[1]} of ${m[2]} has`,
    reason: '"Neither of" and "either of" take a singular verb.',
  }),

  // ─── EACH OF + PLURAL NOUN + PLURAL VERB ───
  createRegexRule({
    id: 'SVA_each_of_are',
    category: 'grammar',
    pattern: /\beach\s+of\s+(?:the\s+)?\w+\s+are\b/i,
    suggestion: (m) => m[0].replace(/\bare\b/, 'is'),
    reason: '"Each of" takes a singular verb.',
  }),

  // ─── "-ICS" NOUNS (always singular) ───
  createRegexRule({
    id: 'SVA_ics_are',
    category: 'grammar',
    pattern: /\b(mathematics|physics|economics|statistics|politics|athletics|ethics|genetics|linguistics|acoustics|aesthetics|electronics|gymnastics|cybernetics|robotics|phonetics|semantics|logistics)\s+are\b/i,
    suggestion: (m) => `${m[1]} is`,
    reason: `"${'"Mathematics/physics/economics"'}" and other -ics subjects are treated as singular.`,
  }),

  // ─── COLLECTIVE NOUNS (British vs American) ───
  createRegexRule({
    id: 'SVA_collective_is',
    category: 'grammar',
    pattern: /\b(the\s+)?(team|committee|board|jury|class|staff|faculty|government|army|club|crowd|family|audience|group|company|council|parliament|senate|congress|cabinet|band|crew|squad|panel)\s+are\b/i,
    suggestion: (m) => `${m[1] || ''}${m[2]} is`,
    reason: 'In American English, collective nouns like "team" and "committee" take a singular verb.',
  }),

  // ─── NEWS / DATA / SERIES (singular-only nouns) ───
  createRegexRule({
    id: 'SVA_news_are',
    category: 'grammar',
    pattern: /\b(the\s+)?news\s+are\b/i,
    suggestion: (m) => `${m[1] || ''}news is`,
    reason: '"News" is singular. Use "is", not "are".',
  }),
  createRegexRule({
    id: 'SVA_series_are',
    category: 'grammar',
    pattern: /\bthe\s+series\s+are\b/i,
    suggestion: 'the series is',
    reason: '"Series" is singular (not plural). Use "is".',
  }),
  createRegexRule({
    id: 'SVA_species_are',
    category: 'grammar',
    pattern: /\bthe\s+species\s+are\b/i,
    suggestion: 'the species is',
    reason: '"Species" is singular. Use "is".',
  }),

  // ─── THERE IS/ARE AGREEMENT ───
  createRegexRule({
    id: 'SVA_there_is_plural',
    category: 'grammar',
    pattern: /\bthere\s+is\s+(many|several|a\s+few|multiple|numerous|various|countless|different)\s+\w+s\b/i,
    suggestion: (m) => m[0].replace(/\bthere\s+is\b/, 'there are'),
    reason: 'Use "there are" before plural nouns.',
  }),
  createRegexRule({
    id: 'SVA_there_are_singular',
    category: 'grammar',
    pattern: /\bthere\s+are\s+(a|an|one|the)\s+\w+\b(?!\s*s\b)/i,
    suggestion: (m) => m[0].replace(/\bthere\s+are\b/, 'there is'),
    reason: 'Use "there is" before singular nouns.',
  }),

  // ─── 3RD PERSON SINGULAR: MISSING -S ───
  // (Common high-frequency verbs only to avoid false positives)
  createRegexRule({
    id: 'SVA_he_go',
    category: 'grammar',
    pattern: /\b(he|she|it)\s+go\s+to\b/i,
    suggestion: (m) => `${m[1]} goes to`,
    reason: 'With he/she/it, add -s to the verb: "goes".',
  }),
  createRegexRule({
    id: 'SVA_he_come',
    category: 'grammar',
    pattern: /\b(he|she|it)\s+come\s+(to|from|here|there|back|in|out|home|every|each)\b/i,
    suggestion: (m) => `${m[1]} comes ${m[2]}`,
    reason: 'With he/she/it, add -s to the verb: "comes".',
  }),
  createRegexRule({
    id: 'SVA_he_have',
    category: 'grammar',
    pattern: /\b(he|she|it)\s+have\b(?!\s+(been|had|done|come|gone|made|taken|given|seen|known|got))/i,
    suggestion: (m) => `${m[1]} has`,
    reason: 'With he/she/it, use "has" not "have".',
  }),
  createRegexRule({
    id: 'SVA_he_do_verb',
    category: 'grammar',
    pattern: /\b(he|she|it)\s+do\b(?!\s+not\b)/i,
    suggestion: (m) => `${m[1]} does`,
    reason: 'With he/she/it, use "does" not "do".',
  }),
];
