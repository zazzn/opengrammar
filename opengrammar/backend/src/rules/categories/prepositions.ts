import { type Rule, createRegexRule } from '../types.js';
import type { Issue } from '../../shared-types.js';

export const prepositionRules: Rule[] = [
  // ═══ Time Prepositions (PR_TIM) ═══
  createRegexRule({ id: 'PR_TIM_in_day', category: 'grammar', pattern: /\bin\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i, suggestion: (m) => `on ${m[1]}`, reason: 'Use "on" with days of the week, not "in".' }),
  createRegexRule({ id: 'PR_TIM_at_month', category: 'grammar', pattern: /\bat\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i, suggestion: (m) => `in ${m[1]}`, reason: 'Use "in" with months, not "at".' }),
  createRegexRule({ id: 'PR_TIM_on_time', category: 'grammar', pattern: /\bon\s+(\d{1,2})\s*(AM|PM|a\.m\.|p\.m\.)\b/i, suggestion: (m) => `at ${m[1]} ${m[2]}`, reason: 'Use "at" with specific times, not "on".' }),
  createRegexRule({ id: 'PR_TIM_at_year', category: 'grammar', pattern: /\bat\s+(19|20)\d{2}\b/, suggestion: (m) => `in ${m[0].replace('at ', '')}`, reason: 'Use "in" with years, not "at".' }),

  // ═══ Place Prepositions (PR_PLC) ═══
  createRegexRule({ id: 'PR_PLC_in_table', category: 'grammar', pattern: /\bin\s+the\s+table\b/i, suggestion: 'on the table', reason: 'Use "on" for surfaces (on the table), not "in".' }),
  createRegexRule({ id: 'PR_PLC_at_room', category: 'grammar', pattern: /\bat\s+the\s+(room|bedroom|bathroom|kitchen|office|classroom|living room)\b/i, suggestion: (m) => `in the ${m[1]}`, reason: 'Use "in" for enclosed spaces, not "at".' }),

  // ═══ Redundant Prepositions (PR_RED) ═══
  createRegexRule({ id: 'PR_RED_return_back', category: 'clarity', pattern: /\breturn\s+back\b/i, suggestion: 'return', reason: '"Return" already means "come/go back" — "back" is redundant.' }),
  createRegexRule({ id: 'PR_RED_repeat_again', category: 'clarity', pattern: /\brepeat\s+again\b/i, suggestion: 'repeat', reason: '"Repeat" already means "do again" — "again" is redundant.' }),
  createRegexRule({ id: 'PR_RED_revert_back', category: 'clarity', pattern: /\brevert\s+back\b/i, suggestion: 'revert', reason: '"Revert" already means "go back" — "back" is redundant.' }),
  createRegexRule({ id: 'PR_RED_continue_on', category: 'clarity', pattern: /\bcontinue\s+on\b/i, suggestion: 'continue', reason: '"Continue" doesn\'t need "on" — it\'s redundant.' }),
  createRegexRule({ id: 'PR_RED_combine_together', category: 'clarity', pattern: /\bcombine\s+together\b/i, suggestion: 'combine', reason: '"Combine" already implies together — redundant.' }),
  createRegexRule({ id: 'PR_RED_join_together', category: 'clarity', pattern: /\bjoin\s+together\b/i, suggestion: 'join', reason: '"Join" already implies together — redundant.' }),
  createRegexRule({ id: 'PR_RED_merge_together', category: 'clarity', pattern: /\bmerge\s+together\b/i, suggestion: 'merge', reason: '"Merge" already implies together — redundant.' }),
  createRegexRule({ id: 'PR_RED_rise_up', category: 'clarity', pattern: /\brise\s+up\b/i, suggestion: 'rise', reason: '"Rise" already means upward movement — "up" is redundant.' }),
  createRegexRule({ id: 'PR_RED_descend_down', category: 'clarity', pattern: /\bdescend\s+down\b/i, suggestion: 'descend', reason: '"Descend" already means go down — "down" is redundant.' }),
  createRegexRule({ id: 'PR_RED_advance_forward', category: 'clarity', pattern: /\badvance\s+forward\b/i, suggestion: 'advance', reason: '"Advance" already means move forward — "forward" is redundant.' }),

  // ═══ Preposition + Gerund vs Infinitive (PR_GER) ═══
  createRegexRule({ id: 'PR_GER_forward', category: 'grammar', pattern: /\blook\s+forward\s+to\s+(meet|see|hear|work|do|make|get|have|be|go|start|finish|visit|attend|receive|discuss|learn|join|speak|talk|read|write|play|travel|explore)\b/i, suggestion: (m) => `look forward to ${m[1]}ing`, reason: 'After "look forward to", use the gerund (-ing form), not the base verb.' }),
  createRegexRule({ id: 'PR_GER_used_to', category: 'grammar', pattern: /\b(am|is|are|was|were|get|got|gotten)\s+used\s+to\s+(wake|eat|drink|sleep|work|drive|walk|run|swim|cook|clean|study|live|stay|go|come|leave|arrive|sit|stand)\b/i, suggestion: (m) => `${m[1]} used to ${m[2]}ing`, reason: 'After "be used to" (accustomed to), use the gerund: "used to waking", not "used to wake".' }),
  createRegexRule({ id: 'PR_GER_insist', category: 'grammar', pattern: /\binsisted?\s+on\s+to\s+(\w+)\b/i, suggestion: (m) => `insisted on ${m[1]}ing`, reason: 'After "insist on", use the gerund (-ing form).' }),

  // ═══ In vs Into (PR_MVR) ═══
  createRegexRule({ id: 'PR_MVR_walked_in', category: 'grammar', pattern: /\b(walked|ran|jumped|dove|climbed|went|came|fell|stepped|rushed|stormed|burst)\s+in\s+the\s+(room|house|building|office|store|shop|pool|water|car|kitchen|bedroom|bathroom|library|museum|theater|theatre|elevator|lift)\b/i, suggestion: (m) => `${m[1]} into the ${m[2]}`, reason: 'Use "into" with movement verbs to indicate entering a space.' }),
];
