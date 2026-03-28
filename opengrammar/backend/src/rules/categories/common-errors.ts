import { createRegexRule, type Rule } from '../types.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *  Common Everyday Errors — CE Module
 *  Catches the errors that trip people up most frequently:
 *  • Missing comma in direct address greetings (Hi John → Hi, John)
 *  • Incorrectly split compound words (my self → myself)
 *  • Missing articles before age descriptors (a 9-year-old)
 *  • Incorrect spacing in pronouns (him self → himself)
 *  • Wrongly split common words (every one → everyone)
 *  • Common phrase errors (in case of → in case)
 * ═══════════════════════════════════════════════════════════════
 */
export const commonErrorRules: Rule[] = [

  // ════════════════════════════════════════════════════════
  // 1. GREETING COMMA (Direct Address)
  //    "Hi John" → "Hi, John"   "Hello Sarah" → "Hello, Sarah"
  // ════════════════════════════════════════════════════════
  createRegexRule({
    id: 'CE_GRT_hi_no_comma',
    category: 'grammar',
    pattern: /\bHi\s+([A-Z][a-zA-Z]+)\b(?!,)/,
    suggestion: (m) => `Hi, ${m[1]}`,
    reason: 'Add a comma after a greeting before the person\'s name: "Hi, [Name]".',
  }),
  createRegexRule({
    id: 'CE_GRT_hello_no_comma',
    category: 'grammar',
    pattern: /\bHello\s+([A-Z][a-zA-Z]+)\b(?!,)/,
    suggestion: (m) => `Hello, ${m[1]}`,
    reason: 'Add a comma after a greeting before the person\'s name: "Hello, [Name]".',
  }),
  createRegexRule({
    id: 'CE_GRT_hey_no_comma',
    category: 'grammar',
    pattern: /\bHey\s+([A-Z][a-zA-Z]+)\b(?!,)/,
    suggestion: (m) => `Hey, ${m[1]}`,
    reason: 'Add a comma after a greeting before the person\'s name: "Hey, [Name]".',
  }),
  createRegexRule({
    id: 'CE_GRT_dear_no_comma',
    category: 'grammar',
    pattern: /\bDear\s+([A-Z][a-zA-Z]+)\b(?!,)/,
    suggestion: (m) => `Dear ${m[1]},`,
    reason: 'Add a comma after the name in a letter salutation: "Dear [Name],".',
  }),
  createRegexRule({
    id: 'CE_GRT_greetings_no_comma',
    category: 'grammar',
    pattern: /\bGreetings\s+([A-Z][a-zA-Z]+)\b(?!,)/,
    suggestion: (m) => `Greetings, ${m[1]}`,
    reason: 'Add a comma after a greeting before the person\'s name.',
  }),

  // ════════════════════════════════════════════════════════
  // 2. SPLIT REFLEXIVE PRONOUNS
  //    "my self" → "myself", "him self" → "himself", etc.
  // ════════════════════════════════════════════════════════
  createRegexRule({
    id: 'CE_REF_myself_split',
    category: 'spelling',
    pattern: /\bmy\s+self\b/i,
    suggestion: 'myself',
    reason: '"Myself" is one word, not two.',
  }),
  createRegexRule({
    id: 'CE_REF_himself_split',
    category: 'spelling',
    pattern: /\bhim\s+self\b/i,
    suggestion: 'himself',
    reason: '"Himself" is one word, not two.',
  }),
  createRegexRule({
    id: 'CE_REF_herself_split',
    category: 'spelling',
    pattern: /\bher\s+self\b/i,
    suggestion: 'herself',
    reason: '"Herself" is one word, not two.',
  }),
  createRegexRule({
    id: 'CE_REF_yourself_split',
    category: 'spelling',
    pattern: /\byour\s+self\b/i,
    suggestion: 'yourself',
    reason: '"Yourself" is one word, not two.',
  }),
  createRegexRule({
    id: 'CE_REF_themselves_split',
    category: 'spelling',
    pattern: /\bthem\s+selves\b/i,
    suggestion: 'themselves',
    reason: '"Themselves" is one word, not two.',
  }),
  createRegexRule({
    id: 'CE_REF_ourselves_split',
    category: 'spelling',
    pattern: /\bour\s+selves\b/i,
    suggestion: 'ourselves',
    reason: '"Ourselves" is one word, not two.',
  }),
  createRegexRule({
    id: 'CE_REF_itself_split',
    category: 'spelling',
    pattern: /\bits\s+self\b/i,
    suggestion: 'itself',
    reason: '"Itself" is one word, not two.',
  }),
  createRegexRule({
    id: 'CE_REF_yourselves_split',
    category: 'spelling',
    pattern: /\byour\s+selves\b/i,
    suggestion: 'yourselves',
    reason: '"Yourselves" is one word, not two.',
  }),

  // ════════════════════════════════════════════════════════
  // 3. INCORRECTLY SPLIT COMPOUND WORDS
  // ════════════════════════════════════════════════════════
  createRegexRule({
    id: 'CE_CPD_everyone',
    category: 'spelling',
    pattern: /\bevery\s+one\b(?!\s+(of|who|that|which|else))/i,
    suggestion: 'everyone',
    reason: '"Everyone" (meaning all people) is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_someone',
    category: 'spelling',
    pattern: /\bsome\s+one\b(?!\s+(of|who|that|which|else))/i,
    suggestion: 'someone',
    reason: '"Someone" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_anyone',
    category: 'spelling',
    pattern: /\bany\s+one\b(?!\s+(of|who|that|which|else))/i,
    suggestion: 'anyone',
    reason: '"Anyone" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_noone',
    category: 'spelling',
    pattern: /\bno\s+one\s+else\b/i,
    suggestion: 'no one else',
    reason: '"No one" is kept as two words (unlike everyone/someone).',
  }),
  createRegexRule({
    id: 'CE_CPD_everything',
    category: 'spelling',
    pattern: /\bevery\s+thing\b/i,
    suggestion: 'everything',
    reason: '"Everything" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_something',
    category: 'spelling',
    pattern: /\bsome\s+thing\b/i,
    suggestion: 'something',
    reason: '"Something" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_anything',
    category: 'spelling',
    pattern: /\bany\s+thing\b/i,
    suggestion: 'anything',
    reason: '"Anything" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_everybody',
    category: 'spelling',
    pattern: /\bevery\s+body\b/i,
    suggestion: 'everybody',
    reason: '"Everybody" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_somebody',
    category: 'spelling',
    pattern: /\bsome\s+body\b/i,
    suggestion: 'somebody',
    reason: '"Somebody" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_anybody',
    category: 'spelling',
    pattern: /\bany\s+body\b/i,
    suggestion: 'anybody',
    reason: '"Anybody" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_nowhere',
    category: 'spelling',
    pattern: /\bno\s+where\b/i,
    suggestion: 'nowhere',
    reason: '"Nowhere" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_somewhere',
    category: 'spelling',
    pattern: /\bsome\s+where\b/i,
    suggestion: 'somewhere',
    reason: '"Somewhere" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_anywhere',
    category: 'spelling',
    pattern: /\bany\s+where\b/i,
    suggestion: 'anywhere',
    reason: '"Anywhere" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_everywhere',
    category: 'spelling',
    pattern: /\bevery\s+where\b/i,
    suggestion: 'everywhere',
    reason: '"Everywhere" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_maybe',
    category: 'spelling',
    pattern: /\bmay\s+be\b(?!\s+(true|false|right|wrong|possible|necessary))/i,
    suggestion: 'maybe',
    reason: '"Maybe" (meaning perhaps) is one word. "May be" is the verb phrase.',
  }),
  createRegexRule({
    id: 'CE_CPD_cannot',
    category: 'spelling',
    pattern: /\bcan\s+not\b/i,
    suggestion: 'cannot',
    reason: '"Cannot" is typically written as one word in formal usage.',
  }),
  createRegexRule({
    id: 'CE_CPD_without',
    category: 'spelling',
    pattern: /\bwith\s+out\b/i,
    suggestion: 'without',
    reason: '"Without" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_within',
    category: 'spelling',
    pattern: /\bwith\s+in\b/i,
    suggestion: 'within',
    reason: '"Within" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_outside',
    category: 'spelling',
    pattern: /\bout\s+side\b/i,
    suggestion: 'outside',
    reason: '"Outside" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_inside',
    category: 'spelling',
    pattern: /\bin\s+side\b/i,
    suggestion: 'inside',
    reason: '"Inside" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_overall',
    category: 'spelling',
    pattern: /\bover\s+all\b/i,
    suggestion: 'overall',
    reason: '"Overall" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_sometimes',
    category: 'spelling',
    pattern: /\bsome\s+times\b/i,
    suggestion: 'sometimes',
    reason: '"Sometimes" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_meanwhile',
    category: 'spelling',
    pattern: /\bmean\s+while\b/i,
    suggestion: 'meanwhile',
    reason: '"Meanwhile" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_however',
    category: 'spelling',
    pattern: /\bhow\s+ever\b/i,
    suggestion: 'however',
    reason: '"However" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_whatever',
    category: 'spelling',
    pattern: /\bwhat\s+ever\b/i,
    suggestion: 'whatever',
    reason: '"Whatever" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_whenever',
    category: 'spelling',
    pattern: /\bwhen\s+ever\b/i,
    suggestion: 'whenever',
    reason: '"Whenever" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_wherever',
    category: 'spelling',
    pattern: /\bwhere\s+ever\b/i,
    suggestion: 'wherever',
    reason: '"Wherever" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_whoever',
    category: 'spelling',
    pattern: /\bwho\s+ever\b/i,
    suggestion: 'whoever',
    reason: '"Whoever" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_whatever2',
    category: 'spelling',
    pattern: /\bwhat\s+so\s+ever\b/i,
    suggestion: 'whatsoever',
    reason: '"Whatsoever" is one word.',
  }),
  createRegexRule({
    id: 'CE_CPD_into',
    category: 'grammar',
    pattern: /\b(walked|ran|jumped|fell|came|go|goes|put|get|gets|turn|turns|turned|log|logs|logged|sign|signs|signed|plug|plugs|plugged|bump|bumps|bumped|break|broke|broken)\s+in\s+to\b/i,
    suggestion: (m) => `${m[1]} into`,
    reason: 'Use "into" (one word) for direction or transformation after movement verbs.',
  }),
  createRegexRule({
    id: 'CE_CPD_onto',
    category: 'grammar',
    pattern: /\b(step|steps|stepped|climb|climbs|climbed|move|moves|moved|fall|falls|fell|jump|jumps|jumped|get|gets|got|hold|holds|held)\s+on\s+to\b/i,
    suggestion: (m) => `${m[1]} onto`,
    reason: 'Use "onto" (one word) when expressing movement to a surface.',
  }),
  createRegexRule({
    id: 'CE_CPD_everyday',
    category: 'grammar',
    pattern: /\bevery\s+day\s+(life|situation|task|problem|issue|use|basis|routine|object|item|thing|word|language|experience|activity|event|occurrence)\b/i,
    suggestion: (m) => `everyday ${m[1]}`,
    reason: 'Use "everyday" (one word) as an adjective meaning "ordinary" or "routine".',
  }),
  createRegexRule({
    id: 'CE_CPD_already',
    category: 'spelling',
    pattern: /\ball\s+ready\b(?!\s+to)/i,
    suggestion: 'already',
    reason: '"Already" (meaning by now) is one word. "All ready" means completely prepared.',
  }),
  createRegexRule({
    id: 'CE_CPD_altogether',
    category: 'spelling',
    pattern: /\ball\s+together\b/i,
    suggestion: 'altogether',
    reason: '"Altogether" (meaning entirely) is one word. "All together" means in a group.',
  }),

  // ════════════════════════════════════════════════════════
  // 4. MISSING ARTICLE BEFORE AGE/COUNT DESCRIPTORS
  // ════════════════════════════════════════════════════════
  createRegexRule({
    id: 'CE_ART_am_age',
    category: 'grammar',
    pattern: /\b(am|are|is|was|were)\s+(\d+)-year-old\b/i,
    suggestion: (m) => `${m[1]} a ${m[2]}-year-old`,
    reason: 'Add article "a" before an age descriptor used as a noun: "I am a 9-year-old".',
  }),

  // ════════════════════════════════════════════════════════
  // 5. COMMON PHRASE ERRORS
  // ════════════════════════════════════════════════════════
  createRegexRule({
    id: 'CE_PHR_at_the_end_of_a_day',
    category: 'grammar',
    pattern: /\bat\s+the\s+end\s+of\s+a\s+day\b/i,
    suggestion: 'at the end of the day',
    reason: 'The idiom uses "the day", not "a day".',
  }),
  createRegexRule({
    id: 'CE_PHR_for_the_mean_time',
    category: 'grammar',
    pattern: /\bfor\s+the\s+mean\s+time\b/i,
    suggestion: 'for the meantime',
    reason: '"Meantime" is one word in this expression.',
  }),
  createRegexRule({
    id: 'CE_PHR_in_a_nutshell',
    category: 'style',
    pattern: /\bI\s+believe\s+that\b/i,
    suggestion: 'I believe',
    reason: '"I believe that" can usually drop "that" for conciseness.',
  }),
  createRegexRule({
    id: 'CE_PHR_going_to',
    category: 'style',
    pattern: /\bgonna\b/i,
    suggestion: 'going to',
    reason: '"Gonna" is informal. Use "going to" in writing.',
  }),
  createRegexRule({
    id: 'CE_PHR_want_to',
    category: 'style',
    pattern: /\bwanna\b/i,
    suggestion: 'want to',
    reason: '"Wanna" is informal. Use "want to" in writing.',
  }),
  createRegexRule({
    id: 'CE_PHR_got_to',
    category: 'style',
    pattern: /\bgotta\b/i,
    suggestion: 'have to / got to',
    reason: '"Gotta" is informal. Use "have to" or "got to" in writing.',
  }),
  createRegexRule({
    id: 'CE_PHR_kind_of',
    category: 'style',
    pattern: /\bkinda\b/i,
    suggestion: 'kind of',
    reason: '"Kinda" is informal. Use "kind of" in writing.',
  }),
  createRegexRule({
    id: 'CE_PHR_sort_of',
    category: 'style',
    pattern: /\bsorta\b/i,
    suggestion: 'sort of',
    reason: '"Sorta" is informal. Use "sort of" in writing.',
  }),
  createRegexRule({
    id: 'CE_PHR_out_of',
    category: 'style',
    pattern: /\boutta\b/i,
    suggestion: 'out of',
    reason: '"Outta" is informal slang. Use "out of" in writing.',
  }),

  // ════════════════════════════════════════════════════════
  // 6. DOUBLE NEGATIVE
  // ════════════════════════════════════════════════════════
  createRegexRule({
    id: 'CE_DBL_dont_know_nothing',
    category: 'grammar',
    pattern: /\bdon'?t\s+know\s+nothing\b/i,
    suggestion: "don't know anything",
    reason: 'Avoid double negatives. Use "don\'t know anything" instead.',
  }),
  createRegexRule({
    id: 'CE_DBL_never_seen_nothing',
    category: 'grammar',
    pattern: /\bnever\s+(seen|heard|done|read|said|told|found|met)\s+nothing\b/i,
    suggestion: (m) => `never ${m[1]} anything`,
    reason: 'Avoid double negatives. Use "never ... anything" instead of "never ... nothing".',
  }),
  createRegexRule({
    id: 'CE_DBL_cant_do_nothing',
    category: 'grammar',
    pattern: /\bcan'?t\s+do\s+nothing\b/i,
    suggestion: "can't do anything",
    reason: 'Avoid double negatives. Use "can\'t do anything" instead.',
  }),

  // ════════════════════════════════════════════════════════
  // 7. CAPITALIZATION AFTER GREETING PUNCTUATION
  //    "Hi, john" → "Hi, John" (name should be capitalized)
  // ════════════════════════════════════════════════════════
  createRegexRule({
    id: 'CE_CAP_name_after_greeting_hi',
    category: 'grammar',
    pattern: /\b(Hi|Hello|Hey|Dear|Greetings),\s+([a-z][a-zA-Z]+)\b/,
    suggestion: (m) => `${m[1]}, ${m[2].charAt(0).toUpperCase() + m[2].slice(1)}`,
    reason: 'Capitalize the name after a greeting.',
  }),

  // ════════════════════════════════════════════════════════
  // 8. COMMON CONFUSED CONSTRUCTIONS
  // ════════════════════════════════════════════════════════
  createRegexRule({
    id: 'CE_CON_i_is',
    category: 'grammar',
    pattern: /\bI\s+is\b/,
    suggestion: 'I am',
    reason: 'The correct form is "I am", not "I is".',
  }),
  createRegexRule({
    id: 'CE_CON_you_am',
    category: 'grammar',
    pattern: /\byou\s+am\b/i,
    suggestion: 'you are',
    reason: 'The correct form is "you are", not "you am".',
  }),
  createRegexRule({
    id: 'CE_CON_we_is',
    category: 'grammar',
    pattern: /\bwe\s+is\b/i,
    suggestion: 'we are',
    reason: 'The correct form is "we are", not "we is".',
  }),
  createRegexRule({
    id: 'CE_CON_they_is',
    category: 'grammar',
    pattern: /\bthey\s+is\b/i,
    suggestion: 'they are',
    reason: 'The correct form is "they are", not "they is".',
  }),
  createRegexRule({
    id: 'CE_CON_he_are',
    category: 'grammar',
    pattern: /\b(he|she|it)\s+are\b/i,
    suggestion: (m) => `${m[1]} is`,
    reason: `The correct form is "${'"he/she/it is"'}".`,
  }),
  createRegexRule({
    id: 'CE_CON_this_are',
    category: 'grammar',
    pattern: /\bthis\s+are\b/i,
    suggestion: 'these are',
    reason: 'Use "these are" with plural, or "this is" with singular.',
  }),
  createRegexRule({
    id: 'CE_CON_that_are',
    category: 'grammar',
    pattern: /\bthat\s+are\b(?!\s+(going|coming|looking|trying|working))/i,
    suggestion: 'those are',
    reason: 'Use "those are" with plural distant objects.',
  }),

  // ════════════════════════════════════════════════════════
  // 9. MISSING COMMA AFTER INTRODUCTORY PHRASES
  // ════════════════════════════════════════════════════════
  createRegexRule({
    id: 'CE_COM_however_no_comma',
    category: 'grammar',
    pattern: /^However\s+(?!,)/,
    suggestion: 'However, ',
    reason: 'Use a comma after "However" when it begins a sentence.',
  }),
  createRegexRule({
    id: 'CE_COM_therefore_no_comma',
    category: 'grammar',
    pattern: /^Therefore\s+(?!,)/,
    suggestion: 'Therefore, ',
    reason: 'Use a comma after "Therefore" when it begins a sentence.',
  }),
  createRegexRule({
    id: 'CE_COM_furthermore_no_comma',
    category: 'grammar',
    pattern: /^Furthermore\s+(?!,)/,
    suggestion: 'Furthermore, ',
    reason: 'Use a comma after "Furthermore" when it begins a sentence.',
  }),
  createRegexRule({
    id: 'CE_COM_moreover_no_comma',
    category: 'grammar',
    pattern: /^Moreover\s+(?!,)/,
    suggestion: 'Moreover, ',
    reason: 'Use a comma after "Moreover" when it begins a sentence.',
  }),
  createRegexRule({
    id: 'CE_COM_meanwhile_no_comma',
    category: 'grammar',
    pattern: /^Meanwhile\s+(?!,)/,
    suggestion: 'Meanwhile, ',
    reason: 'Use a comma after "Meanwhile" when it begins a sentence.',
  }),
  createRegexRule({
    id: 'CE_COM_finally_no_comma',
    category: 'grammar',
    pattern: /^Finally\s+(?!,)/,
    suggestion: 'Finally, ',
    reason: 'Use a comma after "Finally" when it begins a sentence.',
  }),
  createRegexRule({
    id: 'CE_COM_additionally_no_comma',
    category: 'grammar',
    pattern: /^Additionally\s+(?!,)/,
    suggestion: 'Additionally, ',
    reason: 'Use a comma after "Additionally" when it begins a sentence.',
  }),
  createRegexRule({
    id: 'CE_COM_unfortunately_no_comma',
    category: 'grammar',
    pattern: /^Unfortunately\s+(?!,)/,
    suggestion: 'Unfortunately, ',
    reason: 'Use a comma after "Unfortunately" when it begins a sentence.',
  }),
  createRegexRule({
    id: 'CE_COM_fortunately_no_comma',
    category: 'grammar',
    pattern: /^Fortunately\s+(?!,)/,
    suggestion: 'Fortunately, ',
    reason: 'Use a comma after "Fortunately" when it begins a sentence.',
  }),
  createRegexRule({
    id: 'CE_COM_yes_no_comma',
    category: 'grammar',
    pattern: /^(Yes|No|Well|Sure|Indeed|Absolutely|Certainly|Exactly|Honestly|Clearly|Obviously|Frankly)\s+(?!,)/,
    suggestion: (m) => `${m[1]}, `,
    reason: `Use a comma after "${'"Yes/No/Well"'}" when it begins a sentence.`,
  }),
];
