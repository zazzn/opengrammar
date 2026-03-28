import { type Rule, createRegexRule } from '../types.js';
import type { Issue } from '../../shared-types.js';

export const capitalizationRules: Rule[] = [
  // Standalone I
  {
    id: 'cap-i',
    type: 'regex',
    category: 'grammar',
    pattern: /(?:^|\s)(i)(?=\s|['’]m|[.,!?]|$)/g,
    reason: 'The pronoun "I" should always be capitalized.',
    suggestion: 'I',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const iRegex = /(?:^|\s)(i)(?=\s|['’]m|[.,!?]|$)/g;
      let match: RegExpExecArray | null;
      while ((match = iRegex.exec(text)) !== null) {
        const matchIndex = match.index + match[0].indexOf('i');
        issues.push({
          id: `cap-i-${matchIndex}`,
          type: 'grammar',
          original: 'i',
          suggestion: 'I',
          reason: 'The pronoun "I" should always be capitalized.',
          offset: matchIndex,
          length: 1,
        });
      }
      return issues;
    }
  },

  // Days and Months
  createRegexRule({
    id: 'cap-date',
    category: 'grammar',
    pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/g,
    suggestion: (m) => m[1].charAt(0).toUpperCase() + m[1].slice(1),
    reason: 'Days of the week and months should be capitalized.'
  }),

  // Common Proper Nouns
  createRegexRule({
    id: 'cap-proper-noun',
    category: 'grammar',
    pattern: /\b(swadhin|dhaka|john|mary|london|paris|america|india|bangladesh|google|microsoft|apple|facebook)\b/g,
    suggestion: (m) => m[1].charAt(0).toUpperCase() + m[1].slice(1),
    reason: 'Proper nouns, names, and places should be capitalized.'
  }),

  // First letter of sentences
  {
    id: 'cap-sentence-start',
    type: 'regex',
    category: 'grammar',
    pattern: /(?:^|[.!?]\s+)([a-z])/g,
    reason: 'The first word of a sentence should be capitalized.',
    suggestion: '',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const sentenceStartRegex = /(?:^|[.!?]\s+)([a-z])/g;
      let match: RegExpExecArray | null;
      while ((match = sentenceStartRegex.exec(text)) !== null) {
        issues.push({
          id: `cap-start-${match.index}`,
          type: 'grammar',
          original: match[1],
          suggestion: match[1].toUpperCase(),
          reason: 'The first word of a sentence should be capitalized.',
          offset: match.index + match[0].lastIndexOf(match[1]),
          length: 1,
        });
      }
      return issues;
    }
  }
];
