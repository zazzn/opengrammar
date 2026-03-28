import type { Issue } from '../../shared-types.js';
import { createRegexRule, type Rule } from '../types.js';

/**
 * ═══════════════════════════════════════════════════
 *  Readability & Simplification (RD)
 *  Complex words, sentence length, paragraph length
 * ═══════════════════════════════════════════════════
 */
export const readabilityRules: Rule[] = [
  // ═══ Complex Word Simplification (RD_003) ═══
  createRegexRule({
    id: 'RD_utilize',
    category: 'clarity',
    pattern: /\butilize\b/i,
    suggestion: 'use',
    reason: '"Utilize" can almost always be replaced with the simpler "use".',
  }),
  createRegexRule({
    id: 'RD_demonstrate',
    category: 'clarity',
    pattern: /\bdemonstrate\b/i,
    suggestion: 'show',
    reason: '"Demonstrate" can often be simplified to "show".',
  }),
  createRegexRule({
    id: 'RD_approximately',
    category: 'clarity',
    pattern: /\bapproximately\b/i,
    suggestion: 'about',
    reason: '"Approximately" can be simplified to "about" or "roughly".',
  }),
  createRegexRule({
    id: 'RD_subsequent',
    category: 'clarity',
    pattern: /\bsubsequent\b/i,
    suggestion: 'next',
    reason: '"Subsequent" can be simplified to "next" or "following".',
  }),
  createRegexRule({
    id: 'RD_prior_to',
    category: 'clarity',
    pattern: /\bprior\s+to\b/i,
    suggestion: 'before',
    reason: '"Prior to" can be simplified to "before".',
  }),
  createRegexRule({
    id: 'RD_sufficient',
    category: 'clarity',
    pattern: /\bsufficient\b/i,
    suggestion: 'enough',
    reason: '"Sufficient" can be simplified to "enough".',
  }),
  createRegexRule({
    id: 'RD_nevertheless',
    category: 'clarity',
    pattern: /\bnevertheless\b/i,
    suggestion: 'still',
    reason: '"Nevertheless" can often be simplified to "still", "yet", or "however".',
  }),
  createRegexRule({
    id: 'RD_notwithstanding',
    category: 'clarity',
    pattern: /\bnotwithstanding\b/i,
    suggestion: 'despite',
    reason: '"Notwithstanding" can be simplified to "despite" or "in spite of".',
  }),
  createRegexRule({
    id: 'RD_heretofore',
    category: 'clarity',
    pattern: /\bheretofore\b/i,
    suggestion: 'previously',
    reason: '"Heretofore" is archaic. Use "previously" or "until now".',
  }),
  createRegexRule({
    id: 'RD_aforementioned',
    category: 'clarity',
    pattern: /\baforementioned\b/i,
    suggestion: 'previous',
    reason: '"Aforementioned" is overly formal. Use "previous", "earlier", or just name the thing.',
  }),
  createRegexRule({
    id: 'RD_inasmuch',
    category: 'clarity',
    pattern: /\binasmuch\s+as\b/i,
    suggestion: 'since',
    reason: '"Inasmuch as" is archaic. Use "since" or "because".',
  }),
  createRegexRule({
    id: 'RD_henceforth',
    category: 'clarity',
    pattern: /\bhenceforth\b/i,
    suggestion: 'from now on',
    reason: '"Henceforth" is archaic. Use "from now on".',
  }),
  createRegexRule({
    id: 'RD_moreover',
    category: 'clarity',
    pattern: /\bmoreover\b/i,
    suggestion: 'also',
    reason: '"Moreover" can usually be simplified to "also" or "besides".',
  }),
  createRegexRule({
    id: 'RD_furthermore',
    category: 'clarity',
    pattern: /\bfurthermore\b/i,
    suggestion: 'also',
    reason: '"Furthermore" can usually be simplified to "also" or "in addition".',
  }),
  createRegexRule({
    id: 'RD_consequently',
    category: 'clarity',
    pattern: /\bconsequently\b/i,
    suggestion: 'so',
    reason: '"Consequently" can often be simplified to "so" or "as a result".',
  }),
  createRegexRule({
    id: 'RD_predominantly',
    category: 'clarity',
    pattern: /\bpredominantly\b/i,
    suggestion: 'mainly',
    reason: '"Predominantly" can be simplified to "mainly" or "mostly".',
  }),
  createRegexRule({
    id: 'RD_necessitate',
    category: 'clarity',
    pattern: /\bnecessitate\b/i,
    suggestion: 'require',
    reason: '"Necessitate" can be simplified to "require" or "need".',
  }),
  createRegexRule({
    id: 'RD_endeavour',
    category: 'clarity',
    pattern: /\bendeavou?r\b/i,
    suggestion: 'try',
    reason: '"Endeavor" is unnecessarily formal. Use "try" or "attempt".',
  }),
  createRegexRule({
    id: 'RD_commensurate',
    category: 'clarity',
    pattern: /\bcommensurate\b/i,
    suggestion: 'proportional',
    reason: '"Commensurate" can be simplified to "proportional" or "matching".',
  }),
  createRegexRule({
    id: 'RD_multifaceted',
    category: 'clarity',
    pattern: /\bmultifaceted\b/i,
    suggestion: 'complex',
    reason: '"Multifaceted" can be simplified to "complex" or "varied".',
  }),
  createRegexRule({
    id: 'RD_dichotomy',
    category: 'clarity',
    pattern: /\bdichotomy\b/i,
    suggestion: 'divide',
    reason: '"Dichotomy" can be simplified to "divide", "split", or "contrast".',
  }),
  createRegexRule({
    id: 'RD_ubiquitous',
    category: 'clarity',
    pattern: /\bubiquitous\b/i,
    suggestion: 'widespread',
    reason: '"Ubiquitous" can be simplified to "widespread" or "everywhere".',
  }),
  createRegexRule({
    id: 'RD_juxtapose',
    category: 'clarity',
    pattern: /\bjuxtapose\b/i,
    suggestion: 'compare',
    reason: '"Juxtapose" can be simplified to "compare" or "place side by side".',
  }),
  createRegexRule({
    id: 'RD_ameliorate',
    category: 'clarity',
    pattern: /\bameliorate\b/i,
    suggestion: 'improve',
    reason: '"Ameliorate" can be simplified to "improve" or "make better".',
  }),
  createRegexRule({
    id: 'RD_exacerbate',
    category: 'clarity',
    pattern: /\bexacerbate\b/i,
    suggestion: 'worsen',
    reason: '"Exacerbate" can be simplified to "worsen" or "make worse".',
  }),
  createRegexRule({
    id: 'RD_proliferate',
    category: 'clarity',
    pattern: /\bproliferate\b/i,
    suggestion: 'spread',
    reason: '"Proliferate" can be simplified to "spread" or "increase rapidly".',
  }),
  createRegexRule({
    id: 'RD_myriad',
    category: 'clarity',
    pattern: /\ba\s+myriad\s+of\b/i,
    suggestion: 'many',
    reason: '"A myriad of" is wordy. Use "many" or "countless". (Or: "myriad" without "a...of").',
  }),
  createRegexRule({
    id: 'RD_plethora',
    category: 'clarity',
    pattern: /\ba\s+plethora\s+of\b/i,
    suggestion: 'many',
    reason: '"A plethora of" is wordy. Use "many", "plenty of", or "an abundance of".',
  }),
  createRegexRule({
    id: 'RD_quintessential',
    category: 'clarity',
    pattern: /\bquintessential\b/i,
    suggestion: 'classic',
    reason: '"Quintessential" can be simplified to "classic", "ideal", or "perfect example of".',
  }),
  createRegexRule({
    id: 'RD_paradigm',
    category: 'clarity',
    pattern: /\bparadigm\b/i,
    suggestion: 'model',
    reason: '"Paradigm" is overused jargon. Use "model", "framework", or "pattern".',
  }),

  // ═══ Very Long Sentences (RD_001) ═══
  {
    id: 'RD_long_sentence',
    type: 'regex',
    category: 'clarity',
    pattern: /[^.!?]+[.!?]+/g,
    reason: 'Very long sentence detected.',
    suggestion: 'Consider breaking this into shorter sentences.',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      let offset = 0;
      for (const sentence of sentences) {
        const wordCount = sentence.trim().split(/\s+/).length;
        if (wordCount > 40) {
          issues.push({
            id: `RD_long_sentence-${offset}`,
            type: 'clarity',
            original: sentence.trim().substring(0, 60) + '...',
            suggestion: 'Consider breaking this into shorter sentences.',
            reason: `This sentence has ${wordCount} words. Sentences over 40 words are difficult to read.`,
            offset,
            length: sentence.length,
          });
        }
        offset += sentence.length;
      }
      return issues;
    },
  },

  // ═══ Repeated Sentence Beginnings (RD_005) ═══
  {
    id: 'RD_repeated_starts',
    type: 'regex',
    category: 'style',
    pattern: /[^.!?]+[.!?]+/g,
    reason: 'Repeated sentence beginnings reduce readability.',
    suggestion: 'Vary your sentence openings.',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length < 3) return issues;

      let offset = 0;
      for (let i = 2; i < sentences.length; i++) {
        const getStart = (s: string) => (s.trim().split(/\s+/)[0] || '').toLowerCase();
        const w1 = getStart(sentences[i - 2] || '');
        const w2 = getStart(sentences[i - 1] || '');
        const w3 = getStart(sentences[i] || '');

        if (w1 && w1 === w2 && w2 === w3 && !['the', 'a', 'an', 'i'].includes(w1)) {
          const sentenceOffset = text.indexOf((sentences[i] || '').trim(), offset);
          if (sentenceOffset >= 0) {
            issues.push({
              id: `RD_repeated_starts-${sentenceOffset}`,
              type: 'style',
              original: (sentences[i] || '').trim().substring(0, 40) + '...',
              suggestion: 'Vary your sentence openings for better flow.',
              reason: `Three consecutive sentences start with "${w1}". Vary your sentence beginnings.`,
              offset: sentenceOffset,
              length: (sentences[i] || '').trim().length,
            });
          }
        }
        offset += (sentences[i - 2] || '').length;
      }
      return issues;
    },
  },
];
