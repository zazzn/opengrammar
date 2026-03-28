import type { Issue } from '../../shared-types.js';
import { createRegexRule, type Rule } from '../types.js';

export const styleRules: Rule[] = [
  // Passive Voice via Regex (legacy)
  createRegexRule({
    id: 'passive-voice-ed',
    category: 'style',
    pattern: /\b(am|are|is|was|were|be|been|being)\s+(\w+ed)\b/i,
    suggestion: 'Consider using active voice',
    reason: 'Passive voice can make sentences weaker and less direct.',
  }),
  createRegexRule({
    id: 'passive-voice-en',
    category: 'style',
    pattern: /\b(am|are|is|was|were|be|been|being)\s+(\w+en)\b/i,
    suggestion: 'Consider using active voice',
    reason: 'Passive voice can make sentences weaker and less direct.',
  }),

  // NEW NLP Rule: Detect consecutive nouns (Noun String) which are hard to read
  {
    id: 'noun-string',
    type: 'nlp',
    category: 'clarity',
    reason: 'Long strings of nouns reduce clarity. Try using prepositions to separate them.',
    suggestion: 'Consider rephrasing',
    check: (text: string, doc: any): Issue[] => {
      const issues: Issue[] = [];
      const matches = doc.match('#Noun #Noun #Noun #Noun+');
      matches.forEach((m: any) => {
        const str = m.text();
        const offset = text.indexOf(str);
        if (offset !== -1) {
          issues.push({
            id: `noun-string-${offset}`,
            type: 'clarity',
            original: str,
            suggestion: 'Consider rephrasing',
            reason: 'Long strings of nouns are hard to read.',
            offset,
            length: str.length,
          });
        }
      });
      return issues;
    },
  },

  // NEW NLP Rule: Avoid starting sentences with coordinating conjunctions heavily
  {
    id: 'conjunction-start',
    type: 'nlp',
    category: 'style',
    reason: 'Starting a sentence with "And" or "But" can make writing less formal.',
    suggestion: 'Consider merging sentences or removing',
    check: (text: string, doc: any): Issue[] => {
      const issues: Issue[] = [];
      const matches = doc.match('^#Conjunction');
      matches.forEach((m: any) => {
        const str = m.text();
        const offset = text.indexOf(str);
        if (offset !== -1 && (str.toLowerCase() === 'and ' || str.toLowerCase() === 'but ')) {
          issues.push({
            id: `conjunction-start-${offset}`,
            type: 'style',
            original: str.trim(),
            suggestion: 'Additionally, / However,',
            reason: 'Starting sentences with coordinating conjunctions is informal.',
            offset,
            length: str.trim().length,
          });
        }
      });
      return issues;
    },
  },
];
