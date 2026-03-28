import { type Rule, createRegexRule } from '../types.js';
import type { Issue } from '../../shared-types.js';

export const sentenceStructureRules: Rule[] = [
  // ═══ Subject-Verb Agreement (SS_SVA) ═══

  // SS_SVA_001 — Singular subjects with plural verbs
  createRegexRule({ id: 'SS_SVA_001a', category: 'grammar', pattern: /\b(he|she|it)\s+(are|were|have|do|go|need|want|make|take|come|give|say|seem|know|think)\b/i, suggestion: (m) => `${m[1]} ${({'are':'is','were':'was','have':'has','do':'does','go':'goes','need':'needs','want':'wants','make':'makes','take':'takes','come':'comes','give':'gives','say':'says','seem':'seems','know':'knows','think':'thinks'} as Record<string,string>)[(m[2]||'').toLowerCase()] || m[2]}`, reason: 'Singular subject requires a singular verb.' }),

  // SS_SVA_003 — Indefinite pronouns + plural verbs
  createRegexRule({ id: 'SS_SVA_003a', category: 'grammar', pattern: /\b(everyone|someone|anybody|somebody|nobody|no\s+one|each|either|neither)\s+(are|were|have|do|go|seem|need|want)\b/i, suggestion: (m) => `${m[1]} ${({'are':'is','were':'was','have':'has','do':'does','go':'goes','seem':'seems','need':'needs','want':'wants'} as Record<string,string>)[(m[2]||'').toLowerCase()] || m[2]}`, reason: 'Indefinite pronouns (everyone, someone, each, neither, etc.) take singular verbs.' }),

  // SS_SVA_004 — Collective nouns (AmE singular)
  createRegexRule({ id: 'SS_SVA_004a', category: 'grammar', pattern: /\b(the\s+)?(team|committee|family|group|staff|jury|audience|crowd|class|government|company|board|council|panel)\s+(are|were|have|do)\b/i, suggestion: (m) => `${m[1]||''}${m[2]} ${({'are':'is','were':'was','have':'has','do':'does'} as Record<string,string>)[(m[3]||'').toLowerCase()] || m[3]}`, reason: 'Collective nouns take singular verbs in American English.' }),

  // SS_SVA_007 — There is/are agreement
  createRegexRule({ id: 'SS_SVA_007a', category: 'grammar', pattern: /\bthere\s+is\s+(many|several|numerous|various|multiple|two|three|four|five|six|seven|eight|nine|ten)\b/i, suggestion: (m) => `there are ${m[1]}`, reason: 'Use "are" with plural subjects after "there".' }),
  createRegexRule({ id: 'SS_SVA_007b', category: 'grammar', pattern: /\bthere\s+was\s+(many|several|numerous|various|multiple|two|three|four|five|six|seven|eight|nine|ten)\b/i, suggestion: (m) => `there were ${m[1]}`, reason: 'Use "were" with plural subjects after "there".' }),

  // ═══ Double Subjects (SS_DBS) ═══
  createRegexRule({ id: 'SS_DBS_001a', category: 'grammar', pattern: /\b(my\s+\w+|the\s+\w+)\s+(he|she|it|they)\s+(is|are|was|were|has|have|does|do|will|would|can|could|should|shall|might|must)\b/i, suggestion: (m) => `${m[1]} ${m[3]}`, reason: 'Redundant pronoun after noun subject. Remove the extra pronoun.' }),

  // ═══ Faulty Predication (SS_FPR) ═══
  createRegexRule({ id: 'SS_FPR_001', category: 'grammar', pattern: /\bthe\s+reason\s+(is|was)\s+because\b/i, suggestion: (m) => `the reason ${m[1]} that`, reason: '"The reason is because" is redundant. Use "the reason is that".' }),
  createRegexRule({ id: 'SS_FPR_002', category: 'grammar', pattern: /\b(the\s+problem|the\s+issue|the\s+question|the\s+difficulty)\s+(is|was)\s+(when|where|if)\b/i, suggestion: (m) => `${m[1]} ${m[2]} that`, reason: 'A noun subject should not be equated with an adverb clause. Use "that" instead.' }),

  // ═══ Parallel Structure with Correlatives (SS_PAR) ═══
  createRegexRule({ id: 'SS_PAR_not_only', category: 'grammar', pattern: /\bnot\s+only\s+(\w+)\s+but\s+also\s+is\s+(\w+ing)\b/i, suggestion: (m) => `not only ${m[1]} but also ${m[2]}`, reason: 'Correlative conjunctions require parallel structure.' }),
  createRegexRule({ id: 'SS_PAR_both_and', category: 'grammar', pattern: /\bboth\s+likes?\s+to\s+(\w+)\s+and\s+(\w+ing)\b/i, suggestion: (m) => `both ${m[1]}ing and ${m[2]}`, reason: 'Items in "both...and" must be parallel — use the same grammatical form.' }),
];
