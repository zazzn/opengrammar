import { createRegexRule, type Rule } from '../types.js';

export const basicGrammarRules: Rule[] = [
  createRegexRule({
    id: 'subject-pronouns',
    category: 'grammar',
    pattern: /\b(me|him|her|them|us)\s+and\s+(I|he|she|they|we)\b/i,
    suggestion: (match) => match[0].replace(/\b(me|him|her|them|us)\s+and\s+(I|he|she|they|we)\b/i, '$2 and $1'),
    reason: 'Use subject pronouns (I, he, she, they, we) when they are part of the subject.'
  }),
  createRegexRule({
    id: 'me-and-him',
    category: 'grammar',
    pattern: /\b(me\s+and\s+him|him\s+and\s+me)\b/i,
    suggestion: 'he and I',
    reason: 'When acting as the subject, use "He and I".'
  }),
  createRegexRule({
    id: 'me-and-her',
    category: 'grammar',
    pattern: /\b(me\s+and\s+her|her\s+and\s+me)\b/i,
    suggestion: 'she and I',
    reason: 'When acting as the subject, use "She and I".'
  }),
  createRegexRule({
    id: 'beside-you-and-i',
    category: 'grammar',
    pattern: /\bbeside\s+you\s+and\s+I\b/i,
    suggestion: 'beside you and me',
    reason: 'Use object pronouns after prepositions ("between you and me").'
  }),
  createRegexRule({
    id: 'between-you-and-i',
    category: 'grammar',
    pattern: /\bbetween\s+you\s+and\s+I\b/i,
    suggestion: 'between you and me',
    reason: 'Use object pronouns after prepositions ("between you and me").'
  }),
  createRegexRule({
    id: 'arrived-to',
    category: 'grammar',
    pattern: /\barrived\s+to\b/i,
    suggestion: 'arrived in / at',
    reason: 'Use "arrived in" for cities/countries and "arrived at" for specific places/events.'
  }),
  createRegexRule({
    id: 'could-care-less',
    category: 'grammar',
    pattern: /\bcould\s+care\s+less\b/i,
    suggestion: "couldn't care less",
    reason: 'The idiom is "couldn\'t care less" (meaning you care zero percent).'
  }),
  createRegexRule({
    id: 'on-accident',
    category: 'grammar',
    pattern: /\bon\s+accident\b/i,
    suggestion: 'by accident',
    reason: 'The correct idiom is "by accident", not "on accident".'
  }),
  createRegexRule({
    id: 'based-off-of',
    category: 'grammar',
    pattern: /\bbased\s+off\s+of\b/i,
    suggestion: 'based on',
    reason: 'Use "based on" instead of "based off of".'
  }),
  createRegexRule({
    id: 'intents-purposes',
    category: 'grammar',
    pattern: /\bfor\s+all\s+intensive\s+purposes\b/i,
    suggestion: 'for all intents and purposes',
    reason: 'The correct idiom is "for all intents and purposes".'
  }),
  createRegexRule({
    id: 'alot',
    category: 'spelling',
    pattern: /\balot\b/i,
    suggestion: 'a lot',
    reason: '"A lot" is always two words.'
  }),
  createRegexRule({
    id: 'object-pronouns',
    category: 'grammar',
    pattern: /\b(I|he|she|they|we)\s+and\s+(me|him|her|them|us)\b/i,
    suggestion: (match) => match[0].replace(/\b(I|he|she|they|we)\s+and\s+(me|him|her|them|us)\b/i, '$2 and $1'),
    reason: 'Use object pronouns (me, him, her, them, us) when they are part of the object.'
  }),
  createRegexRule({ id: 'buyed', category: 'grammar', pattern: /\bbuyed\b/i, suggestion: 'bought', reason: '"Buyed" is not a word. The past tense of "buy" is "bought".' }),
  createRegexRule({ id: 'runned', category: 'grammar', pattern: /\brunned\b/i, suggestion: 'ran', reason: '"Runned" is not a word. The past tense of "run" is "ran".' }),
  createRegexRule({ id: 'goed', category: 'grammar', pattern: /\bgoed\b/i, suggestion: 'went', reason: '"Goed" is not a word. The past tense of "go" is "went".' }),
  createRegexRule({ id: 'eated', category: 'grammar', pattern: /\beated\b/i, suggestion: 'ate', reason: '"Eated" is not a word. The past tense of "eat" is "ate".' }),
  createRegexRule({ id: 'comed', category: 'grammar', pattern: /\bcomed\b/i, suggestion: 'came', reason: '"Comed" is not a word. The past tense of "come" is "came".' }),
  createRegexRule({ id: 'taked', category: 'grammar', pattern: /\btaked\b/i, suggestion: 'took', reason: '"Taked" is not a word. The past tense of "take" is "took".' }),
  createRegexRule({ id: 'bringed', category: 'grammar', pattern: /\bbringed\b/i, suggestion: 'brought', reason: '"Bringed" is not a word. The past tense of "bring" is "brought".' }),
  createRegexRule({ id: 'thinked', category: 'grammar', pattern: /\bthinked\b/i, suggestion: 'thought', reason: '"Thinked" is not a word. The past tense of "think" is "thought".' }),
  createRegexRule({ id: 'knowed', category: 'grammar', pattern: /\bknowed\b/i, suggestion: 'knew', reason: '"Knowed" is not a word. The past tense of "know" is "knew".' }),
  createRegexRule({ id: 'has-got', category: 'grammar', pattern: /\bhas\s+got\b/i, suggestion: 'has', reason: '"Has got" is redundant. Use "has" instead.' }),
  createRegexRule({ id: 'having-got', category: 'grammar', pattern: /\bhaving\s+got\b/i, suggestion: 'have', reason: '"Having got" is awkward. Use "have" instead.' }),
  createRegexRule({ id: 'wanna', category: 'grammar', pattern: /\bwanna\b/i, suggestion: 'want to', reason: '"Wanna" is informal. Use "want to" in formal writing.' }),
  createRegexRule({ id: 'gotta', category: 'grammar', pattern: /\bgotta\b/i, suggestion: 'have to', reason: '"Gotta" is informal. Use "have to" in formal writing.' }),
  createRegexRule({ id: 'kinda', category: 'grammar', pattern: /\bkinda\b/i, suggestion: 'kind of', reason: '"Kinda" is informal. Use "kind of" in formal writing.' }),
  createRegexRule({ id: 'could-of', category: 'grammar', pattern: /\bcould\s+of\b/i, suggestion: 'could have', reason: '"Could of" is incorrect. Use "could have".' }),
  createRegexRule({ id: 'would-of', category: 'grammar', pattern: /\bwould\s+of\b/i, suggestion: 'would have', reason: '"Would of" is incorrect. Use "would have".' }),
  createRegexRule({ id: 'should-of', category: 'grammar', pattern: /\bshould\s+of\b/i, suggestion: 'should have', reason: '"Should of" is incorrect. Use "should have".' }),
  createRegexRule({ id: 'might-of', category: 'grammar', pattern: /\bmight\s+of\b/i, suggestion: 'might have', reason: '"Might of" is incorrect. Use "might have".' }),
  createRegexRule({ id: 'must-of', category: 'grammar', pattern: /\bmust\s+of\b/i, suggestion: 'must have', reason: '"Must of" is incorrect. Use "must have".' }),
  createRegexRule({ id: 'shouldnt-missing-apos', category: 'grammar', pattern: /\bshouldnt\b/i, suggestion: "shouldn't", reason: 'Missing apostrophe.' }),
  createRegexRule({ id: 'couldnt-missing-apos', category: 'grammar', pattern: /\bcouldnt\b/i, suggestion: "couldn't", reason: 'Missing apostrophe.' }),
  createRegexRule({ id: 'wouldnt-missing-apos', category: 'grammar', pattern: /\bwouldnt\b/i, suggestion: "wouldn't", reason: 'Missing apostrophe.' }),
  createRegexRule({ id: 'didnt-missing-apos', category: 'grammar', pattern: /\bdidnt\b/i, suggestion: "didn't", reason: 'Missing apostrophe.' }),
  createRegexRule({ id: 'doesnt-missing-apos', category: 'grammar', pattern: /\bdoesnt\b/i, suggestion: "doesn't", reason: 'Missing apostrophe.' }),
  createRegexRule({ id: 'isnt-missing-apos', category: 'grammar', pattern: /\bisnt\b/i, suggestion: "isn't", reason: 'Missing apostrophe.' }),
  createRegexRule({ id: 'arent-missing-apos', category: 'grammar', pattern: /\barent\b/i, suggestion: "aren't", reason: 'Missing apostrophe.' }),
  createRegexRule({ id: 'wasnt-missing-apos', category: 'grammar', pattern: /\bwasnt\b/i, suggestion: "wasn't", reason: 'Missing apostrophe.' }),
  createRegexRule({ id: 'werent-missing-apos', category: 'grammar', pattern: /\bwerent\b/i, suggestion: "weren't", reason: 'Missing apostrophe.' }),
];
