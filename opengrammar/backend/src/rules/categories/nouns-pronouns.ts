import type { Issue } from '../../shared-types.js';
import { createRegexRule, type Rule } from '../types.js';

export const nounsPronouns: Rule[] = [
  // ═══ Reflexive Pronoun Misuse (NP_REF) ═══
  createRegexRule({
    id: 'NP_REF_contact_myself',
    category: 'grammar',
    pattern: /\b(contact|call|email|reach|send|give|tell|ask|invite|notify|inform)\s+myself\b/i,
    suggestion: (m) => `${m[1]} me`,
    reason:
      'Don\'t use "myself" as a substitute for "me". Use "myself" only when you are both subject and object.',
  }),
  createRegexRule({
    id: 'NP_REF_myself_and',
    category: 'grammar',
    pattern: /\bmyself\s+and\s+(\w+)\b/i,
    suggestion: (m) => `${m[1]} and I`,
    reason: '"Myself and..." is incorrect. Use "...and I" as a subject.',
  }),
  createRegexRule({
    id: 'NP_REF_yourself_sub',
    category: 'grammar',
    pattern: /\b(contact|call|email|reach|send|give|tell|ask|invite|notify|inform)\s+yourself\b/i,
    suggestion: (m) => `${m[1]} you`,
    reason: 'Don\'t use "yourself" as a substitute for "you".',
  }),

  // ═══ Noun Countability Errors (NP_CNT) ═══
  ...[
    'information',
    'advice',
    'furniture',
    'equipment',
    'luggage',
    'baggage',
    'news',
    'progress',
    'research',
    'homework',
    'evidence',
    'knowledge',
    'traffic',
    'weather',
    'money',
    'music',
    'art',
    'luck',
    'fun',
    'happiness',
    'sadness',
    'anger',
    'software',
    'hardware',
    'feedback',
    'clothing',
    'scenery',
    'poetry',
    'machinery',
    'vocabulary',
  ].map((noun) =>
    createRegexRule({
      id: `NP_CNT_a_${noun}`,
      category: 'grammar',
      pattern: new RegExp(`\\b(a|an)\\s+${noun}\\b`, 'i'),
      suggestion: `some ${noun}`,
      reason: `"${noun.charAt(0).toUpperCase() + noun.slice(1)}" is uncountable. Do not use "a/an" with it. Use "some" or a quantifier instead.`,
    }),
  ),

  // Uncountable plurals
  ...[
    'informations',
    'advices',
    'furnitures',
    'equipments',
    'luggages',
    'knowledges',
    'evidences',
    'homeworks',
    'researches',
    'feedbacks',
    'hardwares',
    'softwares',
    'weathers',
    'moneys',
    'sceneries',
    'poetries',
    'vocabularies',
    'machineries',
    'clothings',
    'progresses',
    'traffics',
  ].map((plural) =>
    createRegexRule({
      id: `NP_CNT_plural_${plural}`,
      category: 'grammar',
      pattern: new RegExp(`\\b${plural}\\b`, 'i'),
      suggestion: plural.replace(/s$/, '').replace(/ies$/, 'y'),
      reason: `"${plural.replace(/s$/, '').replace(/ies$/, 'y').charAt(0).toUpperCase() + plural.replace(/s$/, '').replace(/ies$/, 'y').slice(1)}" is uncountable and should not be pluralized.`,
    }),
  ),

  // ═══ Irregular Plurals (NP_PLU) ═══
  createRegexRule({
    id: 'NP_PLU_childs',
    category: 'grammar',
    pattern: /\bchilds\b/i,
    suggestion: 'children',
    reason: 'The plural of "child" is "children", not "childs".',
  }),
  createRegexRule({
    id: 'NP_PLU_mans',
    category: 'grammar',
    pattern: /\bmans\b/i,
    suggestion: 'men',
    reason: 'The plural of "man" is "men", not "mans".',
  }),
  createRegexRule({
    id: 'NP_PLU_womans',
    category: 'grammar',
    pattern: /\bwomans\b/i,
    suggestion: 'women',
    reason: 'The plural of "woman" is "women", not "womans".',
  }),
  createRegexRule({
    id: 'NP_PLU_tooths',
    category: 'grammar',
    pattern: /\btooths\b/i,
    suggestion: 'teeth',
    reason: 'The plural of "tooth" is "teeth", not "tooths".',
  }),
  createRegexRule({
    id: 'NP_PLU_foots',
    category: 'grammar',
    pattern: /\bfoots\b/i,
    suggestion: 'feet',
    reason: 'The plural of "foot" is "feet", not "foots".',
  }),
  createRegexRule({
    id: 'NP_PLU_mouses',
    category: 'grammar',
    pattern: /\bmouses\b/i,
    suggestion: 'mice',
    reason: 'The plural of "mouse" is "mice", not "mouses".',
  }),
  createRegexRule({
    id: 'NP_PLU_gooses',
    category: 'grammar',
    pattern: /\bgooses\b/i,
    suggestion: 'geese',
    reason: 'The plural of "goose" is "geese", not "gooses".',
  }),
  createRegexRule({
    id: 'NP_PLU_oxes',
    category: 'grammar',
    pattern: /\boxes\b/i,
    suggestion: 'oxen',
    reason: 'The plural of "ox" is "oxen", not "oxes".',
  }),
  createRegexRule({
    id: 'NP_PLU_criterions',
    category: 'grammar',
    pattern: /\bcriterions\b/i,
    suggestion: 'criteria',
    reason: 'The plural of "criterion" is "criteria", not "criterions".',
  }),
  createRegexRule({
    id: 'NP_PLU_phenomenons',
    category: 'grammar',
    pattern: /\bphenomenons\b/i,
    suggestion: 'phenomena',
    reason: 'The plural of "phenomenon" is "phenomena", not "phenomenons".',
  }),

  // ═══ Determiner Errors (AD from Part 1) ═══
  // Much vs Many
  createRegexRule({
    id: 'AD_MCH_much_people',
    category: 'grammar',
    pattern:
      /\bhow\s+much\s+(people|books|items|things|students|cars|houses|problems|questions|answers|options|choices|mistakes|errors|changes|members|employees|users|tasks|ideas)\b/i,
    suggestion: (m) => `how many ${m[1]}`,
    reason: 'Use "many" with countable plural nouns, not "much".',
  }),
  createRegexRule({
    id: 'AD_MCH_many_info',
    category: 'grammar',
    pattern:
      /\bmany\s+(information|advice|furniture|equipment|luggage|news|progress|research|work|homework|evidence|knowledge|traffic|money|music|time|water|rice|bread|sugar|milk|coffee|tea|air|space|electricity)\b/i,
    suggestion: (m) => `much ${m[1]}`,
    reason: 'Use "much" with uncountable nouns, not "many".',
  }),

  // Amount vs Number
  createRegexRule({
    id: 'AD_AMT_amount_people',
    category: 'grammar',
    pattern:
      /\b(amount|amounts)\s+of\s+(people|items|things|students|books|cars|errors|problems|questions|answers|options|members|employees|customers|users|tasks|words|pages)\b/i,
    suggestion: (m) => `number of ${m[2]}`,
    reason: 'Use "number of" with countable nouns, not "amount of".',
  }),

  // Enough placement
  createRegexRule({
    id: 'AD_ENO_before_adj',
    category: 'grammar',
    pattern:
      /\benough\s+(big|tall|good|strong|fast|old|young|smart|rich|warm|cold|hot|cool|large|small|high|low|wide|deep|long|short|loud|quiet|hard|soft|bright|dark|clean|clear|safe|brave|kind|nice|sweet|easy|difficult|important|interesting|cheap|expensive)\b/i,
    suggestion: (m) => `${m[1]} enough`,
    reason: '"Enough" goes AFTER adjectives, not before. Place "enough" after the adjective.',
  }),

  // The + sport
  createRegexRule({
    id: 'AD_THE_sport',
    category: 'grammar',
    pattern:
      /\b(play|plays|played|playing)\s+the\s+(tennis|football|soccer|basketball|baseball|cricket|golf|volleyball|badminton|hockey|rugby|chess)\b/i,
    suggestion: (m) => `${m[1]} ${m[2]}`,
    reason: 'Do not use "the" before sport names.',
  }),
  // The + meal
  createRegexRule({
    id: 'AD_THE_meal',
    category: 'grammar',
    pattern:
      /\b(had|have|has|having|ate|eat|eats|eating)\s+the\s+(breakfast|lunch|dinner|supper|brunch)\b/i,
    suggestion: (m) => `${m[1]} ${m[2]}`,
    reason: 'Do not use "the" before meal names in general usage.',
  }),
];
