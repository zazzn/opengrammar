import { type Rule, createRegexRule } from '../types.js';
import type { Issue } from '../../shared-types.js';

/**
 * ═══════════════════════════════════════════════════
 *  Inclusive Language (IL)
 *  Gender-neutral, disability-aware, culturally sensitive
 * ═══════════════════════════════════════════════════
 */
export const inclusiveLanguageRules: Rule[] = [

  // ═══ Gendered Job Titles (IL_001) ═══
  createRegexRule({ id: 'IL_chairman', category: 'style', pattern: /\bchairman\b/i, suggestion: 'chairperson', reason: '"Chairman" is gendered. Use "chairperson", "chair", or "presiding officer".' }),
  createRegexRule({ id: 'IL_chairwoman', category: 'style', pattern: /\bchairwoman\b/i, suggestion: 'chairperson', reason: '"Chairwoman" is gendered. Use "chairperson" or "chair".' }),
  createRegexRule({ id: 'IL_fireman', category: 'style', pattern: /\bfireman\b/i, suggestion: 'firefighter', reason: '"Fireman" is gendered. Use "firefighter".' }),
  createRegexRule({ id: 'IL_firemen', category: 'style', pattern: /\bfiremen\b/i, suggestion: 'firefighters', reason: '"Firemen" is gendered. Use "firefighters".' }),
  createRegexRule({ id: 'IL_policeman', category: 'style', pattern: /\bpoliceman\b/i, suggestion: 'police officer', reason: '"Policeman" is gendered. Use "police officer".' }),
  createRegexRule({ id: 'IL_policemen', category: 'style', pattern: /\bpolicemen\b/i, suggestion: 'police officers', reason: '"Policemen" is gendered. Use "police officers".' }),
  createRegexRule({ id: 'IL_policewoman', category: 'style', pattern: /\bpolicewoman\b/i, suggestion: 'police officer', reason: '"Policewoman" is gendered. Use "police officer".' }),
  createRegexRule({ id: 'IL_stewardess', category: 'style', pattern: /\bstewardess\b/i, suggestion: 'flight attendant', reason: '"Stewardess" is gendered. Use "flight attendant".' }),
  createRegexRule({ id: 'IL_mailman', category: 'style', pattern: /\bmailman\b/i, suggestion: 'mail carrier', reason: '"Mailman" is gendered. Use "mail carrier" or "postal worker".' }),
  createRegexRule({ id: 'IL_mankind', category: 'style', pattern: /\bmankind\b/i, suggestion: 'humankind', reason: '"Mankind" is gendered. Use "humankind", "humanity", or "people".' }),
  createRegexRule({ id: 'IL_manpower', category: 'style', pattern: /\bmanpower\b/i, suggestion: 'workforce', reason: '"Manpower" is gendered. Use "workforce", "staff", or "personnel".' }),
  createRegexRule({ id: 'IL_man_made', category: 'style', pattern: /\bman[\s-]made\b/i, suggestion: 'artificial', reason: '"Man-made" is gendered. Use "artificial", "synthetic", or "manufactured".' }),
  createRegexRule({ id: 'IL_businessman', category: 'style', pattern: /\bbusinessman\b/i, suggestion: 'businessperson', reason: '"Businessman" is gendered. Use "businessperson", "executive", or "professional".' }),
  createRegexRule({ id: 'IL_businessmen', category: 'style', pattern: /\bbusinessmen\b/i, suggestion: 'businesspeople', reason: '"Businessmen" is gendered. Use "businesspeople" or "professionals".' }),
  createRegexRule({ id: 'IL_spokesman', category: 'style', pattern: /\bspokesman\b/i, suggestion: 'spokesperson', reason: '"Spokesman" is gendered. Use "spokesperson" or "representative".' }),
  createRegexRule({ id: 'IL_congressmen', category: 'style', pattern: /\bcongressman\b/i, suggestion: 'congress member', reason: '"Congressman" is gendered. Use "congress member" or "representative".' }),
  createRegexRule({ id: 'IL_manhole', category: 'style', pattern: /\bmanhole\b/i, suggestion: 'maintenance hole', reason: '"Manhole" is gendered. Use "maintenance hole" or "utility access".' }),
  createRegexRule({ id: 'IL_craftsman', category: 'style', pattern: /\bcraftsman\b/i, suggestion: 'craftsperson', reason: '"Craftsman" is gendered. Use "craftsperson" or "artisan".' }),
  createRegexRule({ id: 'IL_salesman', category: 'style', pattern: /\bsalesman\b/i, suggestion: 'salesperson', reason: '"Salesman" is gendered. Use "salesperson" or "sales representative".' }),
  createRegexRule({ id: 'IL_waitress', category: 'style', pattern: /\bwaitress\b/i, suggestion: 'server', reason: '"Waitress" is gendered. Use "server".' }),
  createRegexRule({ id: 'IL_actress', category: 'style', pattern: /\bactress\b/i, suggestion: 'actor', reason: 'Modern usage prefers "actor" for all genders in professional contexts.' }),
  createRegexRule({ id: 'IL_housewife', category: 'style', pattern: /\bhousewife\b/i, suggestion: 'homemaker', reason: '"Housewife" is gendered. Use "homemaker" or "stay-at-home parent".' }),

  // ═══ Person-First Language (IL_003) ═══
  createRegexRule({ id: 'IL_disabled_person', category: 'style', pattern: /\b(a\s+)?disabled\s+(person|people|individual|individuals|child|children|man|woman|student|students|employee|employees|worker|workers)\b/i, suggestion: (m) => `${m[1] || ''}${m[2]} with a disability`, reason: 'Use person-first language: "person with a disability" rather than "disabled person".' }),
  createRegexRule({ id: 'IL_handicapped', category: 'style', pattern: /\b(the\s+)?handicapped\b/i, suggestion: 'people with disabilities', reason: '"Handicapped" is outdated. Use "people with disabilities" or "accessible" (for facilities).' }),
  createRegexRule({ id: 'IL_wheelchair_bound', category: 'style', pattern: /\b(wheelchair[\s-]bound|confined\s+to\s+a\s+wheelchair)\b/i, suggestion: 'uses a wheelchair', reason: 'People are not "bound" or "confined" by wheelchairs. Say "uses a wheelchair".' }),

  // ═══ Ableist Metaphors (IL_004) ═══
  createRegexRule({ id: 'IL_lame_excuse', category: 'style', pattern: /\blame\s+(excuse|argument|reason|attempt|joke|effort)\b/i, suggestion: (m) => `weak ${m[1]}`, reason: '"Lame" as a pejorative derives from disability language. Use "weak", "poor", or "unconvincing".' }),
  createRegexRule({ id: 'IL_crippled_by', category: 'style', pattern: /\bcrippled\s+by\b/i, suggestion: 'severely affected by', reason: '"Crippled" as a metaphor is ableist. Use "severely affected by", "hampered by", or "hindered by".' }),
  createRegexRule({ id: 'IL_suffers_from', category: 'style', pattern: /\b(suffers?|suffering)\s+from\s+(autism|ADHD|depression|anxiety|dyslexia|epilepsy|diabetes|asthma|cancer|a\s+disability)\b/i, suggestion: (m) => `has ${m[2]}`, reason: '"Suffers from" implies victimhood. Use "has" or "lives with" for neutral framing.' }),
  createRegexRule({ id: 'IL_tone_deaf', category: 'style', pattern: /\btone[\s-]deaf\b(?!\s+(person|singer|musician))/i, suggestion: 'insensitive', reason: '"Tone-deaf" as a metaphor for insensitivity can be ableist. Use "insensitive" or "out of touch".' }),
  createRegexRule({ id: 'IL_turn_blind', category: 'style', pattern: /\bturn(ing|ed)?\s+a\s+blind\s+eye\b/i, suggestion: 'ignoring', reason: '"Turning a blind eye" can be considered ableist. Use "ignoring" or "overlooking".' }),
  createRegexRule({ id: 'IL_falling_deaf', category: 'style', pattern: /\bfalling\s+on\s+deaf\s+ears\b/i, suggestion: 'being ignored', reason: '"Falling on deaf ears" can be considered ableist. Use "being ignored" or "not being heard".' }),
  createRegexRule({ id: 'IL_crazy', category: 'style', pattern: /\b(that's|it's|this\s+is|how)\s+crazy\b/i, suggestion: (m) => `${m[1]} wild`, reason: '"Crazy" as an intensifier trivializes mental health. Use "wild", "incredible", or "unbelievable".' }),
  createRegexRule({ id: 'IL_insane', category: 'style', pattern: /\b(that's|it's|this\s+is|how)\s+insane\b/i, suggestion: (m) => `${m[1]} unbelievable`, reason: '"Insane" as an intensifier trivializes mental health. Use "unbelievable" or "extraordinary".' }),

  // ═══ Age-Related (IL_005) ═══
  createRegexRule({ id: 'IL_elderly', category: 'style', pattern: /\b(the\s+)?elderly\b/i, suggestion: 'older adults', reason: '"Elderly" can be patronizing. Use "older adults" or "older people".' }),
  createRegexRule({ id: 'IL_senior_citizen', category: 'style', pattern: /\bsenior\s+citizen(s)?\b/i, suggestion: (m) => m[1] ? 'older adults' : 'older adult', reason: '"Senior citizen" is outdated. Use "older adult(s)".' }),
  createRegexRule({ id: 'IL_young_man', category: 'style', pattern: /\byoung\s+(lady|girl)\b/i, suggestion: 'young woman', reason: '"Young lady/girl" can be patronizing when referring to adult women. Use "young woman".' }),
];
