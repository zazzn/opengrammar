import { createRegexRule, type Rule } from '../types.js';

/**
 * ════════════════════════════════════════════════════════
 *  Article Rules — ART Module
 *  a/an distinction + missing articles + extra articles
 * ════════════════════════════════════════════════════════
 */
export const articleRules: Rule[] = [

  // ─── A vs AN (vowel sound rule) ───
  createRegexRule({
    id: 'ART_a_vowel',
    category: 'grammar',
    // a before words starting with vowel SOUNDS (silent h)
    pattern: /\ba\s+(honest|hour|heir|honor|honour|honorable|honourable|hourly|honesty|herb(\s|$))/i,
    suggestion: (m) => `an ${m[1]}`,
    reason: 'Use "an" before words with a vowel sound, including silent "h": "an honest person".',
  }),
  createRegexRule({
    id: 'ART_an_consonant',
    category: 'grammar',
    pattern: /\ban\s+(hero|historic|historical|hotel|hospital|holiday|horror|horrible|hundred|huge|human|habit|hat|head|heart|help|hill|home|hope|house|hustle|hand|horse|hard|heavy|high|happy|hot|hole|hire)\b/i,
    suggestion: (m) => `a ${m[1]}`,
    reason: 'Use "a" before words with a consonant sound (including aspirated "h"): "a hero", "a hotel".',
  }),
  createRegexRule({
    id: 'ART_an_unique',
    category: 'grammar',
    pattern: /\ban\s+(unique|user|union|uniform|united|unit|university|universe|usage|usual|utility|euro|European|euphemism|eulogy|ewe|one-)\b/i,
    suggestion: (m) => `a ${m[1]}`,
    reason: 'Use "a" before words starting with a "y" or "w" sound: "a unique", "a user".',
  }),

  // ─── DOUBLE ARTICLE ───
  createRegexRule({
    id: 'ART_double_the',
    category: 'grammar',
    pattern: /\bthe\s+the\b/i,
    suggestion: 'the',
    reason: 'Do not use "the" twice in a row.',
  }),
  createRegexRule({
    id: 'ART_double_a',
    category: 'grammar',
    pattern: /\ba\s+a\b/i,
    suggestion: 'a',
    reason: 'Do not repeat the article "a".',
  }),

  // ─── CONFUSED ITS / IT'S ───
  createRegexRule({
    id: 'ART_its_contraction',
    category: 'grammar',
    pattern: /\bIts\s+(a|an|the|going|been|been|time|not|never|just|only|still|already|been)\b/,
    suggestion: (m) => `It's ${m[1]}`,
    reason: '"It\'s" (with apostrophe) is a contraction of "it is". "Its" is the possessive.',
  }),
  createRegexRule({
    id: 'ART_its_contraction_lower',
    category: 'grammar',
    pattern: /\bits\s+(a|an|going|been|not|never|just|only|still|already|impossible|possible|clear|obvious|true|false|fine|okay|great|amazing|terrible|wonderful|awful|strange|weird|funny)\b/i,
    suggestion: (m) => `it's ${m[1]}`,
    reason: '"It\'s" (with apostrophe) is "it is". "Its" without apostrophe is the possessive.',
  }),

  // ─── THERE vs THEY'RE ───
  createRegexRule({
    id: 'ART_there_theyre',
    category: 'grammar',
    pattern: /\bThere\s+(going|coming|trying|waiting|planning|hoping|thinking|running|standing|sitting|looking|moving|working|playing|staying|leaving|arriving|calling|asking|telling|showing|helping|taking|making|doing)\b/,
    suggestion: (m) => `They're ${m[1]}`,
    reason: '"They\'re" means "they are". "There" refers to a place.',
  }),
  createRegexRule({
    id: 'ART_there_theyre_lower',
    category: 'grammar',
    pattern: /\bthere\s+(going\s+to|coming\s+to|trying\s+to|waiting\s+for|planning\s+to|hoping\s+to)\b/i,
    suggestion: (m) => `they're ${m[1]}`,
    reason: '"They\'re" (they are) is different from "there" (a place) and "their" (possessive).',
  }),

  // ─── THEIR vs THERE ───
  createRegexRule({
    id: 'ART_their_there',
    category: 'grammar',
    pattern: /\bTheir\s+(were|was|is|are|has|have|had|will|would|could|should|might|may|must|can)\s+/,
    suggestion: (m) => `There ${m[1]} `,
    reason: '"There" refers to a location or introduces sentences. "Their" shows possession.',
  }),
  createRegexRule({
    id: 'ART_their_there_lower',
    category: 'grammar',
    pattern: /\btheir\s+were\b/i,
    suggestion: 'there were',
    reason: '"There were" uses "there" (place/existence), not "their" (possessive).',
  }),

  // ─── PASSED vs PAST ───
  createRegexRule({
    id: 'ART_past_vs_passed',
    category: 'grammar',
    pattern: /\bshe\s+past\s+the\b/i,
    suggestion: 'she passed the',
    reason: '"Passed" is the verb (past tense of "pass"). "Past" is used as a preposition or noun.',
  }),
  createRegexRule({
    id: 'ART_past_exam',
    category: 'grammar',
    pattern: /\b(he|she|I|they|we|you)\s+past\s+(the\s+)?(exam|test|interview|inspection|review|check)\b/i,
    suggestion: (m) => `${m[1]} passed ${m[2] || ''}${m[3]}`,
    reason: '"Passed" (verb) is the past tense of "pass". "Past" is not a verb.',
  }),

  // ─── DOUBLE COMPARATIVE ───
  createRegexRule({
    id: 'ART_most_worst',
    category: 'grammar',
    pattern: /\bthe\s+most\s+worst\b/i,
    suggestion: 'the worst',
    reason: '"Worst" is already a superlative. Do not add "most".',
  }),
  createRegexRule({
    id: 'ART_more_prettier',
    category: 'grammar',
    pattern: /\bmore\s+(prettier|cleverer|wittier|funnier|happier|sadder|madder|thinner|fatter|taller|shorter|softer|harder|faster|slower|louder|quieter|richer|poorer|larger|smaller|bigger|younger|older|smarter|wiser|braver|kinder|nicer|sweeter)\b/i,
    suggestion: (m) => m[1],
    reason: `"${'"more prettier"'}" is a double comparative. "${'"Prettier"'}" is already the comparative form.`,
  }),

  // ─── REDUNDANT WORDS ───
  createRegexRule({
    id: 'ART_currently_now',
    category: 'clarity',
    pattern: /\bcurrently\s+now\b/i,
    suggestion: 'currently',
    reason: '"Currently" and "now" are redundant together. Use one.',
  }),
  createRegexRule({
    id: 'ART_rsvp_please',
    category: 'clarity',
    pattern: /\bplease\s+RSVP\b/i,
    suggestion: 'RSVP',
    reason: '"RSVP" already means "please respond" (répondez s\'il vous plaît). "Please RSVP" is redundant.',
  }),
  createRegexRule({
    id: 'ART_rsvp_to',
    category: 'clarity',
    pattern: /\bRSVP\s+to\s+(?:this|the)\s+(?:event|invitation|party|meeting)\b/i,
    suggestion: (m) => m[0].replace(/RSVP\s+to/, 'RSVP for'),
    reason: 'RSVP does not need "to" in formal usage.',
  }),
  createRegexRule({
    id: 'ART_nodded_head',
    category: 'clarity',
    pattern: /\bnodded\s+(?:his|her|their|my|your|our)\s+head\b/i,
    suggestion: 'nodded',
    reason: '"Nodded" implies a head movement. "Nodded his head" is redundant.',
  }),
];
