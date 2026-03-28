import { type Rule, createRegexRule } from '../types.js';

export const spellingAdvancedRules: Rule[] = [
  // Confused Words
  createRegexRule({ pattern: /\bthe\s+affect\b/i, suggestion: 'the effect', reason: 'Use "effect" (noun). "Affect" is usually a verb.', id: 'confuse-the-affect', category: 'spelling' }),
  createRegexRule({ pattern: /\ban\s+affect\b/i, suggestion: 'an effect', reason: 'Use "effect" (noun). "Affect" is usually a verb.', id: 'confuse-an-affect', category: 'spelling' }),
  createRegexRule({ pattern: /\bhas\s+no\s+affect\b/i, suggestion: 'has no effect', reason: 'Use "effect" (noun) here.', id: 'confuse-no-affect', category: 'spelling' }),
  createRegexRule({ pattern: /\beffect\s+(the|a|his|her|their|our|my|your|its)\b/i, suggestion: (m) => `affect ${m[1]}`, reason: 'Use "affect" (verb) when meaning "to influence".', id: 'effect-determiner', category: 'spelling' }),

  createRegexRule({ pattern: /\b(bigger|smaller|better|worse|more|less|faster|slower|higher|lower|greater|fewer|older|younger|earlier|later|longer|shorter|taller|stronger|weaker|easier|harder|smarter|richer|poorer|cheaper|nicer|closer)\s+then\b/i, suggestion: (m) => `${m[1]} than`, reason: 'Use "than" for comparisons, not "then".', id: 'then-than', category: 'spelling' }),

  createRegexRule({ pattern: /\b(will|might|could|would|going to|gonna|dont want to|don't want to)\s+loose\b/i, suggestion: (m) => `${m[1]} lose`, reason: 'Use "lose" (verb, opposite of win/find). "Loose" means not tight.', id: 'loose-lose', category: 'spelling' }),

  createRegexRule({ pattern: /\bexcept\s+(the|his|her|their|our|my|your|this|that|an?)\s+(offer|invitation|terms|conditions|award|gift|prize|challenge|proposal|request|apology|responsibility)\b/i, suggestion: (m) => `accept ${m[1]} ${m[2]}`, reason: 'Use "accept" (to receive). "Except" means excluding.', id: 'except-accept', category: 'spelling' }),

  createRegexRule({ pattern: /\bto\s+who\b/i, suggestion: 'to whom', reason: 'Use "whom" after a preposition (to, for, with, by).', id: 'to-whom', category: 'spelling' }),
  createRegexRule({ pattern: /\bfor\s+who\b/i, suggestion: 'for whom', reason: 'Use "whom" after a preposition.', id: 'for-whom', category: 'spelling' }),
  createRegexRule({ pattern: /\bwith\s+who\b/i, suggestion: 'with whom', reason: 'Use "whom" after a preposition.', id: 'with-whom', category: 'spelling' }),
  createRegexRule({ pattern: /\bby\s+who\b/i, suggestion: 'by whom', reason: 'Use "whom" after a preposition.', id: 'by-whom', category: 'spelling' }),

  createRegexRule({ pattern: /\bcomplement\s+(him|her|them|you|me|us)\b/i, suggestion: (m) => `compliment ${m[1]}`, reason: 'Use "compliment" (praise). "Complement" means to complete.', id: 'complement-compliment', category: 'spelling' }),

  createRegexRule({ pattern: /\bthe\s+principle\s+(of\s+the\s+school|said|announced|decided)\b/i, suggestion: (m) => `the principal ${m[1]}`, reason: 'Use "principal" for a school leader. "Principle" is a rule or belief.', id: 'principal-principle', category: 'spelling' }),

  createRegexRule({ pattern: /\bweather\s+(or\s+not|we|you|they|he|she|it|I|to)\b/i, suggestion: (m) => `whether ${m[1]}`, reason: 'Use "whether" for conditions/choices. "Weather" refers to climate.', id: 'weather-whether', category: 'spelling' }),

  createRegexRule({ pattern: /\bcan't\s+bare\b/i, suggestion: "can't bear", reason: 'Use "bear" (to tolerate). "Bare" means naked or uncovered.', id: 'bare-bear', category: 'spelling' }),

  createRegexRule({ pattern: /\bpeek\s+(interest|curiosity)\b/i, suggestion: (m) => `pique ${m[1]}`, reason: 'Use "pique" (to stimulate). "Peek" means to look quickly.', id: 'peek-pique', category: 'spelling' }),
  createRegexRule({ pattern: /\bpeak\s+(interest|curiosity)\b/i, suggestion: (m) => `pique ${m[1]}`, reason: 'Use "pique" (to stimulate). "Peak" means the top.', id: 'peak-pique', category: 'spelling' }),

  // Its vs It
  createRegexRule({
    id: 'its-wrong',
    category: 'spelling',
    pattern: /\bits\s+(been|become|becoming|seemed|seems|appeared|appears|gotten|made|done|said|written|created)\b/i,
    suggestion: (m) => `it's ${m[1]}`,
    reason: "Use 'it's' (contraction) when you mean 'it is' or 'it has'."
  }),

  // Their Location
  createRegexRule({
    id: 'there-location',
    category: 'spelling',
    pattern: /\bover\s+their\b/i,
    suggestion: 'over there',
    reason: "Use 'there' for locations, not 'their' (possessive)."
  }),

  // Your vs You're
  createRegexRule({
    id: 'your-should-be-youre',
    category: 'spelling',
    pattern: /\byour\s+(welcome|absolutely|right|wrong|amazing|awesome|incredible|fantastic|wonderful|great|excellent|perfect|beautiful|stunning|gorgeous|brilliant|smart|intelligent|talented|skilled|experienced|qualified|prepared|ready|finished|done|complete|correct|incorrect|mistaken|confused|lost|found|gone|here|there|early|late|busy|free|available|unavailable|important|necessary|essential|critical|vital|crucial|key|main|primary|principal|chief|major|minor|significant|relevant|appropriate|suitable|fitting|proper|correct|right|wrong|bad|good|better|best|worse|worst)\b/i,
    suggestion: (m) => `you're ${m[1]}`,
    reason: "Use 'you're' (contraction of 'you are') here."
  })
];
