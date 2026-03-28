import { createRegexRule, type Rule } from '../types.js';

/**
 * ════════════════════════════════════════════════════════════
 *  Dangling Modifier Rules — DM Module
 *
 *  A dangling modifier is a word or phrase that describes
 *  something that is implied but not explicitly stated.
 *  The classic test: "who is doing the [verb]ing?"
 *  If the answer doesn't match the subject of the main clause → dangling.
 *
 *  Examples:
 *    "Walking down the street, the rain started." (rain can't walk)
 *    "Having finished the essay, the TV was turned on." (TV didn't finish)
 *    "To improve your writing, grammar must be studied." (grammar isn't improving)
 * ════════════════════════════════════════════════════════════
 */
export const danglingModifierRules: Rule[] = [

  // ═══════════════════════════════════════════════════════
  // 1. PRESENT PARTICIPLE PHRASES (Walking/Running/etc. + ,)
  //    Pattern: gerund phrase → comma → inanimate/wrong subject
  // ═══════════════════════════════════════════════════════
  createRegexRule({
    id: 'DM_PRES_PART_inanimate',
    category: 'grammar',
    pattern: /^(Walking|Running|Driving|Looking|Talking|Working|Sitting|Standing|Playing|Eating|Drinking|Reading|Writing|Watching|Thinking|Speaking|Listening|Waiting|Sleeping|Swimming|Flying|Climbing|Jumping|Dancing|Singing|Laughing|Crying|Shopping|Cooking|Cleaning|Fixing|Building|Breaking|Opening|Closing|Carrying|Pushing|Pulling|Lifting|Drawing|Painting|Teaching|Studying|Planning|Deciding|Moving|Turning)\s+[^,]+,\s+(the\s+(?!speaker|author|writer|narrator|user|reader|person|man|woman|student|teacher|team|police|doctor|nurse|officer|employee|manager|owner|player|customer|client|victim)\w+|a\s+\w+|it\s+|there\s+|this\s+|that\s+)\b/i,
    suggestion: (m) => {
      const verb = m[1].toLowerCase();
      const gerund = verb.endsWith('ing') ? verb : verb + 'ing';
      return `[Subject who is ${gerund}], ${m[2].trim()}...`;
    },
    reason: 'Dangling modifier: clarify who is performing the action at the start of the sentence. The participial phrase must describe the main clause\'s subject.',
  }),

  // ═══════════════════════════════════════════════════════
  // 2. PERFECT PARTICIPIAL PHRASES (Having + past participle)
  // ═══════════════════════════════════════════════════════
  createRegexRule({
    id: 'DM_PERF_PART_having',
    category: 'grammar',
    pattern: /^Having\s+(?:just\s+|recently\s+|finally\s+|already\s+|nearly\s+|almost\s+)?(finished|completed|done|eaten|drunk|written|read|watched|seen|heard|found|met|left|arrived|returned|decided|chosen|learned|studied|prepared|reviewed|checked|fixed|broken|opened|closed|taken|given|sent|received|made|built|drawn|painted|bought|sold|lost|won|started|ended|begun|stopped|tried|used|worked|gone|come|got|become|felt|thought|said|told|called|visited|helped|supported|managed|organized|set|put|run)\s+[^,]+,\s+(the\s+(?!author|speaker|writer|subject|team|group|reader|narrator)\w+|a\s+\w+|it\s+|there\s+|this\s+|that\s+)/i,
    suggestion: (m) => `Having ${m[1]} [what], [the person who did it] ...`,
    reason: 'Dangling modifier: "Having [done something]..." must describe the subject of the main clause. Clarify who performed this action.',
  }),

  // ═══════════════════════════════════════════════════════
  // 3. INFINITIVE PHRASES (To + verb + ..., passive main clause)
  //    "To improve writing, grammar must be studied." ← dangling
  // ═══════════════════════════════════════════════════════
  createRegexRule({
    id: 'DM_INF_passive',
    category: 'grammar',
    pattern: /^To\s+(\w+)\s+(?:your\s+|the\s+|a\s+|an\s+|our\s+|their\s+|its\s+|one'?s\s+)?\w+[^,]*,\s+\w+\s+(must\s+be|should\s+be|needs?\s+to\s+be|has?\s+to\s+be|will\s+be|can\s+be|could\s+be|would\s+be|is\s+being|was\s+being|are\s+being)\s+/i,
    suggestion: (m) => `To ${m[1]} ..., [you/one] should ... (avoid passive voice after an infinitive phrase)`,
    reason: 'Dangling infinitive: "To [verb]..." should be followed by the person performing the action, not a passive clause.',
  }),

  // ═══════════════════════════════════════════════════════
  // 4. "BEING" PHRASES
  //    "Being a student, the exam was stressful." ← dangling
  // ═══════════════════════════════════════════════════════
  createRegexRule({
    id: 'DM_BEING_phrase',
    category: 'grammar',
    pattern: /^Being\s+(?:a\s+|an\s+|the\s+)?(?:young\s+|old\s+|good\s+|new\s+|senior\s+|junior\s+)?\w+[^,]*,\s+(the\s+(?!author|speaker|writer|person|team)\w+|a\s+\w+|it\s+|this\s+|that\s+)/i,
    suggestion: (m) => `Being [description], [the person] ... (not "${m[1].trim()}")`,
    reason: 'Dangling modifier: "Being ..." should describe the subject of the main clause, not a different object.',
  }),

  // ═══════════════════════════════════════════════════════
  // 5. "AFTER/BEFORE/WHILE + GERUND" PHRASES (passive main clause)
  // ═══════════════════════════════════════════════════════
  createRegexRule({
    id: 'DM_PREP_GERUND_passive',
    category: 'grammar',
    pattern: /^(After|Before|While|Upon|When)\s+(\w+ing)\s+[^,]+,\s+(?:the\s+|a\s+|an\s+)\w+\s+(was|were|is|are|will\s+be|has\s+been|have\s+been|had\s+been)\s+(?:given|awarded|presented|offered|provided|sent|told|shown|handed|issued|assigned|denied|refused|granted)\b/i,
    suggestion: (m) => `${m[1]} ${m[2]} ..., [the person] received / was given...`,
    reason: 'Dangling modifier: the participial phrase implies a subject that differs from the passive main clause\'s subject.',
  }),

  // ═══════════════════════════════════════════════════════
  // 6. "WHEN/WHILE" OMITTED SUBJECT
  //    "When cooking, the smoke alarm went off." ← dangling
  // ═══════════════════════════════════════════════════════
  createRegexRule({
    id: 'DM_WHEN_omitted',
    category: 'grammar',
    pattern: /^(When|While|Whenever)\s+(cooking|baking|driving|sleeping|running|swimming|exercising|showering|bathing|reading|studying|working|traveling|hiking|climbing|skiing|playing|drinking|eating)\s*,\s+(the\s+(?!person|speaker|author|user|student|teacher)\w+|a\s+\w+|it\s+|no\s+one|nothing|everyone|everything)\s+(went|started|began|happened|occurred|was|appeared|seemed|became|felt)\b/i,
    suggestion: (m) => `${m[1]} [someone was] ${m[2]}ing, ${m[3]} ${m[4]}...`,
    reason: 'Dangling modifier: add an explicit subject ("When I was cooking..." not "When cooking, the alarm...").',
  }),

  // ═══════════════════════════════════════════════════════
  // 7. AS A + NOUN PHRASES
  //    "As a student, the book was assigned to us." ← dangling
  // ═══════════════════════════════════════════════════════
  createRegexRule({
    id: 'DM_AS_A_phrase',
    category: 'grammar',
    pattern: /^As\s+(?:a|an|the)\s+\w+[^,]*,\s+(the\s+(?!author|speaker|writer|narrator|person|teacher|student|team|group|doctor|manager|officer)\w+|a\s+\w+|it\s+|this\s+|that\s+)\s+(was|were|is|are|has\s+been|had\s+been|will\s+be|needs?\s+to)\b/i,
    suggestion: (m) => `As [the role], [I/we/one] ... (not "${m[1].trim()} ${m[2]}")`,
    reason: 'Dangling modifier: "As a [role]..." must describe the subject of the main clause — the subject should be the person in that role.',
  }),

  // ═══════════════════════════════════════════════════════
  // 8. "ONLY" MISPLACEMENT
  // ═══════════════════════════════════════════════════════
  createRegexRule({
    id: 'DM_ONLY_misplaced_time',
    category: 'grammar',
    pattern: /\b(I|he|she|they|we|you)\s+only\s+(eat|ate|drink|drank|work|worked|go|went|use|used|spend|spent|visit|visited|call|called|meet|met|write|wrote|read|run|play|played|watch|watched)\s+(\w+)\s+on\b/i,
    suggestion: (m) => `${m[1]} ${m[2]} ${m[3]} only on`,
    reason: 'Misplaced "only": move it directly before the word it modifies. E.g., "I eat vegetables only on Mondays."',
  }),
  createRegexRule({
    id: 'DM_ONLY_misplaced_verb',
    category: 'grammar',
    pattern: /\b(I|he|she|they|we|you)\s+only\s+(need|needed|want|wanted|have|had|like|liked|love|loved|hate|hated|prefer|preferred|do|did|can|could|will|would|should|must|may|might)\s+(?:to\s+)?(\w+)\s+(because|when|if|since|after|although)\b/i,
    suggestion: (m) => `${m[1]} ${m[2]} ${m[3]} only ${m[4]} — or move "only" before what it modifies`,
    reason: 'Misplaced "only": position it right before the word it logically modifies to avoid ambiguity.',
  }),
];
