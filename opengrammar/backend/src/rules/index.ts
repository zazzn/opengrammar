// ═══ Phase 4 — Domain, Inclusivity, Readability (Part 3 JSON) ═══
import { academicWritingRules } from './categories/academic-writing.js';
import { adjectivesAdverbsRules } from './categories/adjectives-adverbs.js';
import { businessWritingRules } from './categories/business-writing.js';
import { capitalizationRules } from './categories/capitalization.js';
import { clarityRules } from './categories/clarity.js';
// ═══ Phase 3 — Style, Words, Formality (Part 2 JSON) ═══
import { confusedWordsRules } from './categories/confused-words.js';
import { conjunctionRules } from './categories/conjunctions.js';
import { formalityRules } from './categories/formality.js';
import { formattingIdiomRules } from './categories/formatting-idioms.js';
// ═══ Phase 1 — Foundation ═══
import { basicGrammarRules } from './categories/grammar.js';
import { advancedGrammarRules } from './categories/grammar-advanced.js';
import { inclusiveLanguageRules } from './categories/inclusive-language.js';
import { nounsPronouns } from './categories/nouns-pronouns.js';
import { prepositionRules } from './categories/prepositions.js';
import { punctuationRules } from './categories/punctuation.js';
import { readabilityRules } from './categories/readability.js';
// ═══ Phase 2 — Structural Grammar (Part 1 JSON) ═══
import { sentenceStructureRules } from './categories/sentence-structure.js';
import { spellingRules } from './categories/spelling.js';
import { spellingAdvancedRules } from './categories/spelling-advanced.js';
import { styleRules } from './categories/style.js';
import { styleToneRules } from './categories/style-tone.js';
import { verbTenseRules } from './categories/verb-tense.js';
import type { Rule } from './types.js';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║       OpenGrammar — Giant Grammarly Rule Engine              ║
 * ║       22 Category Modules · 850+ Rules                      ║
 * ║                                                              ║
 * ║  Categories:                                                 ║
 * ║   • Grammar (basic, advanced, sentence structure, verbs)     ║
 * ║   • Spelling (common, advanced, confused words)              ║
 * ║   • Style (tone, clichés, formality, nominalizations)        ║
 * ║   • Clarity (redundancy, wordiness, readability)             ║
 * ║   • Punctuation (apostrophes, hyphens, commas)               ║
 * ║   • Capitalization (I, days, proper nouns, sentences)        ║
 * ║   • Prepositions, Conjunctions, Adjectives/Adverbs           ║
 * ║   • Nouns/Pronouns (countability, plurals, determiners)      ║
 * ║   • Idioms & Formatting (malapropisms, tautologies)          ║
 * ║   • Academic Writing (weasel words, hedging, citations)      ║
 * ║   • Business Writing (corporate bloat, email openers)        ║
 * ║   • Inclusive Language (gendered, ableist, person-first)     ║
 * ║   • Readability (complex words, long sentences)              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export const CORE_RULES: Rule[] = [
  // Phase 1 — Foundation
  ...basicGrammarRules,
  ...spellingRules,
  ...styleRules,
  ...clarityRules,
  ...advancedGrammarRules,
  ...spellingAdvancedRules,
  ...capitalizationRules,

  // Phase 2 — Structural Grammar
  ...sentenceStructureRules,
  ...verbTenseRules,
  ...nounsPronouns,
  ...adjectivesAdverbsRules,
  ...prepositionRules,
  ...conjunctionRules,
  ...punctuationRules,

  // Phase 3 — Style, Confused Words, Formality, Idioms
  ...confusedWordsRules,
  ...styleToneRules,
  ...formalityRules,
  ...formattingIdiomRules,

  // Phase 4 — Domain Writing, Inclusivity, Readability
  ...academicWritingRules,
  ...businessWritingRules,
  ...inclusiveLanguageRules,
  ...readabilityRules,
];
