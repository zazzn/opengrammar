import type { Issue } from '../../shared-types.js';
import { createRegexRule, type Rule } from '../types.js';

/**
 * ═══════════════════════════════════════════════════
 *  Business & Professional Writing (BW)
 *  Empty openers, corporate bloat, weak verbs
 * ═══════════════════════════════════════════════════
 */
export const businessWritingRules: Rule[] = [
  // ═══ Empty Email Openers (BW_002) ═══
  createRegexRule({
    id: 'BW_writing_inform',
    category: 'clarity',
    pattern: /\bI\s+am\s+writing\s+to\s+inform\s+you\b/i,
    suggestion: '(State the information directly)',
    reason: '"I am writing to inform you" is an empty opener. Get to the point.',
  }),
  createRegexRule({
    id: 'BW_email_let_know',
    category: 'clarity',
    pattern: /\bthis\s+email\s+is\s+to\s+let\s+you\s+know\b/i,
    suggestion: '(State the information directly)',
    reason: '"This email is to let you know" is filler. State the information directly.',
  }),
  createRegexRule({
    id: 'BW_wanted_reach',
    category: 'clarity',
    pattern: /\bI\s+wanted\s+to\s+reach\s+out\b/i,
    suggestion: '(State your purpose directly)',
    reason: '"I wanted to reach out" is an empty opener. State your purpose directly.',
  }),
  createRegexRule({
    id: 'BW_just_checking',
    category: 'clarity',
    pattern: /\bI\s+(am\s+)?just\s+checking\s+in\b/i,
    suggestion: '(State your question directly)',
    reason: '"Just checking in" is filler. Ask your question or state your purpose.',
  }),
  createRegexRule({
    id: 'BW_touching_base',
    category: 'clarity',
    pattern: /\bI\s+(am\s+)?(just\s+)?touching\s+base\b/i,
    suggestion: '(State your purpose)',
    reason: '"Touching base" is vague corporate jargon. State your purpose clearly.',
  }),
  createRegexRule({
    id: 'BW_hope_finds',
    category: 'clarity',
    pattern: /\bI\s+hope\s+this\s+(email|message)\s+finds\s+you\s+well\b/i,
    suggestion: '(Skip or use a specific greeting)',
    reason:
      '"I hope this email finds you well" is a cliché opener. Get to the point or use a specific greeting.',
  }),
  createRegexRule({
    id: 'BW_per_our',
    category: 'clarity',
    pattern: /\bper\s+our\s+(conversation|discussion|meeting|call|agreement|email)\b/i,
    suggestion: (m) => `As we discussed in our ${m[1]}`,
    reason: '"Per our..." is stiff. Try "As we discussed" or "Following our...".',
  }),
  createRegexRule({
    id: 'BW_please_advise',
    category: 'clarity',
    pattern: /\bplease\s+advise\b/i,
    suggestion: '(Ask a specific question)',
    reason: '"Please advise" is vague. Ask a specific question instead.',
  }),
  createRegexRule({
    id: 'BW_kindly_note',
    category: 'clarity',
    pattern: /\bkindly\s+note\s+that\b/i,
    suggestion: 'Please note that',
    reason: '"Kindly note" sounds overly formal. Use "Please note" or state the point directly.',
  }),

  // ═══ Weak/Corporate Verbs (BW_003) ═══
  createRegexRule({
    id: 'BW_utilize',
    category: 'style',
    pattern: /\butilize\b/i,
    suggestion: 'use',
    reason: '"Utilize" is unnecessarily complex. Use "use" — it means the same thing.',
  }),
  createRegexRule({
    id: 'BW_implement',
    category: 'style',
    pattern:
      /\bimplement\s+(a|an|the|this|that|our|your|new)\s+(solution|plan|strategy|system|process|policy|change)\b/i,
    suggestion: (m) => `start ${m[1]} ${m[2]}`,
    reason: '"Implement" is corporate-speak. Try "start", "begin", "put in place", or "carry out".',
  }),
  createRegexRule({
    id: 'BW_facilitate',
    category: 'style',
    pattern: /\bfacilitate\b/i,
    suggestion: 'help',
    reason: '"Facilitate" is jargon. Use "help", "enable", "support", or "lead".',
  }),
  createRegexRule({
    id: 'BW_commence',
    category: 'style',
    pattern: /\bcommence\b/i,
    suggestion: 'begin',
    reason: '"Commence" is unnecessarily formal. Use "begin" or "start".',
  }),
  createRegexRule({
    id: 'BW_terminate',
    category: 'style',
    pattern: /\bterminate\s+(the|this|that|a|an|our|your|his|her|their)\b/i,
    suggestion: (m) => `end ${m[1]}`,
    reason: '"Terminate" is bureaucratic. Use "end", "stop", or "cancel".',
  }),
  createRegexRule({
    id: 'BW_endeavor',
    category: 'style',
    pattern: /\bendeavou?r\b/i,
    suggestion: 'try',
    reason: '"Endeavor" is unnecessarily formal. Use "try" or "attempt".',
  }),
  createRegexRule({
    id: 'BW_ascertain',
    category: 'style',
    pattern: /\bascertain\b/i,
    suggestion: 'find out',
    reason: '"Ascertain" is unnecessarily complex. Use "find out" or "determine".',
  }),
  createRegexRule({
    id: 'BW_ameliorate',
    category: 'style',
    pattern: /\bameliorate\b/i,
    suggestion: 'improve',
    reason: '"Ameliorate" is unnecessarily complex. Use "improve".',
  }),
  createRegexRule({
    id: 'BW_cognizant',
    category: 'style',
    pattern: /\bcognizant\b/i,
    suggestion: 'aware',
    reason: '"Cognizant" is unnecessarily complex. Use "aware".',
  }),
  createRegexRule({
    id: 'BW_elucidate',
    category: 'style',
    pattern: /\belucidate\b/i,
    suggestion: 'explain',
    reason: '"Elucidate" is unnecessarily complex. Use "explain" or "clarify".',
  }),
  createRegexRule({
    id: 'BW_expedite',
    category: 'style',
    pattern: /\bexpedite\b/i,
    suggestion: 'speed up',
    reason: '"Expedite" is corporate jargon. Use "speed up" or "accelerate".',
  }),
  createRegexRule({
    id: 'BW_remuneration',
    category: 'style',
    pattern: /\bremuneration\b/i,
    suggestion: 'pay',
    reason: '"Remuneration" is unnecessarily formal. Use "pay", "salary", or "compensation".',
  }),
  createRegexRule({
    id: 'BW_disseminate',
    category: 'style',
    pattern: /\bdisseminate\b/i,
    suggestion: 'share',
    reason: '"Disseminate" is unnecessarily complex. Use "share", "distribute", or "spread".',
  }),
  createRegexRule({
    id: 'BW_promulgate',
    category: 'style',
    pattern: /\bpromulgate\b/i,
    suggestion: 'announce',
    reason: '"Promulgate" is legal/bureaucratic. Use "announce", "publish", or "declare".',
  }),
  createRegexRule({
    id: 'BW_effectuate',
    category: 'style',
    pattern: /\beffectuate\b/i,
    suggestion: 'carry out',
    reason: '"Effectuate" is unnecessarily complex. Use "carry out" or "bring about".',
  }),
  createRegexRule({
    id: 'BW_incentivize',
    category: 'style',
    pattern: /\bincentivize\b/i,
    suggestion: 'encourage',
    reason: '"Incentivize" is corporate jargon. Use "encourage", "motivate", or "reward".',
  }),
  createRegexRule({
    id: 'BW_operationalize',
    category: 'style',
    pattern: /\boperationalize\b/i,
    suggestion: 'put into practice',
    reason: '"Operationalize" is corporate jargon. Use "put into practice" or "implement".',
  }),
  createRegexRule({
    id: 'BW_onboard',
    category: 'style',
    pattern:
      /\bonboard\s+(a|an|the|new|our)\s+(employee|team\s+member|hire|staff|colleague|person|candidate)\b/i,
    suggestion: (m) => `welcome ${m[1]} ${m[2]}`,
    reason: '"Onboard" as a verb is HR jargon. Try "welcome", "train", or "introduce".',
  }),

  // ═══ Polite Double Negatives (BW_004) ═══
  createRegexRule({
    id: 'BW_not_uncommon',
    category: 'clarity',
    pattern: /\bnot\s+uncommon\b/i,
    suggestion: 'common',
    reason: '"Not uncommon" is a double negative. Say "common" for clarity.',
  }),
  createRegexRule({
    id: 'BW_not_unlike',
    category: 'clarity',
    pattern: /\bnot\s+unlike\b/i,
    suggestion: 'similar to',
    reason: '"Not unlike" is a double negative. Say "similar to" for clarity.',
  }),
  createRegexRule({
    id: 'BW_not_insignificant',
    category: 'clarity',
    pattern: /\bnot\s+insignificant\b/i,
    suggestion: 'significant',
    reason: '"Not insignificant" is a double negative. Say "significant" directly.',
  }),
  createRegexRule({
    id: 'BW_not_unreasonable',
    category: 'clarity',
    pattern: /\bnot\s+unreasonable\b/i,
    suggestion: 'reasonable',
    reason: '"Not unreasonable" is a double negative. Say "reasonable" directly.',
  }),
  createRegexRule({
    id: 'BW_not_unimportant',
    category: 'clarity',
    pattern: /\bnot\s+unimportant\b/i,
    suggestion: 'important',
    reason: '"Not unimportant" is a double negative. Say "important" directly.',
  }),
  createRegexRule({
    id: 'BW_not_infrequent',
    category: 'clarity',
    pattern: /\bnot\s+infrequent(ly)?\b/i,
    suggestion: (m) => (m[1] ? 'frequently' : 'frequent'),
    reason: '"Not infrequent" is a double negative. Say "frequent" directly.',
  }),
];
