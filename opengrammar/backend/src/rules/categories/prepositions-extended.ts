import { createRegexRule, type Rule } from '../types.js';

/**
 * ════════════════════════════════════════════════════════
 *  Extended Preposition Rules — PRX Module
 *  Covers the most common prepositional errors that
 *  Grammarly detects but we were missing.
 * ════════════════════════════════════════════════════════
 */
export const prepositionExtendedRules: Rule[] = [

  // ─── ADJECTIVE + PREPOSITION COLLOCATIONS ───
  createRegexRule({
    id: 'PRX_good_in',
    category: 'grammar',
    pattern: /\bgood\s+in\s+(\w+ing|\w+)\b(?!\s+terms|\s+shape|\s+condition)/i,
    suggestion: (m) => `good at ${m[1]}`,
    reason: 'Use "good at" (not "good in") for skills and activities.',
  }),
  createRegexRule({
    id: 'PRX_afraid_from',
    category: 'grammar',
    pattern: /\bafraid\s+from\b/i,
    suggestion: 'afraid of',
    reason: 'Use "afraid of" not "afraid from".',
  }),
  createRegexRule({
    id: 'PRX_responsible_of',
    category: 'grammar',
    pattern: /\bresponsible\s+of\b/i,
    suggestion: 'responsible for',
    reason: 'Use "responsible for" not "responsible of".',
  }),
  createRegexRule({
    id: 'PRX_proud_on',
    category: 'grammar',
    pattern: /\bproud\s+on\b/i,
    suggestion: 'proud of',
    reason: 'Use "proud of" not "proud on".',
  }),
  createRegexRule({
    id: 'PRX_angry_on',
    category: 'grammar',
    pattern: /\bangry\s+on\b/i,
    suggestion: 'angry at / angry with',
    reason: 'Use "angry at" or "angry with" not "angry on".',
  }),
  createRegexRule({
    id: 'PRX_angry_from',
    category: 'grammar',
    pattern: /\bangry\s+from\b/i,
    suggestion: 'angry at / angry with',
    reason: 'Use "angry at" or "angry with" not "angry from".',
  }),
  createRegexRule({
    id: 'PRX_happy_for_event',
    category: 'grammar',
    pattern: /\bhappy\s+from\b/i,
    suggestion: 'happy with / happy about',
    reason: 'Use "happy with" or "happy about" not "happy from".',
  }),
  createRegexRule({
    id: 'PRX_familiar_about',
    category: 'grammar',
    pattern: /\bfamiliar\s+about\b/i,
    suggestion: 'familiar with',
    reason: 'Use "familiar with" not "familiar about".',
  }),
  createRegexRule({
    id: 'PRX_accused_for',
    category: 'grammar',
    pattern: /\baccused\s+for\b/i,
    suggestion: 'accused of',
    reason: 'Use "accused of" not "accused for".',
  }),
  createRegexRule({
    id: 'PRX_capable_to',
    category: 'grammar',
    pattern: /\bcapable\s+to\b/i,
    suggestion: 'capable of',
    reason: 'Use "capable of" not "capable to".',
  }),
  createRegexRule({
    id: 'PRX_sure_about_vs_of',
    category: 'grammar',
    pattern: /\bconfident\s+about\b/i,
    suggestion: 'confident in / confident of',
    reason: 'Use "confident in" or "confident of" not "confident about".',
  }),
  createRegexRule({
    id: 'PRX_depend_of',
    category: 'grammar',
    pattern: /\bdepend\s+of\b/i,
    suggestion: 'depend on',
    reason: 'Use "depend on" not "depend of".',
  }),
  createRegexRule({
    id: 'PRX_consists_from',
    category: 'grammar',
    pattern: /\bconsists?\s+from\b/i,
    suggestion: 'consists of',
    reason: 'Use "consists of" not "consists from".',
  }),
  createRegexRule({
    id: 'PRX_based_in',
    category: 'grammar',
    pattern: /\bbased\s+in\s+(?!the\s+city|the\s+town|the\s+country|the\s+region)/i,
    suggestion: 'based on',
    reason: 'Use "based on" when talking about foundations or reasons, not "based in".',
  }),

  // ─── VERB + PREPOSITION COLLOCATIONS ───
  createRegexRule({
    id: 'PRX_discuss_about',
    category: 'grammar',
    pattern: /\bdiscussed?\s+about\b/i,
    suggestion: (m) => m[1] || 'discussed',
    reason: '"Discuss" already means "talk about." Drop "about": say "discuss the issue".',
  }),
  createRegexRule({
    id: 'PRX_explain_indirect',
    category: 'grammar',
    pattern: /\bexplained?\s+(me|him|her|them|us|you)\s+/i,
    suggestion: (m) => `explained to ${m[1]} `,
    reason: '"Explain" needs "to" before the indirect object: "explain to me".',
  }),
  createRegexRule({
    id: 'PRX_listen_to',
    category: 'grammar',
    pattern: /\blisten\s+(?!to\b|carefully\b|closely\b|well\b|up\b|in\b|out\b)(\w+)/i,
    suggestion: (m) => `listen to ${m[1]}`,
    reason: '"Listen" requires "to" before the object: "listen to music".',
  }),
  createRegexRule({
    id: 'PRX_cope_with',
    category: 'grammar',
    pattern: /\bcope\s+(?!with\b)(\w+)/i,
    suggestion: (m) => `cope with ${m[1]}`,
    reason: '"Cope" requires "with": "cope with stress".',
  }),
  createRegexRule({
    id: 'PRX_insist_on',
    category: 'grammar',
    pattern: /\binsist\s+(?!on\b|upon\b|that\b)(\w+)/i,
    suggestion: (m) => `insist on ${m[1]}`,
    reason: '"Insist" is usually followed by "on": "insist on quality".',
  }),
  createRegexRule({
    id: 'PRX_agree_with_person',
    category: 'grammar',
    pattern: /\bagree\s+(?:with\s+)?to\s+(?!the\s+terms|the\s+conditions|the\s+proposal|the\s+plan|the\s+deal|this|that|it|them)/i,
    suggestion: 'agree with',
    reason: 'Use "agree with" when referring to a person or opinion.',
  }),
  createRegexRule({
    id: 'PRX_spend_time_on',
    category: 'grammar',
    pattern: /\bspend\s+(?:some\s+|more\s+|less\s+|much\s+|a\s+lot\s+of\s+)?time\s+to\s+(\w+)/i,
    suggestion: (m) => `spend time ${m[1]}ing`,
    reason: '"Spend time" is followed by a gerund: "spend time reading".',
  }),
  createRegexRule({
    id: 'PRX_succeed_in',
    category: 'grammar',
    pattern: /\bsucceeded?\s+to\s+(\w+)/i,
    suggestion: (m) => `succeeded in ${m[1]}ing`,
    reason: '"Succeed" is followed by "in" + gerund: "succeed in achieving".',
  }),

  // ─── CITY + COUNTRY COMMA ───
  createRegexRule({
    id: 'PRX_city_country_comma',
    category: 'grammar',
    pattern: /\b(Paris|London|Berlin|Rome|Madrid|Tokyo|Beijing|Mumbai|Sydney|Cairo|Lagos|Nairobi|Moscow|Oslo|Seoul|Bangkok|Vienna|Athens|Dublin|Lisbon|Amsterdam|Stockholm|Copenhagen|Brussels|Warsaw|Prague|Budapest|Bucharest|Sofia|Ankara|Tehran|Dhaka|Karachi|Colombo|Kathmandu|Kabul|Islamabad|Baghdad|Riyadh|Dubai|Kuwait|Doha|Amman|Beirut|Damascus|Jerusalem|Tunis|Algiers|Rabat|Accra|Abidjan|Dakar|Addis|Nairobi|Kinshasa|Luanda|Lusaka|Harare|Cape|Johannesburg|Pretoria|Kampala|Dar|Maputo|Antananarivo|Port|Auckland|Wellington|Suva|Honiara|Nuku|Pago|Ottawa|Washington|Mexico|Havana|Kingston|Port|San|Guatemala|Tegucigalpa|Managua|San|Panama|Bogota|Caracas|Georgetown|Paramaribo|Quito|Lima|LaPaz|Asuncion|Santiago|Buenos|Montevideo|Brasilia)\s+(France|Germany|Italy|Spain|Japan|China|India|Australia|Egypt|Nigeria|Kenya|Russia|Norway|South Korea|Thailand|Austria|Greece|Ireland|Portugal|Netherlands|Sweden|Denmark|Belgium|Poland|Czech Republic|Hungary|Romania|Bulgaria|Turkey|Iran|Bangladesh|Pakistan|Sri Lanka|Nepal|Afghanistan|Iraq|Saudi Arabia|UAE|Kuwait|Qatar|Jordan|Lebanon|Syria|Tunisia|Algeria|Morocco|Ghana|Ivory Coast|Senegal|Ethiopia|DR Congo|Angola|Zambia|Zimbabwe|Uganda|Tanzania|Mozambique|Madagascar|Canada|United States|Cuba|Jamaica|Guatemala|Honduras|Nicaragua|El Salvador|Panama|Colombia|Venezuela|Guyana|Ecuador|Peru|Bolivia|Paraguay|Chile|Argentina|Uruguay|Brazil|New Zealand|Fiji)\b/i,
    suggestion: (m) => `${m[1]}, ${m[2]}`,
    reason: 'Use a comma between city and country: "Paris, France".',
  }),

  // ─── AT vs ON vs IN (time) ───
  createRegexRule({
    id: 'PRX_at_monday',
    category: 'grammar',
    pattern: /\bat\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|weekdays|weekends|the\s+weekend)\b/i,
    suggestion: (m) => `on ${m[1]}`,
    reason: 'Use "on" with days of the week, not "at".',
  }),
  createRegexRule({
    id: 'PRX_in_monday',
    category: 'grammar',
    pattern: /\bin\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i,
    suggestion: (m) => `on ${m[1]}`,
    reason: 'Use "on" with days of the week, not "in".',
  }),
  createRegexRule({
    id: 'PRX_on_morning',
    category: 'grammar',
    pattern: /\bon\s+the?\s*(morning|afternoon|evening|night)\b(?!\s+of)/i,
    suggestion: (m) => `in the ${m[1]}`,
    reason: 'Use "in the morning/afternoon/evening", not "on the morning".',
  }),
  createRegexRule({
    id: 'PRX_at_night_correct',
    category: 'grammar',
    pattern: /\bin\s+(?:the\s+)?night\b(?!\s+sky|\s+air|\s+time|\s+shift|\s+club|\s+vision|\s+owl)/i,
    suggestion: 'at night',
    reason: 'Use "at night" not "in night".',
  }),

  // ─── ADVERB PLACEMENT ───
  createRegexRule({
    id: 'PRX_like_very_much',
    category: 'grammar',
    pattern: /\b(like|love|enjoy|hate|prefer|want|need|know|understand|believe|think|remember|forget|notice|see|hear|feel|find|get|use|have|do|make|take|give|tell|show|help|keep|let|bring|come|go|run|work|write|read|speak|say)\s+very\s+much\s+(\w+)/i,
    suggestion: (m) => `${m[1]} ${m[2]} very much`,
    reason: 'Place "very much" after the object, not before it.',
  }),
];
