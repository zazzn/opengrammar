import type { Issue } from '../../shared-types.js';
import { createRegexRule, type Rule } from '../types.js';

export const adjectivesAdverbsRules: Rule[] = [
  // ═══ Good/Well Confusion (AA_GDW) ═══
  createRegexRule({
    id: 'AA_GDW_plays',
    category: 'grammar',
    pattern:
      /\b(plays|writes|performs|works|functions|runs|speaks|sings|dances|cooks|drives|reads|does|handles|communicates|operates|manages)\s+good\b/i,
    suggestion: (m) => `${m[1]} well`,
    reason: '"Good" is an adjective. Use the adverb "well" after action verbs.',
  }),

  // ═══ Adjective vs Adverb Confusion (AA_ADV) ═══
  createRegexRule({
    id: 'AA_ADV_beautiful',
    category: 'grammar',
    pattern: /\b(sings|plays|dances|writes|speaks|performs)\s+beautiful\b/i,
    suggestion: (m) => `${m[1]} beautifully`,
    reason: 'Use the adverb "beautifully" to modify a verb, not the adjective "beautiful".',
  }),
  createRegexRule({
    id: 'AA_ADV_quick',
    category: 'grammar',
    pattern: /\b(runs|moves|walks|types|responds|reacts|acts|thinks|learns|grows)\s+quick\b/i,
    suggestion: (m) => `${m[1]} quickly`,
    reason: 'Use the adverb "quickly" to modify a verb, not the adjective "quick".',
  }),
  createRegexRule({
    id: 'AA_ADV_bad',
    category: 'grammar',
    pattern: /\b(performs|writes|speaks|plays|behaves|acts|handles)\s+bad\b/i,
    suggestion: (m) => `${m[1]} badly`,
    reason: 'Use the adverb "badly" to modify a verb. "Bad" is an adjective.',
  }),
  createRegexRule({
    id: 'AA_ADV_real',
    category: 'grammar',
    pattern:
      /\b(real)\s+(good|nice|fast|quick|bad|hard|easy|big|small|important|interesting|beautiful|difficult)\b/i,
    suggestion: (m) => `really ${m[2]}`,
    reason: '"Real" is an adjective. Use the adverb "really" to modify another adjective.',
  }),

  // ═══ Double Comparatives (AA_CMP) ═══
  createRegexRule({
    id: 'AA_CMP_more_er',
    category: 'grammar',
    pattern:
      /\bmore\s+(bigger|smaller|taller|shorter|faster|slower|older|younger|easier|harder|simpler|wider|narrower|louder|quieter|nicer|safer|cleaner|closer|newer|darker|brighter|stronger|weaker|smarter|cheaper|richer|poorer|thinner|thicker|longer|lighter|heavier|cooler|warmer|hotter|colder)\b/i,
    suggestion: (m) => m[1] || '',
    reason: 'Do not combine "more" with the -er comparative form. Use one or the other.',
  }),
  createRegexRule({
    id: 'AA_CMP_most_est',
    category: 'grammar',
    pattern:
      /\bmost\s+(biggest|smallest|tallest|shortest|fastest|slowest|oldest|youngest|easiest|hardest|simplest|widest|narrowest|loudest|quietest|nicest|safest|cleanest|closest|newest|darkest|brightest|strongest|weakest|smartest|cheapest|richest|poorest)\b/i,
    suggestion: (m) => m[1] || '',
    reason: 'Do not combine "most" with the -est superlative form. Use one or the other.',
  }),

  // ═══ Irregular Comparatives (AA_IRR) ═══
  createRegexRule({
    id: 'AA_IRR_gooder',
    category: 'grammar',
    pattern: /\bgooder\b/i,
    suggestion: 'better',
    reason: 'The comparative of "good" is "better", not "gooder".',
  }),
  createRegexRule({
    id: 'AA_IRR_goodest',
    category: 'grammar',
    pattern: /\bgoodest\b/i,
    suggestion: 'best',
    reason: 'The superlative of "good" is "best", not "goodest".',
  }),
  createRegexRule({
    id: 'AA_IRR_badder',
    category: 'grammar',
    pattern: /\bbadder\b/i,
    suggestion: 'worse',
    reason: 'The comparative of "bad" is "worse", not "badder".',
  }),
  createRegexRule({
    id: 'AA_IRR_baddest',
    category: 'grammar',
    pattern: /\bbaddest\b/i,
    suggestion: 'worst',
    reason: 'The superlative of "bad" is "worst", not "baddest".',
  }),
  createRegexRule({
    id: 'AA_IRR_more_good',
    category: 'grammar',
    pattern: /\bmore\s+good\b/i,
    suggestion: 'better',
    reason: 'The comparative of "good" is "better", not "more good".',
  }),
  createRegexRule({
    id: 'AA_IRR_most_good',
    category: 'grammar',
    pattern: /\bmost\s+good\b/i,
    suggestion: 'best',
    reason: 'The superlative of "good" is "best", not "most good".',
  }),
  createRegexRule({
    id: 'AA_IRR_more_bad',
    category: 'grammar',
    pattern: /\bmore\s+bad\b/i,
    suggestion: 'worse',
    reason: 'The comparative of "bad" is "worse", not "more bad".',
  }),
  createRegexRule({
    id: 'AA_IRR_most_bad',
    category: 'grammar',
    pattern: /\bmost\s+bad\b/i,
    suggestion: 'worst',
    reason: 'The superlative of "bad" is "worst", not "most bad".',
  }),

  // ═══ Absolute Adjectives (AA_ABS) ═══
  createRegexRule({
    id: 'AA_ABS_unique',
    category: 'style',
    pattern:
      /\b(very|more|most|extremely|really|somewhat|rather|slightly|fairly)\s+(unique|perfect|complete|dead|infinite|impossible|universal|absolute|essential|fatal|final|total|eternal|entire|supreme|unanimous|empty|equal|round|square|pregnant)\b/i,
    suggestion: (m: RegExpExecArray) => m[2] || '',
    reason:
      'This is an absolute adjective and cannot logically be compared or intensified. Remove the modifier.',
  }),

  // ═══ Participial Adjectives: -ed vs -ing (AA_PAR) ═══
  createRegexRule({
    id: 'AA_PAR_boring',
    category: 'grammar',
    pattern:
      /\b(I|he|she|we|they|you)\s+(am|is|are|was|were|feel|felt)\s+(boring|interesting|exciting|confusing|tiring|surprising|amazing|amusing|annoying|disappointing|embarrassing|exhausting|frightening|frustrating|inspiring|overwhelming|relaxing|satisfying|shocking|terrifying|thrilling|worrying)\b/i,
    suggestion: (m) => `${m[1]} ${m[2]} ${(m[3] || '').replace(/ing$/, 'ed')}`,
    reason:
      'Use the -ed form when describing how a person FEELS. The -ing form describes what CAUSES the feeling.',
  }),
  createRegexRule({
    id: 'AA_PAR_bored',
    category: 'grammar',
    pattern:
      /\b(the\s+)?(movie|book|film|show|game|class|lesson|lecture|speech|presentation|talk|story|news|weather|trip|journey|experience|event|meeting|conversation|discussion|debate|task|job|work|project|assignment)\s+(is|are|was|were)\s+(bored|interested|excited|confused|tired|surprised|amazed|amused|annoyed|disappointed|embarrassed|exhausted|frightened|frustrated|inspired|overwhelmed|relaxed|satisfied|shocked|terrified|thrilled|worried)\b/i,
    suggestion: (m) => `${m[1] || ''}${m[2]} ${m[3]} ${(m[4] || '').replace(/ed$/, 'ing')}`,
    reason:
      'Use the -ing form when describing something that CAUSES a feeling. The -ed form describes how people feel.',
  }),
];
