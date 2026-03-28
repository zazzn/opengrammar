import { createRegexRule, type Rule } from '../types.js';

/**
 * ════════════════════════════════════════════════════════
 *  Tone Rules — TNR Module
 *  Rule-based tone issue flags (same Issue format as grammar rules).
 *  These appear as "style" type issues inline in the grammar card.
 * ════════════════════════════════════════════════════════
 */
export const toneRules: Rule[] = [

  // ═══════════════════════════════════════════════
  // A. PASSIVE AGGRESSION SIGNALS
  // ═══════════════════════════════════════════════
  createRegexRule({
    id: 'TNR_per_my_last',
    category: 'style',
    pattern: /\bper my (last|previous|earlier|recent|prior|above|below)\s+(email|message|note|memo|request|reply|response|comment)\b/i,
    suggestion: (m) => `As I ${m[0].includes('last') ? 'previously mentioned' : 'noted'} ...`,
    reason: '"Per my last email" can sound passive-aggressive in professional settings. Try "As I previously mentioned" or just restate the point directly.',
  }),
  createRegexRule({
    id: 'TNR_as_i_mentioned',
    category: 'style',
    pattern: /\bAs (I|we) (said|mentioned|noted|stated|explained|indicated|pointed out) (earlier|before|previously|above|in my last|already)\b/i,
    suggestion: 'Restate the point directly without referencing the previous mention',
    reason: 'Referencing previous statements can sound passive-aggressive. Simply restate the information.',
  }),
  createRegexRule({
    id: 'TNR_circle_back',
    category: 'style',
    pattern: /\bcircle back\b/i,
    suggestion: 'follow up',
    reason: '"Circle back" is corporate jargon that can feel passive-aggressive. Use "follow up" instead.',
  }),
  createRegexRule({
    id: 'TNR_moving_forward',
    category: 'style',
    pattern: /\bgoing forward\b/i,
    suggestion: 'in the future / from now on',
    reason: '"Going forward" can sound passive-aggressive after a criticism. Try "in the future" or "from now on".',
  }),

  // ═══════════════════════════════════════════════
  // B. APOLOGY FILLERS (Confidence Weakeners)
  // ═══════════════════════════════════════════════
  createRegexRule({
    id: 'TNR_just_wanted',
    category: 'style',
    pattern: /\bI just wanted to\b/i,
    suggestion: 'I want to / I am writing to',
    reason: '"I just wanted to" is an unnecessary softener that weakens your message. Be direct.',
  }),
  createRegexRule({
    id: 'TNR_sorry_to_bother',
    category: 'style',
    pattern: /\bsorry (to (bother|bug|trouble|disturb|interrupt|pester|contact) you|for (bothering|bugging|troubling|interrupting|disturbing))\b/i,
    suggestion: 'Remove the apology and state your need directly',
    reason: 'Apologizing for contacting someone preemptively weakens your message. Start with your request directly.',
  }),
  createRegexRule({
    id: 'TNR_does_that_make_sense',
    category: 'style',
    pattern: /\bdoes that make sense\??\b/i,
    suggestion: 'Let me know if you have questions.',
    reason: '"Does that make sense?" can sound uncertain or condescending. Try "Let me know if you have questions."',
  }),
  createRegexRule({
    id: 'TNR_if_thats_okay',
    category: 'style',
    pattern: /\bif that'?s? (okay|ok|alright|fine|good|acceptable|convenient|possible)\b/i,
    suggestion: 'Remove — state your request confidently',
    reason: 'Seeking permission after making a request undermines your authority. Remove this phrase.',
  }),
  createRegexRule({
    id: 'TNR_hopefully',
    category: 'style',
    pattern: /^Hopefully,?\s+/i,
    suggestion: 'State your expectation directly',
    reason: 'Starting with "Hopefully" signals uncertainty. State what you expect or need directly.',
  }),
  createRegexRule({
    id: 'TNR_no_rush',
    category: 'style',
    pattern: /\bno rush(,| but| though| however)\b/i,
    suggestion: 'Remove or specify a deadline: "Please reply by [date]"',
    reason: '"No rush" is vague and undermines urgency. If you have a deadline, state it; if not, remove this phrase.',
  }),

  // ═══════════════════════════════════════════════
  // C. HEDGING OVERUSE
  // ═══════════════════════════════════════════════
  createRegexRule({
    id: 'TNR_i_think_that',
    category: 'style',
    pattern: /\bI think that\b/i,
    suggestion: 'State your point directly (remove "I think that")',
    reason: '"I think that" weakens your statement. Remove it and state your point with confidence.',
  }),
  createRegexRule({
    id: 'TNR_i_guess',
    category: 'style',
    pattern: /\bI would guess\b/i,
    suggestion: 'I estimate / I expect',
    reason: '"I would guess" sounds uncertain. Use "I estimate" or "I expect" for a more confident tone.',
  }),
  createRegexRule({
    id: 'TNR_i_suppose',
    category: 'style',
    pattern: /\bI suppose\b/i,
    suggestion: 'State your view directly',
    reason: '"I suppose" sounds hesitant. State your position directly.',
  }),
  createRegexRule({
    id: 'TNR_sort_of',
    category: 'style',
    pattern: /\bsort of (like|similar|the same|related|connected|associated)\b/i,
    suggestion: (m) => `similar to / ${m[1]}`,
    reason: '"Sort of" hedges your comparison unnecessarily. Be specific.',
  }),

  // ═══════════════════════════════════════════════
  // D. AGGRESSIVE / DEMANDING LANGUAGE
  // ═══════════════════════════════════════════════
  createRegexRule({
    id: 'TNR_you_always_fail',
    category: 'style',
    pattern: /\byou (always|never|constantly|consistently|repeatedly) (fail|forget|ignore|miss|avoid|dismiss|neglect)\b/i,
    suggestion: (m) => `This has happened [X times] — let's work on a solution for ${m[2]}ing`,
    reason: '"You always/never [verb]" is accusatory and absolute. Focus on specific incidents and collaborative solutions instead.',
  }),
  createRegexRule({
    id: 'TNR_i_demand',
    category: 'style',
    pattern: /\bI demand\b/i,
    suggestion: 'I need / I require / I expect',
    reason: '"I demand" sounds aggressive and unprofessional. Use "I need" or "I require" instead.',
  }),
  createRegexRule({
    id: 'TNR_unacceptable',
    category: 'style',
    pattern: /\bthis is (completely |absolutely |totally |simply |truly |utterly )?(unacceptable|ridiculous|absurd|outrageous|disgraceful|pathetic)\b/i,
    suggestion: 'This does not meet [the standard]. Here is what I need: ...',
    reason: 'Expressing frustration with absolute negativity rarely achieves results. State specifically what needs to change.',
  }),

  // ═══════════════════════════════════════════════
  // E. WORDY CORPORATE JARGON (Tone-adjacent)
  // ═══════════════════════════════════════════════
  createRegexRule({
    id: 'TNR_synergy',
    category: 'style',
    pattern: /\bsynerg(y|ies|ize|istic)\b/i,
    suggestion: 'collaboration / combined effort',
    reason: '"Synergy" is overused corporate jargon that often obscures meaning. Use plain language.',
  }),
  createRegexRule({
    id: 'TNR_leverage',
    category: 'style',
    pattern: /\bleverage\b(?!\s+the|\s+a|\s+our)/i,
    suggestion: 'use / utilize / apply',
    reason: '"Leverage" as a verb is corporate jargon. Use "use", "apply", or "take advantage of".',
  }),
  createRegexRule({
    id: 'TNR_touch_base',
    category: 'style',
    pattern: /\btouch (base|bases)\b/i,
    suggestion: 'check in / follow up / meet',
    reason: '"Touch base" is overused corporate jargon. Use plain language like "check in" or "follow up".',
  }),
  createRegexRule({
    id: 'TNR_at_the_end_of_the_day',
    category: 'style',
    pattern: /\bat the end of the day\b/i,
    suggestion: 'ultimately / in the end / finally',
    reason: '"At the end of the day" is an overused cliché. Use "ultimately" or "in the end" for clarity.',
  }),
  createRegexRule({
    id: 'TNR_thinking_outside_the_box',
    category: 'style',
    pattern: /\bthink(ing)? outside (the|of the) box\b/i,
    suggestion: 'creative thinking / innovation / unconventional approach',
    reason: '"Thinking outside the box" is an overused cliché that undermines the creativity you\'re trying to express.',
  }),
  createRegexRule({
    id: 'TNR_low_hanging_fruit',
    category: 'style',
    pattern: /\blow[- ]hanging fruit\b/i,
    suggestion: 'easy wins / quick opportunities',
    reason: '"Low-hanging fruit" is overused corporate jargon. Try "easy wins" or "quick opportunities".',
  }),
  createRegexRule({
    id: 'TNR_bandwidth',
    category: 'style',
    pattern: /\bhave (the |enough |sufficient )?(bandwidth)\b/i,
    suggestion: 'have the capacity / have time / be available',
    reason: '"Bandwidth" in a human context is tech jargon. Use "capacity", "time", or "availability".',
  }),
  createRegexRule({
    id: 'TNR_deep_dive',
    category: 'style',
    pattern: /\bdeep.?dive\b/i,
    suggestion: 'detailed analysis / thorough review / in-depth look',
    reason: '"Deep dive" is overused jargon. Use "detailed analysis" or "thorough review".',
  }),
];
