import type { AnalysisContext, Issue, CustomRule, LLMProvider } from './shared-types.js';
import OpenAI from 'openai';
import { Groq } from 'groq-sdk';
import { checkSpelling, SAFE_WORDS } from './spellchecker.js';

/**
 * Past participles commonly used as adjectives.
 * These should NOT be flagged as passive voice.
 */
const ADJECTIVE_PARTICIPLES = new Set([
  'excited', 'interested', 'pleased', 'surprised', 'tired',
  'bored', 'confused', 'disappointed', 'embarrassed', 'frightened',
  'satisfied', 'worried', 'amazed', 'concerned', 'delighted',
  'determined', 'exhausted', 'fascinated', 'relaxed', 'shocked',
  'stressed', 'required', 'needed', 'expected', 'supposed',
  'complicated', 'dedicated', 'educated', 'experienced', 'limited',
  'married', 'organized', 'prepared', 'qualified', 'related',
  'retired', 'scared', 'skilled', 'talented', 'united',
  'advanced', 'balanced', 'broken', 'closed', 'combined',
  'connected', 'convinced', 'crowded', 'damaged', 'depressed',
  'detailed', 'developed', 'disabled', 'engaged', 'established',
  'fixed', 'focused', 'hidden', 'improved', 'increased',
  'involved', 'isolated', 'known', 'located', 'mixed',
  'motivated', 'observed', 'opened', 'pleased', 'preferred',
  'published', 'recognized', 'reduced', 'registered', 'renewed',
  'repeated', 'reserved', 'satisfied', 'settled', 'shared',
  'situated', 'specialized', 'supposed', 'troubled', 'updated',
  'used', 'valued', 'varied', 'worried',
]);

export class RuleBasedAnalyzer {
  private static dictionary: Set<string> = new Set();
  private static customRules: CustomRule[] = [];

  static analyze(text: string, options?: { dictionary?: string[]; customRules?: CustomRule[] }): Issue[] {
    const issues: Issue[] = [];

    if (options?.dictionary) {
      this.dictionary = new Set(options.dictionary.map(w => w.toLowerCase()));
    }

    if (options?.customRules) {
      this.customRules = options.customRules;
    }

    // Dictionary-based spell checking (real spell checker)
    issues.push(...checkSpelling(text, this.dictionary));

    // Rule-based checks
    issues.push(...this.checkCapitalization(text));
    issues.push(...this.checkPassiveVoice(text));
    issues.push(...this.checkRepetition(text));
    issues.push(...this.checkLongSentences(text));
    issues.push(...this.checkSpacingErrors(text));
    issues.push(...this.checkApostropheErrors(text));
    issues.push(...this.checkThatWhich(text));
    issues.push(...this.checkLessFewer(text));
    issues.push(...this.checkItsIt(text));
    issues.push(...this.checkTheirThereTheyre(text));
    issues.push(...this.checkYourYoure(text));
    issues.push(...this.checkCommaSplices(text));
    issues.push(...this.checkDoubleNegatives(text));
    issues.push(...this.checkRedundantPhrases(text));
    issues.push(...this.checkWeakWords(text));
    issues.push(...this.checkCliches(text));
    issues.push(...this.checkBasicGrammar(text));
    issues.push(...this.checkArticleErrors(text));
    issues.push(...this.checkSubjectVerbAgreement(text));
    issues.push(...this.checkMissingCommas(text));
    issues.push(...this.checkConfusedWords(text));
    issues.push(...this.checkSentenceFragments(text));
    issues.push(...this.checkCustomRules(text));

    return issues;
  }

  /**
   * Check basic grammar errors (subject-verb, pronouns, etc.)
   */
  private static checkBasicGrammar(text: string): Issue[] {
    const issues: Issue[] = [];
    
    // Common grammar mistakes
    const grammarRules: Array<{pattern: RegExp, suggestion: string, reason: string}> = [
      {
        pattern: /\b(me|him|her|them|us)\s+and\s+(I|he|she|they|we)\b/gi,
        suggestion: '$2 and $1',
        reason: 'Use subject pronouns (I, he, she, they, we) when they are part of the subject.'
      },
      {
        pattern: /\b(me\s+and\s+him|him\s+and\s+me)\b/gi,
        suggestion: 'he and I',
        reason: 'When acting as the subject, use "He and I".'
      },
      {
        pattern: /\b(me\s+and\s+her|her\s+and\s+me)\b/gi,
        suggestion: 'she and I',
        reason: 'When acting as the subject, use "She and I".'
      },
      {
        pattern: /\bbeside\s+you\s+and\s+I\b/gi,
        suggestion: 'beside you and me',
        reason: 'Use object pronouns after prepositions ("between you and me").'
      },
      {
        pattern: /\bbetween\s+you\s+and\s+I\b/gi,
        suggestion: 'between you and me',
        reason: 'Use object pronouns after prepositions ("between you and me").'
      },
      {
        pattern: /\barrived\s+to\b/gi,
        suggestion: 'arrived in / at',
        reason: 'Use "arrived in" for cities/countries and "arrived at" for specific places/events.'
      },
      {
        pattern: /\bcould\s+care\s+less\b/gi,
        suggestion: "couldn't care less",
        reason: 'The idiom is "couldn\'t care less" (meaning you care zero percent).'
      },
      {
        pattern: /\bon\s+accident\b/gi,
        suggestion: 'by accident',
        reason: 'The correct idiom is "by accident", not "on accident".'
      },
      {
        pattern: /\bbased\s+off\s+of\b/gi,
        suggestion: 'based on',
        reason: 'Use "based on" instead of "based off of".'
      },
      {
        pattern: /\bfor\s+all\s+intensive\s+purposes\b/gi,
        suggestion: 'for all intents and purposes',
        reason: 'The correct idiom is "for all intents and purposes".'
      },
      {
        pattern: /\balot\b/gi,
        suggestion: 'a lot',
        reason: '"A lot" is always two words.'
      },
      {
        pattern: /\bdefinately\b/gi,
        suggestion: 'definitely',
        reason: 'The correct spelling is "definitely".'
      },
      {
        pattern: /\bseperate\b/gi,
        suggestion: 'separate',
        reason: 'The correct spelling is "separate" (there is "a rat" in separate).'
      },
      {
        pattern: /\b(I|he|she|they|we)\s+and\s+(me|him|her|them|us)\b/gi,
        suggestion: '$2 and $1',
        reason: 'Use object pronouns (me, him, her, them, us) when they are part of the object.'
      },
      {
        pattern: /\bbuyed\b/gi,
        suggestion: 'bought',
        reason: '"Buyed" is not a word. The past tense of "buy" is "bought".'
      },
      {
        pattern: /\brunned\b/gi,
        suggestion: 'ran',
        reason: '"Runned" is not a word. The past tense of "run" is "ran".'
      },
      {
        pattern: /\bgoed\b/gi,
        suggestion: 'went',
        reason: '"Goed" is not a word. The past tense of "go" is "went".'
      },
      {
        pattern: /\beated\b/gi,
        suggestion: 'ate',
        reason: '"Eated" is not a word. The past tense of "eat" is "ate".'
      },
      {
        pattern: /\bcomed\b/gi,
        suggestion: 'came',
        reason: '"Comed" is not a word. The past tense of "come" is "came".'
      },
      {
        pattern: /\btaked\b/gi,
        suggestion: 'took',
        reason: '"Taked" is not a word. The past tense of "take" is "took".'
      },
      {
        pattern: /\bbringed\b/gi,
        suggestion: 'brought',
        reason: '"Bringed" is not a word. The past tense of "bring" is "brought".'
      },
      {
        pattern: /\bthinked\b/gi,
        suggestion: 'thought',
        reason: '"Thinked" is not a word. The past tense of "think" is "thought".'
      },
      {
        pattern: /\bknowed\b/gi,
        suggestion: 'knew',
        reason: '"Knowed" is not a word. The past tense of "know" is "knew".'
      },
      {
        pattern: /\bhas\s+got\b/gi,
        suggestion: 'has',
        reason: '"Has got" is redundant. Use "has" instead.'
      },
      {
        pattern: /\bhaving\s+got\b/gi,
        suggestion: 'have',
        reason: '"Having got" is awkward. Use "have" instead.'
      },
      {
        pattern: /\bwanna\b/gi,
        suggestion: 'want to',
        reason: '"Wanna" is informal. Use "want to" in formal writing.'
      },
      {
        pattern: /\bgotta\b/gi,
        suggestion: 'have to',
        reason: '"Gotta" is informal. Use "have to" in formal writing.'
      },
      {
        pattern: /\bkinda\b/gi,
        suggestion: 'kind of',
        reason: '"Kinda" is informal. Use "kind of" in formal writing.'
      },
      {
        pattern: /\bcould\s+of\b/gi,
        suggestion: 'could have',
        reason: '"Could of" is incorrect. Use "could have".'
      },
      {
        pattern: /\bwould\s+of\b/gi,
        suggestion: 'would have',
        reason: '"Would of" is incorrect. Use "would have".'
      },
      {
        pattern: /\bshould\s+of\b/gi,
        suggestion: 'should have',
        reason: '"Should of" is incorrect. Use "should have".'
      },
      {
        pattern: /\bmight\s+of\b/gi,
        suggestion: 'might have',
        reason: '"Might of" is incorrect. Use "might have".'
      },
      {
        pattern: /\bmust\s+of\b/gi,
        suggestion: 'must have',
        reason: '"Must of" is incorrect. Use "must have".'
      },
      {
        pattern: /\balot\b/gi,
        suggestion: 'a lot',
        reason: '"Alot" is misspelled. Use "a lot" (two words).'
      },
      {
        pattern: /\b alot\b/gi,
        suggestion: ' a lot',
        reason: '"Alot" is misspelled. Use "a lot" (two words).'
      },
      {
        pattern: /\bshouldnt\b/gi,
        suggestion: "shouldn't",
        reason: 'Missing apostrophe in "shouldn\'t".'
      },
      {
        pattern: /\bcouldnt\b/gi,
        suggestion: "couldn't",
        reason: 'Missing apostrophe in "couldn\'t".'
      },
      {
        pattern: /\bwouldnt\b/gi,
        suggestion: "wouldn't",
        reason: 'Missing apostrophe in "wouldn\'t".'
      },
      {
        pattern: /\bdidnt\b/gi,
        suggestion: "didn't",
        reason: 'Missing apostrophe in "didn\'t".'
      },
      {
        pattern: /\bdoesnt\b/gi,
        suggestion: "doesn't",
        reason: 'Missing apostrophe in "doesn\'t".'
      },
      {
        pattern: /\bisnt\b/gi,
        suggestion: "isn't",
        reason: 'Missing apostrophe in "isn\'t".'
      },
      {
        pattern: /\barent\b/gi,
        suggestion: "aren't",
        reason: 'Missing apostrophe in "aren\'t".'
      },
      {
        pattern: /\bwasnt\b/gi,
        suggestion: "wasn't",
        reason: 'Missing apostrophe in "wasn\'t".'
      },
      {
        pattern: /\bwerent\b/gi,
        suggestion: "weren't",
        reason: 'Missing apostrophe in "weren\'t".'
      },
    ];

    for (const rule of grammarRules) {
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(text)) !== null) {
        issues.push({
          type: 'grammar',
          original: match[0],
          suggestion: match[0].replace(rule.pattern, rule.suggestion),
          reason: rule.reason,
          offset: match.index,
          length: match[0].length,
        });
      }
    }

    return issues;
  }

  /**
   * Check common misspellings
   */
  private static checkCommonMisspellings(text: string): Issue[] {
    const issues: Issue[] = [];
    
    const commonMisspellings: Record<string, string> = {
      'teh': 'the',
      'taht': 'that',
      'waht': 'what',
      'whta': 'what',
      'hte': 'the',
      'iwth': 'with',
      'witht': 'with',
      'adn': 'and',
      'nad': 'and',
      'abd': 'bad',
      'becuase': 'because',
      'becasue': 'because',
      'beacuse': 'because',
      'becomeing': 'becoming',
      'begining': 'beginning',
      'believeable': 'believable',
      'buisness': 'business',
      'calender': 'calendar',
      'cant': "can't",
      'collegue': 'colleague',
      'comming': 'coming',
      'completly': 'completely',
      'definately': 'definitely',
      'definitly': 'definitely',
      'dissapear': 'disappear',
      'dissapoint': 'disappoint',
      'embarass': 'embarrass',
      'enviroment': 'environment',
      'existance': 'existence',
      'experiance': 'experience',
      'familar': 'familiar',
      'finaly': 'finally',
      'freind': 'friend',
      'goverment': 'government',
      'governer': 'governor',
      'grammer': 'grammar',
      'happend': 'happened',
      'happenned': 'happened',
      'harrass': 'harass',
      'heighth': 'height',
      'helpfull': 'helpful',
      'immediatly': 'immediately',
      'independant': 'independent',
      'indispensible': 'indispensable',
      'irresistable': 'irresistible',
      'knowlege': 'knowledge',
      'libary': 'library',
      'lisence': 'license',
      'maintainance': 'maintenance',
      'millenium': 'millennium',
      'minature': 'miniature',
      'mischievious': 'mischievous',
      'misspell': 'misspell',
      'neccessary': 'necessary',
      'necessery': 'necessary',
      'noticable': 'noticeable',
      'occassion': 'occasion',
      'occured': 'occurred',
      'occuring': 'occurring',
      'occurence': 'occurrence',
      'parliment': 'parliament',
      'peice': 'piece',
      'persistance': 'persistence',
      'persue': 'pursue',
      'posession': 'possession',
      'potatos': 'potatoes',
      'preceed': 'precede',
      'presance': 'presence',
      'privelege': 'privilege',
      'publically': 'publicly',
      'questionaire': 'questionnaire',
      'realy': 'really',
      'recieve': 'receive',
      'recomend': 'recommend',
      'refered': 'referred',
      'refering': 'referring',
      'relevent': 'relevant',
      'reminisce': 'reminisce',
      'repitition': 'repetition',
      'resistence': 'resistance',
      'seperate': 'separate',
      'similer': 'similar',
      'sincerly': 'sincerely',
      'speach': 'speech',
      'strenght': 'strength',
      'succesful': 'successful',
      'suprise': 'surprise',
      'tendancy': 'tendency',
      'therefor': 'therefore',
      'tommorrow': 'tomorrow',
      'tongue': 'tongue',
      'truely': 'truly',
      'unfortunatly': 'unfortunately',
      'untill': 'until',
      'unusuall': 'unusual',
      'usefull': 'useful',
      'vaccum': 'vacuum',
      'vegatable': 'vegetable',
      'visious': 'vicious',
      'wether': 'whether',
      'wich': 'which',
      'writting': 'writing',
      'yache': 'yacht',
      'yeild': 'yield',
      'yourselfs': 'yourselves',
    };

    for (const [wrong, correct] of Object.entries(commonMisspellings)) {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        issues.push({
          type: 'spelling',
          original: match[0],
          suggestion: correct,
          reason: `Misspelled word. The correct spelling is "${correct}".`,
          offset: match.index,
          length: match[0].length,
        });
      }
    }

    return issues;
  }

  private static checkCapitalization(text: string): Issue[] {
    const issues: Issue[] = [];
    
    // Capitalize standalone 'I'
    const iRegex = /(?:^|\s)(i)(?=\s|['’]m|[.,!?]|$)/g;
    let match: RegExpExecArray | null;
    while ((match = iRegex.exec(text)) !== null) {
      const matchIndex = match.index + match[0].indexOf('i');
      issues.push({
        type: 'grammar',
        original: 'i',
        suggestion: 'I',
        reason: 'The pronoun "I" should always be capitalized.',
        offset: matchIndex,
        length: 1,
      });
    }

    // Capitalize days of the week & months
    const dateRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/g;
    while ((match = dateRegex.exec(text)) !== null) {
      issues.push({
        type: 'grammar',
        original: match[1],
        suggestion: match[1].charAt(0).toUpperCase() + match[1].slice(1),
        reason: 'Days of the week and months should be capitalized.',
        offset: match.index,
        length: match[1].length,
      });
    }

    // Common Proper Nouns (Names & Places)
    const commonNamesList = ['swadhin', 'dhaka', 'john', 'mary', 'london', 'paris', 'america', 'india', 'bangladesh', 'google', 'microsoft', 'apple', 'facebook'];
    const namesRegex = new RegExp(`\\b(${commonNamesList.join('|')})\\b`, 'g');
    while ((match = namesRegex.exec(text)) !== null) {
      issues.push({
        type: 'grammar',
        original: match[1],
        suggestion: match[1].charAt(0).toUpperCase() + match[1].slice(1),
        reason: 'Proper nouns, names, and places should be capitalized.',
        offset: match.index,
        length: match[1].length,
      });
    }

    // Capitalize first letter of sentences
    const sentenceStartRegex = /(?:^|[.!?]\s+)([a-z])/g;
    while ((match = sentenceStartRegex.exec(text)) !== null) {
      issues.push({
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

  private static checkPassiveVoice(text: string): Issue[] {
    const issues: Issue[] = [];
    const passivePatterns = [
      /\b(am|are|is|was|were|be|been|being)\s+(\w+ed)\b/gi,
      /\b(am|are|is|was|were|be|been|being)\s+(\w+en)\b/gi,
      /\b(am|are|is|was|were|be|been|being)\s+(given|taken|made|done|said|written|created|built|found|shown|told|left|kept|held|sent|brought|bought|caught|taught|thought)\b/gi,
    ];

    for (const pattern of passivePatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        // Extract the participle (second word)
        const participle = match[2]?.toLowerCase() || '';

        // Skip if the participle is commonly used as an adjective
        if (ADJECTIVE_PARTICIPLES.has(participle)) continue;

        issues.push({
          type: 'style',
          original: match[0],
          suggestion: 'Consider using active voice',
          reason: 'Passive voice can make sentences weaker and less direct.',
          offset: match.index,
          length: match[0].length,
        });
      }
    }
    return issues;
  }

  private static checkRepetition(text: string): Issue[] {
    const issues: Issue[] = [];
    const repetitionRegex = /\b(\w+)\s+\1\b/gi;
    let match: RegExpExecArray | null;
    while ((match = repetitionRegex.exec(text)) !== null) {
      issues.push({
        type: 'grammar',
        original: match[0],
        suggestion: match[1] || '',
        reason: 'Repeated word detected.',
        offset: match.index,
        length: match[0].length,
      });
    }
    return issues;
  }

  private static checkLongSentences(text: string): Issue[] {
    const issues: Issue[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    let currentIndex = 0;
    sentences.forEach((sentence) => {
      const words = sentence.trim().split(/\s+/).length;
      if (words > 35) {
        issues.push({
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

  private static checkSpacingErrors(text: string): Issue[] {
    const issues: Issue[] = [];
    const doubleSpaceRegex = /[^.]\s{2,}/g;
    let match: RegExpExecArray | null;
    while ((match = doubleSpaceRegex.exec(text)) !== null) {
      issues.push({
        type: 'grammar',
        original: match[0],
        suggestion: ' ',
        reason: 'Multiple spaces detected. Use single space.',
        offset: match.index,
        length: match[0].length,
      });
    }
    const spaceBeforePunctRegex = /\s+([.,!?;:])/g;
    while ((match = spaceBeforePunctRegex.exec(text)) !== null) {
      issues.push({
        type: 'grammar',
        original: match[0],
        suggestion: match[1] || '',
        reason: 'Remove space before punctuation.',
        offset: match.index,
        length: match[0].length,
      });
    }
    const noSpaceAfterPunctRegex = /([.,!?;:])([A-Z][a-z])/g;
    while ((match = noSpaceAfterPunctRegex.exec(text)) !== null) {
      issues.push({
        type: 'grammar',
        original: match[0],
        suggestion: `${match[1] || ''} ${match[2] || ''}`,
        reason: 'Add space after punctuation.',
        offset: match.index,
        length: match[0].length,
      });
    }
    return issues;
  }

  private static checkApostropheErrors(text: string): Issue[] {
    const issues: Issue[] = [];
    const itsPossessiveRegex = /\bits\s+(?:name|own|color|size|shape|kind|type|way|purpose|function|role|effect|impact|result|content|source|code|data|file|path|url|id|user|item|object|property|value|element|node|parent|child|sibling)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = itsPossessiveRegex.exec(text)) !== null) {
      const parts = match[0].split(' ');
      issues.push({
        type: 'grammar',
        original: match[0],
        suggestion: `it's ${parts[1] || ''}`,
        reason: "Use 'it's' (contraction of 'it is') here.",
        offset: match.index,
        length: match[0].length,
      });
    }
    const youreVerbRegex = /\byour\s+(?:welcome|going|right|wrong|reading|writing|working|looking|sounding|feeling|thinking|doing|making|taking|getting|having|being|becoming|seeming|appearing)\b/gi;
    while ((match = youreVerbRegex.exec(text)) !== null) {
      const parts = match[0].split(' ');
      issues.push({
        type: 'grammar',
        original: match[0],
        suggestion: `you're ${parts[1] || ''}`,
        reason: "Use 'you're' (contraction of 'you are') here.",
        offset: match.index,
        length: match[0].length,
      });
    }
    const theyreVerbRegex = /\btheir\s+(?:going|coming|working|doing|making|taking|getting|having|being|becoming|seeming|looking|sounding|feeling|thinking)\b/gi;
    while ((match = theyreVerbRegex.exec(text)) !== null) {
      const parts = match[0].split(' ');
      issues.push({
        type: 'grammar',
        original: match[0],
        suggestion: `they're ${parts[1] || ''}`,
        reason: "Use 'they're' (contraction of 'they are') here.",
        offset: match.index,
        length: match[0].length,
      });
    }
    return issues;
  }

  private static checkThatWhich(text: string): Issue[] {
    const issues: Issue[] = [];
    const whichNoCommaRegex = /[^,]\s+which\s+(?:is|are|was|were|has|have|had|does|do|did)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = whichNoCommaRegex.exec(text)) !== null) {
      const parts = match[0].trim().split(' ');
      issues.push({
        type: 'grammar',
        original: match[0].trim(),
        suggestion: `, which ${parts.slice(1).join(' ') || ''}`,
        reason: "Non-restrictive clauses need a comma before 'which'.",
        offset: match.index + 1,
        length: match[0].length - 1,
      });
    }
    return issues;
  }

  private static checkLessFewer(text: string): Issue[] {
    const issues: Issue[] = [];
    const lessCountableRegex = /\bless\s+(?:items|things|people|words|sentences|paragraphs|pages|books|cars|houses|dogs|cats|students|teachers|errors|problems|questions|answers|ideas|concepts|rules|examples|cases|instances|occasions|times|days|weeks|months|years)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = lessCountableRegex.exec(text)) !== null) {
      const parts = match[0].split(' ');
      issues.push({
        type: 'grammar',
        original: match[0],
        suggestion: `fewer ${parts[1] || ''}`,
        reason: "Use 'fewer' with countable nouns.",
        offset: match.index,
        length: match[0].length,
      });
    }
    return issues;
  }

  private static checkItsIt(text: string): Issue[] {
    const issues: Issue[] = [];
    const itsWrongRegex = /\bits\s+(?:been|become|becoming|seemed|seems|appeared|appears|gotten|made|done|said|written|created)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = itsWrongRegex.exec(text)) !== null) {
      const parts = match[0].split(' ');
      issues.push({
        type: 'spelling',
        original: match[0],
        suggestion: `it's ${parts[1] || ''}`,
        reason: "Use 'it's' (contraction) when you mean 'it is' or 'it has'.",
        offset: match.index,
        length: match[0].length,
      });
    }
    return issues;
  }

  private static checkTheirThereTheyre(text: string): Issue[] {
    const issues: Issue[] = [];
    const thereLocationRegex = /\bover\s+their\b/gi;
    let match: RegExpExecArray | null;
    while ((match = thereLocationRegex.exec(text)) !== null) {
      issues.push({
        type: 'spelling',
        original: match[0],
        suggestion: 'over there',
        reason: "Use 'there' for locations, not 'their' (possessive).",
        offset: match.index,
        length: match[0].length,
      });
    }
    return issues;
  }

  private static checkYourYoure(text: string): Issue[] {
    const issues: Issue[] = [];
    const yourShouldBeYoureRegex = /\byour\s+(?:welcome|absolutely|right|wrong|amazing|awesome|incredible|fantastic|wonderful|great|excellent|perfect|beautiful|stunning|gorgeous|brilliant|smart|intelligent|talented|skilled|experienced|qualified|prepared|ready|finished|done|complete|correct|incorrect|mistaken|confused|lost|found|gone|here|there|early|late|busy|free|available|unavailable|important|necessary|essential|critical|vital|crucial|key|main|primary|principal|chief|major|minor|significant|relevant|appropriate|suitable|fitting|proper|correct|right|wrong|bad|good|better|best|worse|worst)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = yourShouldBeYoureRegex.exec(text)) !== null) {
      const parts = match[0].split(' ');
      issues.push({
        type: 'spelling',
        original: match[0],
        suggestion: `you're ${parts[1] || ''}`,
        reason: "Use 'you're' (contraction of 'you are') here.",
        offset: match.index,
        length: match[0].length,
      });
    }
    return issues;
  }

  private static checkCommaSplices(text: string): Issue[] {
    const issues: Issue[] = [];
    const commaSpliceRegex = /\b([A-Z][^.]*?)\s*,\s+([A-Z][^.]*?[.!?])/g;
    let match: RegExpExecArray | null;
    while ((match = commaSpliceRegex.exec(text)) !== null) {
      const clause1 = match[1]?.trim() || '';
      const clause2 = match[2]?.trim() || '';
      if (clause1.split(' ').length > 3 && clause2.split(' ').length > 3) {
        issues.push({
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
  }

  private static checkDoubleNegatives(text: string): Issue[] {
    const issues: Issue[] = [];
    const negativeWords = ["don't", "doesn't", "didn't", "won't", "wouldn't", "couldn't", "shouldn't", "can't", "cannot", "no", "not", "never", "nothing", "nobody", "nowhere", "neither", "nor"];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    let currentIndex = 0;
    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();
      const foundNegatives = negativeWords.filter(word => lowerSentence.includes(word));
      if (foundNegatives.length >= 2) {
        issues.push({
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
  }

  private static checkRedundantPhrases(text: string): Issue[] {
    const issues: Issue[] = [];
    const redundantPhrases: Record<string, string> = {
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
    };
    for (const [phrase, replacement] of Object.entries(redundantPhrases)) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        issues.push({
          type: 'clarity',
          original: match[0],
          suggestion: replacement,
          reason: `Redundant phrase. Use "${replacement}" instead.`,
          offset: match.index,
          length: match[0].length,
        });
      }
    }
    return issues;
  }

  private static checkWeakWords(text: string): Issue[] {
    const issues: Issue[] = [];
    const weakWords: Record<string, string> = {
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
    };
    for (const [weak, strong] of Object.entries(weakWords)) {
      const regex = new RegExp(`\\b${weak}\\b`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        issues.push({
          type: 'style',
          original: match[0],
          suggestion: strong,
          reason: `Consider a stronger word: "${strong}".`,
          offset: match.index,
          length: match[0].length,
        });
      }
    }
    return issues;
  }

  private static checkCliches(text: string): Issue[] {
    const issues: Issue[] = [];
    const cliches = [
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
    ];
    for (const cliche of cliches) {
      const regex = new RegExp(`\\b${cliche}\\b`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        issues.push({
          type: 'style',
          original: match[0],
          suggestion: 'Use original phrasing',
          reason: 'This is a cliché. Consider using more original language.',
          offset: match.index,
          length: match[0].length,
        });
      }
    }
    return issues;
  }

  private static checkCustomRules(text: string): Issue[] {
    const issues: Issue[] = [];
    for (const rule of this.customRules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          issues.push({
            type: rule.type,
            original: match[0],
            suggestion: rule.replacement,
            reason: rule.description,
            offset: match.index,
            length: match[0].length,
            id: rule.id,
          });
        }
      } catch (e) {
        console.warn('Invalid custom rule pattern:', rule.pattern, e);
      }
    }
    return issues;
  }

  /**
   * Check for article errors (a/an)
   */
  private static checkArticleErrors(text: string): Issue[] {
    const issues: Issue[] = [];

    // "a" before vowel sounds (but not "a uniform", "a user", "a European", etc.)
    const vowelExceptions = new Set(['uni', 'use', 'usu', 'eur', 'one', 'once']);
    const aBeforeVowelRegex = /\ba\s+([aeiou]\w*)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = aBeforeVowelRegex.exec(text)) !== null) {
      const nextWord = (match[1] || '').toLowerCase();
      const isException = Array.from(vowelExceptions).some(ex => nextWord.startsWith(ex));
      if (!isException) {
        issues.push({
          type: 'grammar',
          original: match[0],
          suggestion: `an ${match[1]}`,
          reason: 'Use "an" before words that begin with a vowel sound.',
          offset: match.index,
          length: match[0].length,
        });
      }
    }

    // "an" before consonant sounds (but not "an hour", "an honest", "an heir")
    const consonantExceptions = new Set(['hour', 'honest', 'honor', 'honour', 'heir', 'herb']);
    const anBeforeConsonantRegex = /\ban\s+([bcdfghjklmnpqrstvwxyz]\w*)\b/gi;
    while ((match = anBeforeConsonantRegex.exec(text)) !== null) {
      const nextWord = (match[1] || '').toLowerCase();
      const isException = Array.from(consonantExceptions).some(ex => nextWord.startsWith(ex));
      if (!isException) {
        issues.push({
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
  }

  /**
   * Check for subject-verb agreement errors
   */
  private static checkSubjectVerbAgreement(text: string): Issue[] {
    const issues: Issue[] = [];

    const svRules: Array<{pattern: RegExp, suggestion: string, reason: string}> = [
      { pattern: /\b(he|she|it)\s+don't\b/gi, suggestion: "$1 doesn't", reason: 'Use "doesn\'t" with he/she/it.' },
      { pattern: /\b(they|we|you)\s+doesn't\b/gi, suggestion: "$1 don't", reason: 'Use "don\'t" with they/we/you.' },
      { pattern: /\b(he|she|it)\s+have\s+(been|done|gone|made|seen|had)\b/gi, suggestion: "$1 has $2", reason: 'Use "has" with he/she/it.' },
      { pattern: /\beveryone\s+have\b/gi, suggestion: 'everyone has', reason: 'Use "has" with "everyone" (singular).' },
      { pattern: /\beverybody\s+have\b/gi, suggestion: 'everybody has', reason: 'Use "has" with "everybody" (singular).' },
      { pattern: /\bsomebody\s+have\b/gi, suggestion: 'somebody has', reason: 'Use "has" with "somebody" (singular).' },
      { pattern: /\bnobody\s+have\b/gi, suggestion: 'nobody has', reason: 'Use "has" with "nobody" (singular).' },
      { pattern: /\b(he|she|it)\s+were\b/gi, suggestion: '$1 was', reason: 'Use "was" with he/she/it (singular).' },
      { pattern: /\b(I|we|they)\s+was\b/gi, suggestion: '$1 were', reason: 'Use "were" with I/we/they.' },
      { pattern: /\bthere\s+is\s+(many|several|numerous|various|multiple)\b/gi, suggestion: 'there are $1', reason: 'Use "are" with plural subjects.' },
      { pattern: /\bI\s+is\b/gi, suggestion: 'I am', reason: 'Use "am" with the subject "I".' },
      { pattern: /\bI\s+are\b/gi, suggestion: 'I am', reason: 'Use "am" with the subject "I".' },
      { pattern: /\b(you|we|they)\s+is\b/gi, suggestion: '$1 are', reason: 'Use "are" with plural subjects and "you".' },
      { pattern: /\b(you|we|they)\s+am\b/gi, suggestion: '$1 are', reason: 'Use "are" with plural subjects and "you".' },
    ];

    for (const rule of svRules) {
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(text)) !== null) {
        issues.push({
          type: 'grammar',
          original: match[0],
          suggestion: match[0].replace(rule.pattern, rule.suggestion),
          reason: rule.reason,
          offset: match.index,
          length: match[0].length,
        });
      }
    }

    return issues;
  }

  /**
   * Check for missing commas in common patterns
   */
  private static checkMissingCommas(text: string): Issue[] {
    const issues: Issue[] = [];

    // Comma after introductory words
    const introWords = ['however', 'therefore', 'furthermore', 'moreover', 'nevertheless',
      'meanwhile', 'consequently', 'additionally', 'similarly', 'accordingly',
      'unfortunately', 'fortunately', 'finally', 'obviously', 'clearly'];

    for (const word of introWords) {
      const regex = new RegExp(`(?:^|[.!?]\\s+)${word}\\s+(?!,)([A-Za-z])`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];
        // Only flag if the word starts at the beginning or after a sentence
        const wordStart = text.indexOf(word, match.index);
        if (wordStart >= 0) {
          issues.push({
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

    // Comma with direct address: "Thanks John" → "Thanks, John"
    const addressPatterns = [
      /\b(thanks|thank you|hi|hello|hey|dear|excuse me)\s+([A-Z][a-z]+)\b/g,
    ];
    for (const pattern of addressPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        issues.push({
          type: 'grammar',
          original: match[0],
          suggestion: `${match[1]}, ${match[2]}`,
          reason: 'Add a comma before a name in direct address.',
          offset: match.index,
          length: match[0].length,
        });
      }
    }

    return issues;
  }

  /**
   * Check for commonly confused words using context clues
   */
  private static checkConfusedWords(text: string): Issue[] {
    const issues: Issue[] = [];

    const confusedRules: Array<{pattern: RegExp, suggestion: string, reason: string}> = [
      // affect vs effect
      { pattern: /\bthe\s+affect\b/gi, suggestion: 'the effect', reason: 'Use "effect" (noun). "Affect" is usually a verb.' },
      { pattern: /\ban\s+affect\b/gi, suggestion: 'an effect', reason: 'Use "effect" (noun). "Affect" is usually a verb.' },
      { pattern: /\bhas\s+no\s+affect\b/gi, suggestion: 'has no effect', reason: 'Use "effect" (noun) here.' },
      { pattern: /\beffect\s+(the|a|his|her|their|our|my|your|its)\b/gi, suggestion: 'affect $1', reason: 'Use "affect" (verb) when meaning "to influence".' },

      // then vs than
      { pattern: /\b(bigger|smaller|better|worse|more|less|faster|slower|higher|lower|greater|fewer|older|younger|earlier|later|longer|shorter|taller|stronger|weaker|easier|harder|smarter|richer|poorer|cheaper|nicer|closer)\s+then\b/gi, suggestion: '$1 than', reason: 'Use "than" for comparisons, not "then".' },

      // lose vs loose
      { pattern: /\b(will|might|could|would|going to|gonna|dont want to|don't want to)\s+loose\b/gi, suggestion: '$1 lose', reason: 'Use "lose" (verb, opposite of win/find). "Loose" means not tight.' },

      // accept vs except
      { pattern: /\bexcept\s+(the|his|her|their|our|my|your|this|that|an?)\s+(offer|invitation|terms|conditions|award|gift|prize|challenge|proposal|request|apology|responsibility)\b/gi, suggestion: 'accept $1 $2', reason: 'Use "accept" (to receive). "Except" means excluding.' },

      // who vs whom
      { pattern: /\bto\s+who\b/gi, suggestion: 'to whom', reason: 'Use "whom" after a preposition (to, for, with, by).' },
      { pattern: /\bfor\s+who\b/gi, suggestion: 'for whom', reason: 'Use "whom" after a preposition.' },
      { pattern: /\bwith\s+who\b/gi, suggestion: 'with whom', reason: 'Use "whom" after a preposition.' },
      { pattern: /\bby\s+who\b/gi, suggestion: 'by whom', reason: 'Use "whom" after a preposition.' },

      // complement vs compliment
      { pattern: /\bcomplement\s+(him|her|them|you|me|us)\b/gi, suggestion: 'compliment $1', reason: 'Use "compliment" (praise). "Complement" means to complete.' },

      // principal vs principle
      { pattern: /\bthe\s+principle\s+(of\s+the\s+school|said|announced|decided)\b/gi, suggestion: 'the principal $1', reason: 'Use "principal" for a school leader. "Principle" is a rule or belief.' },

      // weather vs whether
      { pattern: /\bweather\s+(or\s+not|we|you|they|he|she|it|I|to)\b/gi, suggestion: 'whether $1', reason: 'Use "whether" for conditions/choices. "Weather" refers to climate.' },

      // bare vs bear
      { pattern: /\bcan't\s+bare\b/gi, suggestion: "can't bear", reason: 'Use "bear" (to tolerate). "Bare" means naked or uncovered.' },

      // peak vs peek vs pique
      { pattern: /\bpeek\s+(interest|curiosity)\b/gi, suggestion: 'pique $1', reason: 'Use "pique" (to stimulate). "Peek" means to look quickly.' },
      { pattern: /\bpeak\s+(interest|curiosity)\b/gi, suggestion: 'pique $1', reason: 'Use "pique" (to stimulate). "Peak" means the top.' },
    ];

    for (const rule of confusedRules) {
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(text)) !== null) {
        issues.push({
          type: 'spelling',
          original: match[0],
          suggestion: match[0].replace(rule.pattern, rule.suggestion),
          reason: rule.reason,
          offset: match.index,
          length: match[0].length,
        });
      }
    }

    return issues;
  }

  /**
   * Check for sentence fragments — sentences starting with subordinating
   * conjunctions that lack a main clause.
   */
  private static checkSentenceFragments(text: string): Issue[] {
    const issues: Issue[] = [];

    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    let currentIndex = 0;

    const subordinators = /^\s*(because|although|though|even though|while|whereas|since|unless|until|if|when|whenever|wherever|after|before|as soon as|in order to|so that)\b/i;

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      const match = subordinators.exec(trimmed);

      if (match) {
        // A sentence fragment typically has no comma indicating a main clause joined
        // and is relatively short (< 12 words likely fragment)
        const wordCount = trimmed.split(/\s+/).length;
        const hasComma = trimmed.includes(',');

        // If it starts with a subordinator, is short, and has no comma
        // it's very likely a fragment
        if (wordCount < 10 && !hasComma) {
          issues.push({
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
  }
}

export class LLMAnalyzer {
  static async analyze(
    text: string, 
    apiKey: string, 
    model: string = 'gpt-3.5-turbo',
    provider: LLMProvider = 'openai',
    baseUrl?: string,
    context?: AnalysisContext,
    ruleIssues?: Issue[]
  ): Promise<Issue[]> {
    try {
      let issues: any[] = [];

      // Use Groq SDK for Groq provider
      if (provider === 'groq') {
        issues = await this.analyzeWithGroq(text, apiKey, model, context, ruleIssues);
      } else {
        // Use OpenAI SDK for other providers (OpenAI, OpenRouter, Together, Ollama, Custom)
        issues = await this.analyzeWithOpenAI(text, apiKey, model, provider, baseUrl, context, ruleIssues);
      }

      return issues;
    } catch (error) {
      console.error(`LLM Analysis Error (${provider}):`, error);
      return [];
    }
  }

  private static async analyzeWithGroq(
    text: string,
    apiKey: string,
    model: string,
    context?: AnalysisContext,
    ruleIssues?: Issue[]
  ): Promise<Issue[]> {
    const groq = new Groq({ apiKey });

    const { systemPrompt, userPrompt } = this.createGrammarPrompts(text, context, ruleIssues);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    let content = chatCompletion.choices[0]?.message?.content;
    if (!content) return [];

    content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const result = JSON.parse(content);

    return (result.issues || []).map((issue: any) => {
      const index = text.indexOf(issue.original);
      return {
        ...issue,
        offset: index !== -1 ? index : 0,
        length: issue.original?.length || 0,
      };
    });
  }

  private static async analyzeWithOpenAI(
    text: string,
    apiKey: string,
    model: string,
    provider: LLMProvider,
    baseUrl?: string,
    context?: AnalysisContext,
    ruleIssues?: Issue[]
  ): Promise<Issue[]> {
    const providerBaseUrl = baseUrl || this.getProviderBaseUrl(provider);
    
    const openai = new OpenAI({
      apiKey: apiKey || 'ollama',
      baseURL: providerBaseUrl,
    });

    const { systemPrompt, userPrompt } = this.createGrammarPrompts(text, context, ruleIssues);

    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    let content = completion.choices[0]?.message?.content;
    if (!content) return [];

    content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const result = JSON.parse(content);

    return (result.issues || []).map((issue: any) => {
      const index = text.indexOf(issue.original);
      return {
        ...issue,
        offset: index !== -1 ? index : 0,
        length: issue.original?.length || 0,
      };
    });
  }

  private static getProviderBaseUrl(provider: LLMProvider): string {
    const urls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      groq: 'https://api.groq.com/openai/v1',
      together: 'https://api.together.xyz/v1',
      ollama: 'http://localhost:11434/v1',
      custom: '',
    };
    return urls[provider as string] ?? urls.openai;
  }

  /**
   * Create structured, few-shot grammar prompts with domain awareness.
   * Returns separate system and user prompts for better LLM instruction following.
   */
  private static createGrammarPrompts(
    text: string,
    context?: AnalysisContext,
    ruleIssues?: Issue[]
  ): { systemPrompt: string; userPrompt: string } {
    // Detect writing domain from context
    const domain = this.detectDomain(context);
    const domainInstruction = this.getDomainInstruction(domain);

    // Build the list of already-detected issues so LLM doesn't duplicate
    const alreadyDetected = ruleIssues && ruleIssues.length > 0
      ? `\n\nALREADY DETECTED (do NOT report these again):\n${ruleIssues.slice(0, 15).map(i => `- "${i.original}" → "${i.suggestion}"`).join('\n')}`
      : '';

    const systemPrompt = `You are a professional copy editor and grammar expert. Your job is to find errors that automated rules might miss — contextual mistakes, awkward phrasing, unclear antecedents, and subtle grammar issues.

RULES:
1. Report ONLY genuine errors. Do NOT flag valid informal English or stylistic choices.
2. Every suggestion must be a concrete replacement, never vague advice like "consider rewording."
3. Match the "original" field EXACTLY to a substring in the text.
4. Maximum 8 issues per analysis. Prioritize: spelling > grammar > clarity > style.
5. Do NOT repeat issues already detected by the rule engine.${alreadyDetected}
${domainInstruction}

RETURN FORMAT: Valid JSON only.
{
  "issues": [
    {
      "type": "grammar|spelling|clarity|style",
      "original": "exact substring from text",
      "suggestion": "concrete replacement",
      "reason": "one-sentence explanation"
    }
  ]
}

EXAMPLE:
Input: "The team have decided to moves forward with there plan."
Output: {"issues":[{"type":"grammar","original":"team have","suggestion":"team has","reason":"'Team' is a collective noun treated as singular in American English."},{"type":"grammar","original":"to moves","suggestion":"to move","reason":"Infinitive verbs should use the base form."},{"type":"spelling","original":"there plan","suggestion":"their plan","reason":"'Their' (possessive) is needed here, not 'there' (location)."}]}

If there are no issues, return: {"issues": []}`;

    // Build context block
    const contextBlock = context
      ? `\n\nCONTEXT:\n- Source: ${context.domain || 'unknown'} (${context.editorType || 'generic'})\n- Active sentence: ${context.activeSentence || 'n/a'}\n- Surrounding text: ${(context.previousText || '').slice(-100)}[CURSOR]${(context.nextText || '').slice(0, 100)}`
      : '';

    const userPrompt = `Analyze this text for grammar, spelling, clarity, and style issues:\n\n"""\n${text}\n"""${contextBlock}`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Detect the writing domain from URL and editor type
   */
  private static detectDomain(context?: AnalysisContext): string {
    if (!context?.domain) return 'general';
    const d = context.domain.toLowerCase();
    if (d.includes('mail.google') || d.includes('outlook') || d.includes('yahoo')) return 'email';
    if (d.includes('docs.google') || d.includes('notion') || d.includes('overleaf')) return 'document';
    if (d.includes('github') || d.includes('stackoverflow') || d.includes('gitlab')) return 'technical';
    if (d.includes('twitter') || d.includes('reddit') || d.includes('facebook') || d.includes('linkedin')) return 'social';
    if (d.includes('slack') || d.includes('discord') || d.includes('teams')) return 'chat';
    return 'general';
  }

  /**
   * Get domain-specific instructions for the LLM
   */
  private static getDomainInstruction(domain: string): string {
    const instructions: Record<string, string> = {
      email: '\nDOMAIN: Email. Focus on tone, professionalism, and brevity. Flag overly casual language in business emails. Ignore informal greetings.',
      document: '\nDOMAIN: Document/Essay. Focus on formal grammar, passive voice overuse, paragraph transitions, and academic clarity.',
      technical: '\nDOMAIN: Technical writing. Ignore code blocks and variable names. Check only prose. Be lenient with technical jargon.',
      social: '\nDOMAIN: Social media. Only flag clear spelling/grammar errors. Do NOT flag informal language, slang, or conversational tone.',
      chat: '\nDOMAIN: Chat/messaging. Only flag obvious typos. Do NOT flag informal language or abbreviations.',
      general: '',
    };
    return instructions[domain] || '';
  }

  static async getModels(provider: string, apiKey?: string, baseUrl?: string): Promise<string[]> {
    try {
      const providerBaseUrl = baseUrl || this.getProviderBaseUrl(provider as LLMProvider);
      
      // For Ollama, use 'ollama' as dummy key
      // For other providers, use provided key or empty string
      const keyForRequest = provider === 'ollama' ? 'ollama' : (apiKey || '');
      
      const openai = new OpenAI({
        apiKey: keyForRequest,
        baseURL: providerBaseUrl,
      });
      const models = await openai.models.list();
      return models.data.map(m => m.id).slice(0, 50);
    } catch (error) {
      console.debug(`Failed to fetch models for ${provider}:`, error instanceof Error ? error.message : error);
      // Return default models from config instead of failing
      return [];
    }
  }
}
