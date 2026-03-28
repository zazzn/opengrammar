import { createRegexRule, type Rule } from '../types.js';

/**
 * ════════════════════════════════════════════════════════
 *  Gerund vs Infinitive Rules — GI Module
 *  Modal Verb Errors — MV Module
 * ════════════════════════════════════════════════════════
 */
export const gerundInfinitiveRules: Rule[] = [

  // ═══════════════════════════════════════════════
  // MODAL VERBS: Cannot be followed by "to" + base
  // ═══════════════════════════════════════════════
  createRegexRule({
    id: 'MV_must_to',
    category: 'grammar',
    pattern: /\bmust\s+to\s+(\w+)/i,
    suggestion: (m) => `must ${m[1]}`,
    reason: 'Modal verbs (must, can, will, may, should) are followed by the base form without "to".',
  }),
  createRegexRule({
    id: 'MV_can_to',
    category: 'grammar',
    pattern: /\bcan\s+to\s+(\w+)/i,
    suggestion: (m) => `can ${m[1]}`,
    reason: '"Can" is a modal verb and is followed by the base form without "to".',
  }),
  createRegexRule({
    id: 'MV_will_to',
    category: 'grammar',
    pattern: /\bwill\s+to\s+(\w+)/i,
    suggestion: (m) => `will ${m[1]}`,
    reason: '"Will" is a modal verb and is followed by the base form without "to".',
  }),
  createRegexRule({
    id: 'MV_might_to',
    category: 'grammar',
    pattern: /\bmight\s+to\s+(\w+)/i,
    suggestion: (m) => `might ${m[1]}`,
    reason: '"Might" is a modal verb and is followed by the base form without "to".',
  }),
  createRegexRule({
    id: 'MV_may_to',
    category: 'grammar',
    pattern: /\bmay\s+to\s+(\w+)/i,
    suggestion: (m) => `may ${m[1]}`,
    reason: '"May" is a modal verb and is followed by the base form without "to".',
  }),
  createRegexRule({
    id: 'MV_would_to',
    category: 'grammar',
    pattern: /\bwould\s+to\s+(\w+)/i,
    suggestion: (m) => `would ${m[1]}`,
    reason: '"Would" is followed by the base form without "to".',
  }),
  createRegexRule({
    id: 'MV_could_to',
    category: 'grammar',
    pattern: /\bcould\s+to\s+(\w+)/i,
    suggestion: (m) => `could ${m[1]}`,
    reason: '"Could" is a modal verb and is followed by the base form without "to".',
  }),

  // ═══════════════════════════════════════════════
  // BE + ADJECTIVE (not "be + verb")
  // ═══════════════════════════════════════════════
  createRegexRule({
    id: 'GI_be_agree',
    category: 'grammar',
    pattern: /\b(am|is|are|was|were|be|been)\s+agree\b/i,
    suggestion: (m) => `${m[1]} in agreement`,
    reason: '"Agree" is a verb, not an adjective. Say "I agree" or "I am in agreement".',
  }),
  createRegexRule({
    id: 'GI_be_depend',
    category: 'grammar',
    pattern: /\b(am|is|are|was|were|be|been)\s+depend\b/i,
    suggestion: (m) => `${m[1]} dependent`,
    reason: 'Use "dependent on" not "depend on" after the verb "be".',
  }),

  // ═══════════════════════════════════════════════
  // VERBS THAT REQUIRE GERUND (not TO + infinitive)
  // ═══════════════════════════════════════════════

  // avoid
  createRegexRule({
    id: 'GI_avoid_to',
    category: 'grammar',
    pattern: /\bavoid\s+to\s+(\w+)/i,
    suggestion: (m) => `avoid ${m[1]}ing`,
    reason: '"Avoid" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // enjoy
  createRegexRule({
    id: 'GI_enjoy_to',
    category: 'grammar',
    pattern: /\benjoy\s+to\s+(\w+)/i,
    suggestion: (m) => `enjoy ${m[1]}ing`,
    reason: '"Enjoy" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // suggest
  createRegexRule({
    id: 'GI_suggest_to',
    category: 'grammar',
    pattern: /\bsuggested?\s+to\s+(?!him\b|her\b|them\b|me\b|us\b|you\b|him|her|them|me|us|you)(\w+)/i,
    suggestion: (m) => `suggest${m[0].match(/suggested/) ? 'ed' : ''} ${m[1]}ing`,
    reason: '"Suggest" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // consider
  createRegexRule({
    id: 'GI_consider_to',
    category: 'grammar',
    pattern: /\bconsidered?\s+to\s+(?!be\b|have\b)(\w+)/i,
    suggestion: (m) => `consider${m[0].match(/considered/) ? 'ed' : ''} ${m[1]}ing`,
    reason: '"Consider" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // keep
  createRegexRule({
    id: 'GI_keep_to',
    category: 'grammar',
    pattern: /\bkept\s+to\s+(\w+(?:ing)?)\b(?!\s+(the|a|an|his|her|their|our|my|your)\b)/i,
    suggestion: (m) => `kept ${m[1].endsWith('ing') ? m[1] : m[1] + 'ing'}`,
    reason: '"Keep" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // admit
  createRegexRule({
    id: 'GI_admit_to_verb',
    category: 'grammar',
    pattern: /\badmitted?\s+to\s+(\w+(?:e)?)\b(?!\s+(the|a|an|it|him|her|them|us|me|you)\b)/i,
    suggestion: (m) => {
      const verb = m[1];
      const gerund = verb.endsWith('e') ? verb.slice(0, -1) + 'ing' : verb + 'ing';
      return `admit${m[0].match(/admitted/) ? 'ted' : ''} to ${gerund}`;
    },
    reason: '"Admit to" is followed by a gerund (-ing form).',
  }),

  // practice
  createRegexRule({
    id: 'GI_practice_to',
    category: 'grammar',
    pattern: /\bpractice\s+to\s+(\w+)/i,
    suggestion: (m) => `practice ${m[1]}ing`,
    reason: '"Practice" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // deny
  createRegexRule({
    id: 'GI_deny_to',
    category: 'grammar',
    pattern: /\bdenied?\s+to\s+(?!him\b|her\b|them\b|me\b|us\b|you\b)(\w+)/i,
    suggestion: (m) => `deni${m[0].match(/denied/) ? 'ed' : 'es'} ${m[1]}ing`,
    reason: '"Deny" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // resist
  createRegexRule({
    id: 'GI_resist_to',
    category: 'grammar',
    pattern: /\bresisted?\s+to\s+(\w+)/i,
    suggestion: (m) => `resisted ${m[1]}ing`,
    reason: '"Resist" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // finish
  createRegexRule({
    id: 'GI_finish_to',
    category: 'grammar',
    pattern: /\bfinished?\s+to\s+(\w+)/i,
    suggestion: (m) => `finish${m[0].match(/finished/) ? 'ed' : ''} ${m[1]}ing`,
    reason: '"Finish" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // mind
  createRegexRule({
    id: 'GI_mind_to',
    category: 'grammar',
    pattern: /\bminds?\s+to\s+(\w+)/i,
    suggestion: (m) => `mind ${m[1]}ing`,
    reason: '"Mind" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // miss
  createRegexRule({
    id: 'GI_miss_to',
    category: 'grammar',
    pattern: /\bmissed?\s+to\s+(\w+)/i,
    suggestion: (m) => `miss${m[0].match(/missed/) ? 'ed' : ''} ${m[1]}ing`,
    reason: '"Miss" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // quit
  createRegexRule({
    id: 'GI_quit_to',
    category: 'grammar',
    pattern: /\bquit\s+to\s+(\w+)/i,
    suggestion: (m) => `quit ${m[1]}ing`,
    reason: '"Quit" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // postpone / delay
  createRegexRule({
    id: 'GI_postpone_to',
    category: 'grammar',
    pattern: /\bpostponed?\s+to\s+(\w+)/i,
    suggestion: (m) => `postponed ${m[1]}ing`,
    reason: '"Postpone" is followed by a gerund (-ing form), not an infinitive.',
  }),
  createRegexRule({
    id: 'GI_delay_to',
    category: 'grammar',
    pattern: /\bdelayed?\s+to\s+(\w+)/i,
    suggestion: (m) => `delayed ${m[1]}ing`,
    reason: '"Delay" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // imagine
  createRegexRule({
    id: 'GI_imagine_to',
    category: 'grammar',
    pattern: /\bimagined?\s+to\s+(\w+)/i,
    suggestion: (m) => `imagined ${m[1]}ing`,
    reason: '"Imagine" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // risk
  createRegexRule({
    id: 'GI_risk_to',
    category: 'grammar',
    pattern: /\brisked?\s+to\s+(\w+)/i,
    suggestion: (m) => `risked ${m[1]}ing`,
    reason: '"Risk" is followed by a gerund (-ing form), not an infinitive.',
  }),

  // cannot help
  createRegexRule({
    id: 'GI_cant_help_to',
    category: 'grammar',
    pattern: /\bcan'?t\s+help\s+to\s+(\w+)/i,
    suggestion: (m) => `can't help ${m[1]}ing`,
    reason: '"Cannot help" is followed by a gerund, not an infinitive.',
  }),

  // ═══════════════════════════════════════════════
  // SUBJUNCTIVE MOOD
  // ═══════════════════════════════════════════════
  createRegexRule({
    id: 'GI_if_i_was',
    category: 'grammar',
    pattern: /\bif\s+I\s+was\b(?!\s+able|\s+going|\s+supposed|\s+trying|\s+planning|\s+hoping|\s+thinking|\s+looking)/i,
    suggestion: 'if I were',
    reason: 'Use the subjunctive "were" (not "was") in hypothetical "if" clauses.',
  }),
  createRegexRule({
    id: 'GI_wish_i_was',
    category: 'grammar',
    pattern: /\bwish\s+(I|he|she|it)\s+was\b/i,
    suggestion: (m) => `wish ${m[1]} were`,
    reason: 'After "wish," use the subjunctive "were" instead of "was".',
  }),
  createRegexRule({
    id: 'GI_as_if_was',
    category: 'grammar',
    pattern: /\bas\s+if\s+(I|he|she|it|he|they)\s+was\b/i,
    suggestion: (m) => `as if ${m[1]} were`,
    reason: 'After "as if," use the subjunctive "were" instead of "was".',
  }),
];
