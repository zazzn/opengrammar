import { type Rule, createRegexRule } from '../types.js';
import type { Issue } from '../../shared-types.js';

/**
 * ═══════════════════════════════════════════════════
 *  Commonly Confused Words (CW)
 *  Contextual detection of homophones & near-matches
 * ═══════════════════════════════════════════════════
 */
export const confusedWordsRules: Rule[] = [
  // ═══ affect vs effect ═══
  createRegexRule({ id: 'CW_affect_noun', category: 'grammar', pattern: /\b(a|an|the|this|that|its|no|any|great|big|huge|major|significant|positive|negative|profound|lasting|adverse|direct|indirect|overall|desired|intended|net|cumulative)\s+affect\b/i, suggestion: (m) => `${m[1]} effect`, reason: '"Affect" is usually a verb (to influence). The noun form is "effect" (a result).' }),
  createRegexRule({ id: 'CW_effect_verb', category: 'grammar', pattern: /\b(will|would|can|could|may|might|shall|should|did|does|do|didn't|doesn't|won't|cannot)\s+effect\s+(my|your|his|her|our|their|the|a|an|this|that)\b/i, suggestion: (m) => `${m[1]} affect ${m[2]}`, reason: '"Effect" as a verb means "to bring about". You likely mean "affect" (to influence).' }),

  // ═══ accept vs except ═══
  createRegexRule({ id: 'CW_except_verb', category: 'grammar', pattern: /\b(I|we|they|he|she|you|will|would|can|please)\s+except\s+(your|the|this|that|a|an|my|his|her|our|their)\s+(offer|invitation|apology|terms|conditions|proposal|gift|award|position|responsibility|challenge|nomination|request)\b/i, suggestion: (m) => `${m[1]} accept ${m[2]} ${m[3]}`, reason: '"Except" means "excluding". You likely mean "accept" (to receive).' }),
  createRegexRule({ id: 'CW_accept_prep', category: 'grammar', pattern: /\beveryone\s+accept\b/i, suggestion: 'everyone except', reason: '"Accept" means to receive. You likely mean "except" (excluding).' }),

  // ═══ loose vs lose ═══
  createRegexRule({ id: 'CW_loose_verb', category: 'grammar', pattern: /\b(will|would|can|could|might|may|don't|didn't|doesn't|won't|cannot|going\s+to|afraid\s+to|about\s+to|hate\s+to|want\s+to|don't\s+want\s+to)\s+loose\b/i, suggestion: (m) => `${m[1]} lose`, reason: '"Loose" means not tight. The verb meaning "to misplace/fail" is "lose".' }),
  createRegexRule({ id: 'CW_loose_money', category: 'grammar', pattern: /\bloose\s+(money|weight|hope|faith|interest|patience|sight|track|control|touch|time|ground|sleep|focus|balance|confidence|consciousness|grip|footing|temper|mind)\b/i, suggestion: (m) => `lose ${m[1]}`, reason: '"Loose" means not tight. You likely mean "lose" (to misplace/fail to keep).' }),

  // ═══ than vs then ═══
  createRegexRule({ id: 'CW_then_compare', category: 'grammar', pattern: /\b(more|less|better|worse|greater|fewer|higher|lower|bigger|smaller|faster|slower|older|younger|easier|harder|stronger|weaker|longer|shorter|wider|taller|cheaper|richer|smarter|nicer)\s+then\b/i, suggestion: (m) => `${m[1]} than`, reason: 'Use "than" for comparisons. "Then" refers to time.' }),
  createRegexRule({ id: 'CW_then_rather', category: 'grammar', pattern: /\brather\s+then\b/i, suggestion: 'rather than', reason: 'The correct phrase is "rather than", not "rather then".' }),
  createRegexRule({ id: 'CW_then_other', category: 'grammar', pattern: /\bother\s+then\b/i, suggestion: 'other than', reason: 'The correct phrase is "other than", not "other then".' }),

  // ═══ whose vs who's ═══
  createRegexRule({ id: 'CW_whos_poss', category: 'grammar', pattern: /\bwho's\s+(car|house|book|phone|computer|bag|dog|cat|idea|fault|problem|responsibility|job|turn|birthday|name|number|address)\b/i, suggestion: (m) => `whose ${m[1]}`, reason: '"Who\'s" means "who is" or "who has". For possession, use "whose".' }),
  createRegexRule({ id: 'CW_whose_contraction', category: 'grammar', pattern: /\bwhose\s+(going|coming|doing|making|getting|trying|looking|working|playing|running|been|is|are|was|the\s+one)\b/i, suggestion: (m) => `who's ${m[1]}`, reason: '"Whose" shows possession. You likely mean "who\'s" (who is/who has).' }),

  // ═══ weather vs whether ═══
  createRegexRule({ id: 'CW_weather_if', category: 'grammar', pattern: /\bweather\s+(or\s+not|I|you|he|she|it|we|they|the|this|that|to)\b/i, suggestion: (m) => `whether ${m[1]}`, reason: '"Weather" refers to climate. For "if", use "whether".' }),

  // ═══ dessert vs desert ═══
  createRegexRule({ id: 'CW_desert_food', category: 'grammar', pattern: /\b(for|ate|had|ordered|served|eating|delicious|chocolate|ice\s+cream|cake)\s+desert\b/i, suggestion: (m) => `${m[1]} dessert`, reason: '"Desert" is arid land. The sweet food is "dessert" (two s\'s — because you want more!).' }),

  // ═══ advise vs advice ═══
  createRegexRule({ id: 'CW_advice_verb', category: 'grammar', pattern: /\b(I|we|they|he|she|you|would|will|can|please|let\s+me|should)\s+advice\b/i, suggestion: (m) => `${m[1]} advise`, reason: '"Advice" is a noun. The verb form is "advise".' }),
  createRegexRule({ id: 'CW_advise_noun', category: 'grammar', pattern: /\b(some|good|bad|my|your|his|her|their|our|excellent|terrible|a\s+piece\s+of|any)\s+advise\b/i, suggestion: (m) => `${m[1]} advice`, reason: '"Advise" is a verb. The noun form is "advice".' }),

  // ═══ complement vs compliment ═══
  createRegexRule({ id: 'CW_compliment_enhance', category: 'grammar', pattern: /\b(perfectly|nicely|well)\s+compliments\b/i, suggestion: (m) => `${m[1]} complements`, reason: '"Compliment" means praise. "Complement" means to enhance/complete.' }),

  // ═══ principal vs principle ═══
  createRegexRule({ id: 'CW_principle_person', category: 'grammar', pattern: /\b(school|the)\s+principle\b/i, suggestion: (m) => `${m[1]} principal`, reason: 'The head of a school is the "principal". A "principle" is a rule or belief.' }),

  // ═══ ensure vs insure ═══
  createRegexRule({ id: 'CW_insure_certain', category: 'grammar', pattern: /\binsure\s+that\b/i, suggestion: 'ensure that', reason: '"Insure" means financial protection. For "make certain", use "ensure".' }),

  // ═══ elicit vs illicit ═══
  createRegexRule({ id: 'CW_illicit_verb', category: 'grammar', pattern: /\b(to|will|would|can|could|trying\s+to|designed\s+to|intended\s+to|meant\s+to)\s+illicit\b/i, suggestion: (m) => `${m[1]} elicit`, reason: '"Illicit" means illegal (adjective). The verb "to draw out" is "elicit".' }),

  // ═══ precede vs proceed ═══
  createRegexRule({ id: 'CW_proceed_before', category: 'grammar', pattern: /\bproceeds?\s+(the|a|this|each|every|any)\b/i, suggestion: (m) => `precedes ${m[1]}`, reason: '"Proceed" means to move forward. "Precede" means to come before.' }),

  // ═══ cite vs site ═══
  createRegexRule({ id: 'CW_site_reference', category: 'grammar', pattern: /\b(please|must|should|need\s+to|remember\s+to|don't\s+forget\s+to)\s+site\s+(the|your|this|a|an|all|every|each)\s+(source|reference|work|paper|article|study|author|book|evidence|example|data|finding|research|statistic|quote|passage)\b/i, suggestion: (m) => `${m[1]} cite ${m[2]} ${m[3]}`, reason: '"Site" is a location. To reference a source, use "cite".' }),

  // ═══ allusion vs illusion ═══
  createRegexRule({ id: 'CW_illusion_reference', category: 'grammar', pattern: /\b(made|makes?\s+an?|contains?\s+an?|biblical|literary|cultural|historical)\s+illusion\b/i, suggestion: (m) => `${m[1]} allusion`, reason: '"Illusion" is a false perception. An indirect reference is an "allusion".' }),

  // ═══ literally misuse ═══
  createRegexRule({ id: 'CW_literally', category: 'style', pattern: /\bliterally\s+(dying|exploding|on\s+fire|killing\s+me|the\s+best|the\s+worst|died|killed|melting|starving|freezing|screaming|crying|shaking|bursting|insane|crazy|dead)\b/i, suggestion: (m) => `figuratively ${m[1]}`, reason: '"Literally" means "actually/in reality". If you\'re using hyperbole, the word you want is "figuratively" — or simply drop "literally".' }),
];
