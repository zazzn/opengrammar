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
}

export class LLMAnalyzer {
  static async analyze(
    text: string, 
    apiKey: string, 
    model: string = 'gpt-3.5-turbo',
    provider: LLMProvider = 'openai',
    baseUrl?: string,
    context?: AnalysisContext
  ): Promise<Issue[]> {
    try {
      let issues: any[] = [];

      // Use Groq SDK for Groq provider
      if (provider === 'groq') {
        issues = await this.analyzeWithGroq(text, apiKey, model, context);
      } else {
        // Use OpenAI SDK for other providers (OpenAI, OpenRouter, Together, Ollama, Custom)
        issues = await this.analyzeWithOpenAI(text, apiKey, model, provider, baseUrl, context);
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
    context?: AnalysisContext
  ): Promise<Issue[]> {
    const groq = new Groq({ apiKey });

    const prompt = this.createGrammarPrompt(text, context);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert grammar assistant. Return ONLY valid JSON.' 
        },
        { role: 'user', content: prompt }
      ],
      model: model,
      response_format: { type: 'json_object' },
      temperature: 0.3,
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
    context?: AnalysisContext
  ): Promise<Issue[]> {
    const providerBaseUrl = baseUrl || this.getProviderBaseUrl(provider);
    
    const openai = new OpenAI({
      apiKey: apiKey || 'ollama',
      baseURL: providerBaseUrl,
    });

    const prompt = this.createGrammarPrompt(text, context);

    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an expert grammar assistant. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: model,
      response_format: { type: 'json_object' },
      temperature: 0.3,
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

  private static createGrammarPrompt(text: string, context?: AnalysisContext): string {
    const contextBlock = context
      ? `\nCONTEXT:\n- Domain: ${context.domain || 'unknown'}\n- Editor type: ${context.editorType || 'generic'}\n- Active sentence: ${context.activeSentence || 'n/a'}\n- Previous text: ${context.previousText || 'n/a'}\n- Next text: ${context.nextText || 'n/a'}\n- Document excerpt: ${context.fullTextExcerpt || 'n/a'}\n`
      : '';

    return `Analyze this text for grammar, spelling, clarity, and style issues.

Use the additional context to improve consistency, tone, and document-level suggestions when available.

TEXT:
${text}
${contextBlock}

Return JSON:
{
  "issues": [
    {
      "type": "grammar|spelling|clarity|style",
      "original": "exact text",
      "suggestion": "correction",
      "reason": "brief explanation"
    }
  ]
}

Return ONLY JSON. If no issues: {"issues": []}`;
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
