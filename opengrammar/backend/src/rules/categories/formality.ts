import type { Issue } from '../../shared-types.js';
import { createRegexRule, type Rule } from '../types.js';

/**
 * ═══════════════════════════════════════════════════
 *  Formality & Register (FR)
 *  Detect informal language in formal contexts
 * ═══════════════════════════════════════════════════
 */
export const formalityRules: Rule[] = [
  // ═══ Informal Contractions ═══
  createRegexRule({
    id: 'FR_gonna',
    category: 'style',
    pattern: /\bgonna\b/i,
    suggestion: 'going to',
    reason: '"Gonna" is informal. Use "going to" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_wanna',
    category: 'style',
    pattern: /\bwanna\b/i,
    suggestion: 'want to',
    reason: '"Wanna" is informal. Use "want to" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_gotta',
    category: 'style',
    pattern: /\bgotta\b/i,
    suggestion: 'have to',
    reason: '"Gotta" is informal. Use "have to" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_kinda',
    category: 'style',
    pattern: /\bkinda\b/i,
    suggestion: 'kind of',
    reason: '"Kinda" is informal. Use "kind of" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_sorta',
    category: 'style',
    pattern: /\bsorta\b/i,
    suggestion: 'sort of',
    reason: '"Sorta" is informal. Use "sort of" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_lemme',
    category: 'style',
    pattern: /\blemme\b/i,
    suggestion: 'let me',
    reason: '"Lemme" is informal. Use "let me" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_gimme',
    category: 'style',
    pattern: /\bgimme\b/i,
    suggestion: 'give me',
    reason: '"Gimme" is informal. Use "give me" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_dunno',
    category: 'style',
    pattern: /\bdunno\b/i,
    suggestion: "don't know",
    reason: '"Dunno" is informal. Use "don\'t know" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_outta',
    category: 'style',
    pattern: /\boutta\b/i,
    suggestion: 'out of',
    reason: '"Outta" is informal. Use "out of" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_aint',
    category: 'style',
    pattern: /\bain't\b/i,
    suggestion: "isn't / aren't / am not",
    reason: '"Ain\'t" is nonstandard. Use "isn\'t", "aren\'t", or "am not".',
  }),
  createRegexRule({
    id: 'FR_lotsa',
    category: 'style',
    pattern: /\blotsa\b/i,
    suggestion: 'lots of',
    reason: '"Lotsa" is informal. Use "lots of" or "many" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_coulda',
    category: 'style',
    pattern: /\bcoulda\b/i,
    suggestion: 'could have',
    reason: '"Coulda" is informal. Use "could have" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_shoulda',
    category: 'style',
    pattern: /\bshoulda\b/i,
    suggestion: 'should have',
    reason: '"Shoulda" is informal. Use "should have" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_woulda',
    category: 'style',
    pattern: /\bwoulda\b/i,
    suggestion: 'would have',
    reason: '"Woulda" is informal. Use "would have" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_musta',
    category: 'style',
    pattern: /\bmusta\b/i,
    suggestion: 'must have',
    reason: '"Musta" is informal. Use "must have" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_hafta',
    category: 'style',
    pattern: /\bhafta\b/i,
    suggestion: 'have to',
    reason: '"Hafta" is informal. Use "have to" in formal writing.',
  }),

  // ═══ Informal Words ═══
  createRegexRule({
    id: 'FR_stuff',
    category: 'style',
    pattern: /\b(a\s+lot\s+of|some|this|that|other|more|enough)\s+stuff\b/i,
    suggestion: (m) => `${m[1]} material`,
    reason: '"Stuff" is vague and informal. Be specific about what you mean.',
  }),
  createRegexRule({
    id: 'FR_things',
    category: 'style',
    pattern: /\b(a\s+lot\s+of|many|some|several|few|these|those|other)\s+things\b/i,
    suggestion: (m) => `${m[1]} items`,
    reason: '"Things" is vague. Be specific about what you\'re referring to.',
  }),
  createRegexRule({
    id: 'FR_ok_informal',
    category: 'style',
    pattern: /\b(ok|okay)\b(?=\s*[,.])/i,
    suggestion: 'acceptable',
    reason:
      '"OK" / "okay" is informal. Use "acceptable", "satisfactory", or "fine" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_awesome',
    category: 'style',
    pattern: /\b(pretty|really|so|very|totally)\s+awesome\b/i,
    suggestion: (m) => `${m[1]} impressive`,
    reason: '"Awesome" is informal. Use "impressive", "excellent", or "remarkable".',
  }),
  createRegexRule({
    id: 'FR_totally',
    category: 'style',
    pattern: /\btotally\s+(agree|understand|get|see|know|love|hate|need|want)\b/i,
    suggestion: (m) => `completely ${m[1]}`,
    reason: '"Totally" is informal as an intensifier. Use "completely" or "entirely".',
  }),
  createRegexRule({
    id: 'FR_super',
    category: 'style',
    pattern:
      /\bsuper\s+(good|nice|easy|hard|fast|slow|big|small|important|helpful|excited|happy|cool|great)\b/i,
    suggestion: (m) => `very ${m[1]}`,
    reason: '"Super" as an intensifier is informal. Use "very", "extremely", or "remarkably".',
  }),
  createRegexRule({
    id: 'FR_tons_of',
    category: 'style',
    pattern: /\btons\s+of\b/i,
    suggestion: 'a great deal of',
    reason: '"Tons of" is informal. Use "a great deal of" or "many".',
  }),
  createRegexRule({
    id: 'FR_get_rid',
    category: 'style',
    pattern: /\bget\s+rid\s+of\b/i,
    suggestion: 'eliminate',
    reason: '"Get rid of" is informal. Use "eliminate", "remove", or "discard".',
  }),
  createRegexRule({
    id: 'FR_a_lot',
    category: 'style',
    pattern: /\ba\s+lot\b(?=\s+of|\s*[,.])/i,
    suggestion: 'many / much / significantly',
    reason:
      '"A lot" is informal. Use "many" (countable), "much" (uncountable), or "significantly".',
  }),
  createRegexRule({
    id: 'FR_kids_informal',
    category: 'style',
    pattern: /\bkids\b/i,
    suggestion: 'children',
    reason: '"Kids" is informal. Use "children" in formal writing.',
  }),

  // ═══ Slang & Abbreviations ═══
  createRegexRule({
    id: 'FR_ASAP',
    category: 'style',
    pattern: /\bASAP\b/,
    suggestion: 'as soon as possible',
    reason: '"ASAP" is informal. Spell out "as soon as possible" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_btw',
    category: 'style',
    pattern: /\bbtw\b/i,
    suggestion: 'by the way',
    reason: '"BTW" is texting slang. Use "by the way" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_tbh',
    category: 'style',
    pattern: /\btbh\b/i,
    suggestion: 'to be honest',
    reason: '"TBH" is texting slang. Use "to be honest" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_fyi',
    category: 'style',
    pattern: /\bfyi\b/i,
    suggestion: 'for your information',
    reason: '"FYI" is informal. Use "for your information" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_wrt',
    category: 'style',
    pattern: /\bwrt\b/i,
    suggestion: 'with regard to',
    reason: '"WRT" is informal. Use "with regard to" or "regarding".',
  }),
  createRegexRule({
    id: 'FR_imo',
    category: 'style',
    pattern: /\bimo\b/i,
    suggestion: 'in my opinion',
    reason: '"IMO" is texting slang. Use "in my opinion" in formal writing.',
  }),
  createRegexRule({
    id: 'FR_lol',
    category: 'style',
    pattern: /\blol\b/i,
    suggestion: '(remove)',
    reason: '"LOL" is texting slang and inappropriate in formal writing.',
  }),
  createRegexRule({
    id: 'FR_omg',
    category: 'style',
    pattern: /\bomg\b/i,
    suggestion: '(remove)',
    reason: '"OMG" is texting slang and inappropriate in formal writing.',
  }),
  createRegexRule({
    id: 'FR_ngl',
    category: 'style',
    pattern: /\bngl\b/i,
    suggestion: 'honestly',
    reason: '"NGL" is texting slang. Use "honestly" or remove entirely.',
  }),

  // ═══ Second Person in Formal/Academic ═══
  createRegexRule({
    id: 'FR_you_formal',
    category: 'style',
    pattern: /\byou\s+(should|must|need|have\s+to|can|will|would|could|might|may)\b/i,
    suggestion: (m) => `one ${m[1]}`,
    reason:
      'Second person ("you") is often avoided in formal/academic writing. Consider "one" or a passive construction.',
  }),
];
