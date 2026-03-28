import type { Issue } from '../../shared-types.js';
import { createRegexRule, type Rule } from '../types.js';

export const advancedGrammarRules: Rule[] = [
  // Spacing Errors
  createRegexRule({
    id: 'double-space',
    category: 'grammar',
    pattern: /[^.](\s{2,})/g,
    suggestion: ' ',
    reason: 'Multiple spaces detected. Use single space.',
  }),
  createRegexRule({
    id: 'space-before-punct',
    category: 'grammar',
    pattern: /\s+([.,!?;:])/g,
    suggestion: (match) => match[1] || '',
    reason: 'Remove space before punctuation.',
  }),
  createRegexRule({
    id: 'no-space-after-punct',
    category: 'grammar',
    pattern: /([.,!?;:])([A-Z][a-z])/g,
    suggestion: (match) => `${match[1] || ''} ${match[2] || ''}`,
    reason: 'Add space after punctuation.',
  }),

  // Apostrophe Errors
  createRegexRule({
    id: 'its-possessive',
    category: 'grammar',
    pattern:
      /\bits\s+(name|own|color|size|shape|kind|type|way|purpose|function|role|effect|impact|result|content|source|code|data|file|path|url|id|user|item|object|property|value|element|node|parent|child|sibling)\b/i,
    suggestion: (match) => `it's ${match[1]}`,
    reason: "Use 'it's' (contraction of 'it is') here.",
  }),
  createRegexRule({
    id: 'youre-verb',
    category: 'grammar',
    pattern:
      /\byour\s+(welcome|going|right|wrong|reading|writing|working|looking|sounding|feeling|thinking|doing|making|taking|getting|having|being|becoming|seeming|appearing)\b/i,
    suggestion: (match) => `you're ${match[1]}`,
    reason: "Use 'you're' (contraction of 'you are') here.",
  }),
  createRegexRule({
    id: 'theyre-verb',
    category: 'grammar',
    pattern:
      /\btheir\s+(going|coming|working|doing|making|taking|getting|having|being|becoming|seeming|looking|sounding|feeling|thinking)\b/i,
    suggestion: (match) => `they're ${match[1]}`,
    reason: "Use 'they're' (contraction of 'they are') here.",
  }),

  // That vs Which
  createRegexRule({
    id: 'which-no-comma',
    category: 'grammar',
    pattern: /([^,]\s+)which\s+(is|are|was|were|has|have|had|does|do|did)\b/i,
    suggestion: (match) => `${match[1].trim()}, which ${match[2]}`,
    reason: "Non-restrictive clauses need a comma before 'which'.",
  }),

  // Less vs Fewer
  createRegexRule({
    id: 'less-fewer',
    category: 'grammar',
    pattern:
      /\bless\s+(items|things|people|words|sentences|paragraphs|pages|books|cars|houses|dogs|cats|students|teachers|errors|problems|questions|answers|ideas|concepts|rules|examples|cases|instances|occasions|times|days|weeks|months|years)\b/i,
    suggestion: (match) => `fewer ${match[1]}`,
    reason: "Use 'fewer' with countable nouns.",
  }),

  // Comma Splices (Requires more manual custom check logic)
  {
    id: 'comma-splice',
    type: 'regex',
    category: 'grammar',
    pattern: /\b([A-Z][^.]*?)\s*,\s+([A-Z][^.]*?[.!?])/g,
    reason: 'Comma splice detected. Use a period, semicolon, or conjunction.',
    suggestion: '',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const commaSpliceRegex = /\b([A-Z][^.]*?)\s*,\s+([A-Z][^.]*?[.!?])/g;
      let match: RegExpExecArray | null;
      while ((match = commaSpliceRegex.exec(text)) !== null) {
        const clause1 = match[1]?.trim() || '';
        const clause2 = match[2]?.trim() || '';
        if (clause1.split(' ').length > 3 && clause2.split(' ').length > 3) {
          issues.push({
            id: `comma-splice-${match.index}`,
            type: 'grammar',
            original: `${clause1}, ${clause2}`,
            suggestion: `${clause1}. ${clause2}`,
            reason: 'Comma splice detected. Use a period, semicolon, or conjunction.',
            offset: match.index,
            length: match[0].length,
          });
        }
      }
      return issues;
    },
  },

  // Double Negatives
  {
    id: 'double-negative',
    type: 'regex',
    category: 'grammar',
    pattern: /[^.!?]+[.!?]+/g,
    reason: 'Double negative detected.',
    suggestion: 'Remove one negative',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const negativeWords = [
        "don't",
        "doesn't",
        "didn't",
        "won't",
        "wouldn't",
        "couldn't",
        "shouldn't",
        "can't",
        'cannot',
        'no',
        'not',
        'never',
        'nothing',
        'nobody',
        'nowhere',
        'neither',
        'nor',
      ];
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      let currentIndex = 0;
      sentences.forEach((sentence) => {
        const lowerSentence = sentence.toLowerCase();
        const foundNegatives = negativeWords.filter((word) => lowerSentence.includes(word));
        if (foundNegatives.length >= 2) {
          issues.push({
            id: `double-neg-${currentIndex}`,
            type: 'grammar',
            original: sentence.trim(),
            suggestion: 'Remove one negative',
            reason: `Double negative detected: ${foundNegatives.join(', ')}. This may be unintentional.`,
            offset: currentIndex,
            length: sentence.length,
          });
        }
        currentIndex += sentence.length;
      });
      return issues;
    },
  },

  // Article Errors
  {
    id: 'article-a-an',
    type: 'regex',
    category: 'grammar',
    pattern: /\b(?:a|an)\s+\w+/gi,
    reason: 'Article mismatch',
    suggestion: '',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const vowelExceptions = new Set(['uni', 'use', 'usu', 'eur', 'one', 'once']);
      const aBeforeVowelRegex = /\ba\s+([aeiou]\w*)\b/gi;
      let match: RegExpExecArray | null;
      while ((match = aBeforeVowelRegex.exec(text)) !== null) {
        const nextWord = (match[1] || '').toLowerCase();
        const isException = Array.from(vowelExceptions).some((ex) => nextWord.startsWith(ex));
        if (!isException) {
          issues.push({
            id: `article-a-${match.index}`,
            type: 'grammar',
            original: match[0],
            suggestion: `an ${match[1]}`,
            reason: 'Use "an" before words that begin with a vowel sound.',
            offset: match.index,
            length: match[0].length,
          });
        }
      }

      const consonantExceptions = new Set(['hour', 'honest', 'honor', 'honour', 'heir', 'herb']);
      const anBeforeConsonantRegex = /\ban\s+([bcdfghjklmnpqrstvwxyz]\w*)\b/gi;
      while ((match = anBeforeConsonantRegex.exec(text)) !== null) {
        const nextWord = (match[1] || '').toLowerCase();
        const isException = Array.from(consonantExceptions).some((ex) => nextWord.startsWith(ex));
        if (!isException) {
          issues.push({
            id: `article-an-${match.index}`,
            type: 'grammar',
            original: match[0],
            suggestion: `a ${match[1]}`,
            reason: 'Use "a" before words that begin with a consonant sound.',
            offset: match.index,
            length: match[0].length,
          });
        }
      }
      return issues;
    },
  },

  // Missing Commas
  {
    id: 'intro-commas',
    type: 'regex',
    category: 'grammar',
    pattern: /(?:^|[.!?]\s+)(however|therefore|furthermore)\s+(?!,)([A-Za-z])/gi,
    reason: 'Missing comma',
    suggestion: '',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const introWords = [
        'however',
        'therefore',
        'furthermore',
        'moreover',
        'nevertheless',
        'meanwhile',
        'consequently',
        'additionally',
        'similarly',
        'accordingly',
        'unfortunately',
        'fortunately',
        'finally',
        'obviously',
        'clearly',
      ];

      for (const word of introWords) {
        const regex = new RegExp(`(?:^|[.!?]\\s+)${word}\\s+(?!,)([A-Za-z])`, 'gi');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          const wordStart = text.indexOf(word, match.index);
          if (wordStart >= 0) {
            issues.push({
              id: `intro-comma-${wordStart}`,
              type: 'grammar',
              original: `${word} ${match[1]}`,
              suggestion: `${word}, ${match[1]}`,
              reason: `Add a comma after the introductory word "${word}".`,
              offset: wordStart,
              length: word.length + 2,
            });
          }
        }
      }
      return issues;
    },
  },

  // Sentence Fragments
  {
    id: 'sentence-fragments',
    type: 'regex',
    category: 'grammar',
    pattern: /^\s*(because|although|though|even though)/i,
    reason: 'Sentence Fragment',
    suggestion: 'This may be a sentence fragment. Add a main clause.',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      let currentIndex = 0;
      const subordinators =
        /^\s*(because|although|though|even though|while|whereas|since|unless|until|if|when|whenever|wherever|after|before|as soon as|in order to|so that)\b/i;

      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        const match = subordinators.exec(trimmed);

        if (match) {
          const wordCount = trimmed.split(/\s+/).length;
          const hasComma = trimmed.includes(',');
          if (wordCount < 10 && !hasComma) {
            issues.push({
              id: `fragment-${currentIndex}`,
              type: 'grammar',
              original: trimmed,
              suggestion: 'This may be a sentence fragment. Add a main clause.',
              reason: `Sentences starting with "${match[1]}" need a main clause to be complete.`,
              offset: currentIndex,
              length: sentence.length,
            });
          }
        }
        currentIndex += sentence.length;
      }
      return issues;
    },
  },
];
