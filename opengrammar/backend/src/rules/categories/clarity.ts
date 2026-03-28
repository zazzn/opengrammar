import { type Rule, createRegexRule } from '../types.js';
import type { Issue } from '../../shared-types.js';

export const clarityRules: Rule[] = [
  // Repetition
  createRegexRule({
    id: 'repetition',
    category: 'clarity',
    pattern: /\b(\w+)\s+\1\b/i,
    suggestion: (match) => match[1] || '',
    reason: 'Repeated word detected.'
  }),

  // Redundant Phrases
  ...Object.entries({
    'absolutely essential': 'essential',
    'advance planning': 'planning',
    'basic fundamentals': 'fundamentals',
    'close proximity': 'proximity',
    'completely eliminate': 'eliminate',
    'end result': 'result',
    'exact same': 'same',
    'final outcome': 'outcome',
    'free gift': 'gift',
    'future plans': 'plans',
    'past history': 'history',
    'personal opinion': 'opinion',
    'true fact': 'fact',
    'unexpected surprise': 'surprise',
  }).map(([phrase, replacement]) => 
    createRegexRule({
      id: `redundant-${phrase.replace(' ', '-')}`,
      category: 'clarity',
      pattern: new RegExp(`\\b${phrase}\\b`, 'i'),
      suggestion: replacement,
      reason: `Redundant phrase. Use "${replacement}" instead.`
    })
  ),

  // Cliches
  ...[
    'at the end of the day',
    'back to the drawing board',
    'beat around the bush',
    'best of both worlds',
    'bite the bullet',
    'cut corners',
    'hit the nail on the head',
    'in the nick of time',
    'piece of cake',
    'spill the beans',
    'under the weather',
    'when pigs fly',
  ].map(cliche => 
    createRegexRule({
      id: `cliche-${cliche.replace(/\s/g, '-')}`,
      category: 'style',
      pattern: new RegExp(`\\b${cliche}\\b`, 'i'),
      suggestion: 'Consider using more original language',
      reason: 'This is a cliché. Consider using more original language.'
    })
  ),

  // Weak Words
  ...Object.entries({
    'very good': 'excellent',
    'very bad': 'terrible',
    'very big': 'enormous',
    'very small': 'tiny',
    'very important': 'crucial',
    'very interesting': 'fascinating',
    'kind of': 'somewhat',
    'sort of': 'somewhat',
    'a lot': 'much',
    'stuff': 'things',
    'nice': 'pleasant',
  }).map(([weak, strong]) =>
    createRegexRule({
      id: `weak-word-${weak.replace(' ', '-')}`,
      category: 'style',
      pattern: new RegExp(`\\b${weak}\\b`, 'i'),
      suggestion: strong,
      reason: `Consider a stronger word: "${strong}".`
    })
  ),

  // Long Sentences (Custom logic because JS Regex doesn't count words easily)
  {
    id: 'long-sentences',
    type: 'regex',
    category: 'clarity',
    reason: 'Sentence is too long and hard to read.',
    pattern: /[^.!?]+[.!?]+/g, // Not used strictly, but required by interface
    suggestion: 'Consider splitting into shorter sentences',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      let currentIndex = 0;
      sentences.forEach((sentence) => {
        const words = sentence.trim().split(/\s+/).length;
        if (words > 35) {
          issues.push({
            id: `long-sentence-${currentIndex}`,
            type: 'clarity',
            original: sentence.substring(0, 30) + '...',
            suggestion: 'Consider splitting into shorter sentences',
            reason: `This sentence has ${words} words. Shorter sentences are easier to read.`,
            offset: currentIndex,
            length: sentence.length,
          });
        }
        currentIndex += sentence.length;
      });
      return issues;
    }
  }
];
