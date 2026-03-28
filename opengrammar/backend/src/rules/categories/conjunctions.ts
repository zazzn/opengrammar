import { type Rule, createRegexRule } from '../types.js';
import type { Issue } from '../../shared-types.js';

export const conjunctionRules: Rule[] = [
  // ═══ Redundant Conjunctions (CJ_RED) ═══
  createRegexRule({ id: 'CJ_RED_although_but', category: 'grammar', pattern: /\b(although|though|even\s+though)\b([^.]*?)\bbut\b/i, suggestion: (m) => `${m[1]}${m[2]}`, reason: '"Although" and "but" are redundant together. Remove one of them.' }),
  createRegexRule({ id: 'CJ_RED_because_so', category: 'grammar', pattern: /\bbecause\b([^.]*?)\bso\b/i, suggestion: (m) => `because${m[1]}`, reason: '"Because" and "so" are redundant together. Remove one of them.' }),
  createRegexRule({ id: 'CJ_RED_despite_but', category: 'grammar', pattern: /\b(despite|in\s+spite\s+of)\b([^.]*?)\bbut\b/i, suggestion: (m) => `${m[1]}${m[2]}`, reason: '"Despite" and "but" are redundant together. Remove "but".' }),

  // ═══ Wordy Conjunction Replacements (CJ_WRD) ═══
  createRegexRule({ id: 'CJ_WRD_due_to', category: 'clarity', pattern: /\bdue\s+to\s+the\s+fact\s+that\b/i, suggestion: 'because', reason: '"Due to the fact that" is wordy. Use "because" instead.' }),
  createRegexRule({ id: 'CJ_WRD_in_spite', category: 'clarity', pattern: /\bin\s+spite\s+of\s+the\s+fact\s+that\b/i, suggestion: 'although', reason: '"In spite of the fact that" is wordy. Use "although" instead.' }),
  createRegexRule({ id: 'CJ_WRD_regardless', category: 'clarity', pattern: /\bregardless\s+of\s+the\s+fact\s+that\b/i, suggestion: 'although', reason: '"Regardless of the fact that" is wordy. Use "although" instead.' }),
  createRegexRule({ id: 'CJ_WRD_for_purpose', category: 'clarity', pattern: /\bfor\s+the\s+purpose\s+of\b/i, suggestion: 'to', reason: '"For the purpose of" is wordy. Use "to" instead.' }),
  createRegexRule({ id: 'CJ_WRD_in_order', category: 'clarity', pattern: /\bin\s+order\s+to\b/i, suggestion: 'to', reason: '"In order to" is wordy. Use "to" instead.' }),
  createRegexRule({ id: 'CJ_WRD_in_event', category: 'clarity', pattern: /\bin\s+the\s+event\s+that\b/i, suggestion: 'if', reason: '"In the event that" is wordy. Use "if" instead.' }),
  createRegexRule({ id: 'CJ_WRD_in_light', category: 'clarity', pattern: /\bin\s+light\s+of\s+the\s+fact\s+that\b/i, suggestion: 'because', reason: '"In light of the fact that" is wordy. Use "because" instead.' }),
  createRegexRule({ id: 'CJ_WRD_exception', category: 'clarity', pattern: /\bwith\s+the\s+exception\s+of\b/i, suggestion: 'except', reason: '"With the exception of" is wordy. Use "except" instead.' }),
  createRegexRule({ id: 'CJ_WRD_at_this_point', category: 'clarity', pattern: /\bat\s+this\s+point\s+in\s+time\b/i, suggestion: 'now', reason: '"At this point in time" is wordy. Use "now" or "currently" instead.' }),
  createRegexRule({ id: 'CJ_WRD_in_the_near', category: 'clarity', pattern: /\bin\s+the\s+near\s+future\b/i, suggestion: 'soon', reason: '"In the near future" is wordy. Use "soon" instead.' }),
  createRegexRule({ id: 'CJ_WRD_at_present', category: 'clarity', pattern: /\bat\s+the\s+present\s+time\b/i, suggestion: 'now', reason: '"At the present time" is wordy. Use "now" instead.' }),
  createRegexRule({ id: 'CJ_WRD_on_account', category: 'clarity', pattern: /\bon\s+account\s+of\s+the\s+fact\s+that\b/i, suggestion: 'because', reason: '"On account of the fact that" is wordy. Use "because" instead.' }),
  createRegexRule({ id: 'CJ_WRD_by_means', category: 'clarity', pattern: /\bby\s+means\s+of\b/i, suggestion: 'by', reason: '"By means of" is wordy. Use "by" or "using" instead.' }),
  createRegexRule({ id: 'CJ_WRD_in_regard', category: 'clarity', pattern: /\bin\s+regard\s+to\b/i, suggestion: 'regarding', reason: '"In regard to" is wordy. Use "regarding" or "about" instead.' }),
  createRegexRule({ id: 'CJ_WRD_with_respect', category: 'clarity', pattern: /\bwith\s+respect\s+to\b/i, suggestion: 'regarding', reason: '"With respect to" is wordy. Use "regarding" or "about" instead.' }),
  createRegexRule({ id: 'CJ_WRD_has_ability', category: 'clarity', pattern: /\bhas\s+the\s+ability\s+to\b/i, suggestion: 'can', reason: '"Has the ability to" is wordy. Use "can" instead.' }),
  createRegexRule({ id: 'CJ_WRD_is_able', category: 'clarity', pattern: /\bis\s+able\s+to\b/i, suggestion: 'can', reason: '"Is able to" is wordy. Use "can" instead.' }),
  createRegexRule({ id: 'CJ_WRD_make_use', category: 'clarity', pattern: /\bmake\s+use\s+of\b/i, suggestion: 'use', reason: '"Make use of" is wordy. Use "use" instead.' }),
  createRegexRule({ id: 'CJ_WRD_take_into', category: 'clarity', pattern: /\btake\s+into\s+consideration\b/i, suggestion: 'consider', reason: '"Take into consideration" is wordy. Use "consider" instead.' }),
  createRegexRule({ id: 'CJ_WRD_a_large_number', category: 'clarity', pattern: /\ba\s+large\s+number\s+of\b/i, suggestion: 'many', reason: '"A large number of" is wordy. Use "many" instead.' }),
  createRegexRule({ id: 'CJ_WRD_sufficient_amount', category: 'clarity', pattern: /\ba\s+sufficient\s+amount\s+of\b/i, suggestion: 'enough', reason: '"A sufficient amount of" is wordy. Use "enough" instead.' }),
];
