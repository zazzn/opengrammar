import type { Issue } from '../../shared-types.js';
import { createRegexRule, type Rule } from '../types.js';

/**
 * ═══════════════════════════════════════════════════
 *  Academic & Scholarly Writing (AW)
 *  Weasel words, vague quantifiers, formality issues
 * ═══════════════════════════════════════════════════
 */
export const academicWritingRules: Rule[] = [
  // ═══ First Person in Academic (AW_001) ═══
  createRegexRule({
    id: 'AW_I_think',
    category: 'style',
    pattern: /\bI\s+think\s+that\b/i,
    suggestion: 'Evidence suggests that',
    reason: 'Avoid "I think" in academic writing. Use evidence-based language instead.',
  }),
  createRegexRule({
    id: 'AW_I_believe',
    category: 'style',
    pattern: /\bI\s+believe\s+that\b/i,
    suggestion: 'It can be argued that',
    reason: 'Avoid "I believe" in academic writing. Use objective phrasing.',
  }),
  createRegexRule({
    id: 'AW_I_feel',
    category: 'style',
    pattern: /\bI\s+feel\s+that\b/i,
    suggestion: 'The evidence indicates that',
    reason: 'Avoid "I feel" in academic writing. Support claims with evidence.',
  }),
  createRegexRule({
    id: 'AW_in_my_opinion',
    category: 'style',
    pattern: /\bin\s+my\s+opinion\b/i,
    suggestion: 'arguably',
    reason: '"In my opinion" is subjective. Use "arguably" or cite evidence.',
  }),
  createRegexRule({
    id: 'AW_I_personally',
    category: 'style',
    pattern: /\bI\s+personally\b/i,
    suggestion: '(remove or rephrase)',
    reason: '"I personally" is redundant and too subjective for academic writing.',
  }),
  createRegexRule({
    id: 'AW_obviously',
    category: 'style',
    pattern:
      /\b(obviously|clearly|of\s+course|needless\s+to\s+say|it\s+is\s+obvious\s+that|everyone\s+knows)\b/i,
    suggestion: '(remove)',
    reason:
      "If something is truly obvious, it doesn't need to be stated. These phrases can alienate readers who don't find it obvious.",
  }),

  // ═══ Weasel Words (AW_004) ═══
  createRegexRule({
    id: 'AW_some_people',
    category: 'style',
    pattern: /\bsome\s+people\s+(say|believe|think|argue|claim|suggest|feel)\b/i,
    suggestion: '[Cite specific source]',
    reason: '"Some people say" is vague. Cite specific sources or studies.',
  }),
  createRegexRule({
    id: 'AW_studies_show',
    category: 'style',
    pattern:
      /\bstudies\s+(show|suggest|indicate|have\s+shown|have\s+found|demonstrate|reveal|confirm)\b/i,
    suggestion: '[Author (Year)] found that',
    reason: '"Studies show" is vague. Cite the specific studies (Author, Year).',
  }),
  createRegexRule({
    id: 'AW_experts_say',
    category: 'style',
    pattern:
      /\b(experts|researchers|scientists|scholars|critics|analysts)\s+(say|believe|argue|claim|suggest|agree|think|note|point\s+out)\b/i,
    suggestion: '[Named experts] argue that',
    reason: 'Name the specific experts and cite their work.',
  }),
  createRegexRule({
    id: 'AW_it_is_believed',
    category: 'style',
    pattern:
      /\bit\s+is\s+(widely\s+)?(believed|known|accepted|understood|recognized|acknowledged|thought|assumed|considered)\b/i,
    suggestion: '[Citation needed]',
    reason: 'Who believes/knows this? Provide a citation for the claim.',
  }),
  createRegexRule({
    id: 'AW_many_argue',
    category: 'style',
    pattern:
      /\b(many|several|numerous|various|certain)\s+(people|scholars|researchers|experts|critics|authors|studies)\s+(have\s+)?(argued|suggested|claimed|shown|demonstrated|noted|found|stated|asserted)\b/i,
    suggestion: '[Specific citation needed]',
    reason: 'Quantify or cite specific sources instead of vague attribution.',
  }),
  createRegexRule({
    id: 'AW_recently',
    category: 'style',
    pattern: /\brecently\b/i,
    suggestion: 'In [specific year/period]',
    reason: '"Recently" is vague in academic writing. Specify the time period.',
  }),

  // ═══ Informal Transitions (AW_006) ═══
  createRegexRule({
    id: 'AW_plus_start',
    category: 'style',
    pattern: /(?:^|[.!?]\s+)Plus\s+/g,
    suggestion: 'Additionally, ',
    reason:
      '"Plus" at the start of a sentence is informal. Use "Additionally", "Moreover", or "Furthermore".',
  }),
  createRegexRule({
    id: 'AW_also_start',
    category: 'style',
    pattern: /(?:^|[.!?]\s+)Also\s*,/g,
    suggestion: 'Furthermore,',
    reason:
      '"Also" starting a sentence is informal. Use "Furthermore", "Moreover", or "In addition".',
  }),
  createRegexRule({
    id: 'AW_so_start',
    category: 'style',
    pattern: /(?:^|[.!?]\s+)So\s+/g,
    suggestion: 'Therefore, ',
    reason: '"So" starting a sentence is informal. Use "Therefore", "Consequently", or "Thus".',
  }),
  createRegexRule({
    id: 'AW_anyway_start',
    category: 'style',
    pattern: /(?:^|[.!?]\s+)Anyway\s*,/g,
    suggestion: 'Nevertheless,',
    reason: '"Anyway" is informal. Use "Nevertheless", "Regardless", or "In any case".',
  }),
  createRegexRule({
    id: 'AW_well_start',
    category: 'style',
    pattern: /(?:^|[.!?]\s+)Well\s*,/g,
    suggestion: '',
    reason: '"Well" as a sentence starter is conversational filler. Remove it in academic writing.',
  }),
  createRegexRule({
    id: 'AW_basically',
    category: 'style',
    pattern: /\bbasically\b/i,
    suggestion: '(remove)',
    reason: '"Basically" is filler in academic writing. State the point directly.',
  }),
  createRegexRule({
    id: 'AW_actually',
    category: 'style',
    pattern: /\bactually\b/i,
    suggestion: '(remove or rephrase)',
    reason: '"Actually" is often filler. Remove it unless correcting a misconception.',
  }),

  // ═══ Hedging Excess (AW — related to ST_003) ═══
  createRegexRule({
    id: 'AW_sort_of',
    category: 'style',
    pattern:
      /\bsort\s+of\s+(a|an|the|like|similar|different|important|interesting|difficult|easy|good|bad|big|small)\b/i,
    suggestion: (m) => `somewhat ${m[1]}`,
    reason: '"Sort of" is vague and informal. Use "somewhat" or be more precise.',
  }),
  createRegexRule({
    id: 'AW_kind_of',
    category: 'style',
    pattern:
      /\bkind\s+of\s+(a|an|the|like|similar|different|important|interesting|difficult|easy|good|bad|big|small)\b/i,
    suggestion: (m) => `somewhat ${m[1]}`,
    reason: '"Kind of" is vague and informal. Use "somewhat" or be more precise.',
  }),
  createRegexRule({
    id: 'AW_it_could',
    category: 'style',
    pattern: /\bit\s+could\s+be\s+argued\s+that\b/i,
    suggestion: 'One argument is that',
    reason: '"It could be argued" is weak hedging. State the argument directly.',
  }),
];
