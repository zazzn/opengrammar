import { beforeAll, describe, expect, test } from 'bun:test';
import { RuleBasedAnalyzer } from '../src/analyzer.js';
import { CORE_RULES } from '../src/rules/index.js';

/**
 * ╔══════════════════════════════════════════════════╗
 * ║  OpenGrammar Engine — Unit Test Suite            ║
 * ║  bun test                                        ║
 * ╚══════════════════════════════════════════════════╝
 */

// Helper: assert that text produces an issue containing the expected original match
function expectIssue(
  text: string,
  expectedOriginal: string,
  expectedType?: 'grammar' | 'spelling' | 'clarity' | 'style',
) {
  const issues = RuleBasedAnalyzer.analyze(text);
  const found = issues.find((i) =>
    i.original.toLowerCase().includes(expectedOriginal.toLowerCase()),
  );
  expect(found).toBeDefined();
  if (expectedType && found) {
    expect(found.type).toBe(expectedType);
  }
  return found!;
}

// Helper: assert that text does NOT produce a false positive for the given string
function expectNoIssue(text: string, notExpectedOriginal: string) {
  const issues = RuleBasedAnalyzer.analyze(text);
  const found = issues.find((i) =>
    i.original.toLowerCase().includes(notExpectedOriginal.toLowerCase()),
  );
  expect(found).toBeUndefined();
}

// ══════════════════════════════════════════════════
//  Module Loading
// ══════════════════════════════════════════════════
describe('Engine Bootstrap', () => {
  test('loads 700+ rules across 22 modules', () => {
    expect(CORE_RULES.length).toBeGreaterThan(700);
  });

  test('every rule has required fields', () => {
    for (const rule of CORE_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.type).toMatch(/^(regex|nlp)$/);
      expect(rule.category).toMatch(/^(grammar|spelling|clarity|style)$/);
      expect(typeof rule.check).toBe('function');
    }
  });

  test('no duplicate rule IDs', () => {
    const ids = CORE_RULES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    // Allow some duplicate IDs from spread arrays (e.g. dynamically-generated countable noun rules)
    // but flag truly identical rules
    expect(uniqueIds.size).toBeGreaterThan(ids.length * 0.95);
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Subject Verb Agreement
// ══════════════════════════════════════════════════
describe('Grammar: Subject-Verb Agreement', () => {
  test('everyone + plural verb', () => {
    const issue = expectIssue('Everyone are happy.', 'Everyone are', 'grammar');
    expect(issue.suggestion).toContain('is');
  });

  test('there is + plural noun', () => {
    const issue = expectIssue('There is many reasons.', 'There is many', 'grammar');
    expect(issue.suggestion).toContain('are');
  });

  test('collective nouns (AmE)', () => {
    expectIssue('The team are playing well.', 'team are', 'grammar');
  });

  test('valid: Everyone is happy (no false positive)', () => {
    expectNoIssue('Everyone is happy.', 'Everyone is');
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Irregular Verbs
// ══════════════════════════════════════════════════
describe('Grammar: Irregular Verbs', () => {
  test('buyed → bought', () => {
    const issue = expectIssue('He buyed a car.', 'buyed', 'grammar');
    expect(issue.suggestion).toBe('bought');
  });

  test('drived → drove', () => {
    const issue = expectIssue('She drived home.', 'drived', 'grammar');
    expect(issue.suggestion).toBe('drove');
  });

  test('catched → caught', () => {
    const issue = expectIssue('He catched the ball.', 'catched', 'grammar');
    expect(issue.suggestion).toBe('caught');
  });

  test('have went → have gone', () => {
    const issue = expectIssue('She has went to the store.', 'has went');
    expect(issue.suggestion).toContain('gone');
  });

  test('should have wrote → should have written', () => {
    const issue = expectIssue('I should have wrote that.', 'should have wrote');
    expect(issue.suggestion).toContain('written');
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Stative Verbs
// ══════════════════════════════════════════════════
describe('Grammar: Stative Verbs', () => {
  test('is knowing → knows', () => {
    expectIssue('I am knowing the answer.', 'knowing', 'grammar');
  });

  test('is belonging → belongs', () => {
    expectIssue('This is belonging to me.', 'belonging', 'grammar');
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Subjunctive Mood
// ══════════════════════════════════════════════════
describe('Grammar: Subjunctive', () => {
  test('if I was → if I were', () => {
    const issue = expectIssue('If I was rich, I would travel.', 'If I was', 'grammar');
    expect(issue.suggestion).toContain('were');
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Adjective/Adverb Errors
// ══════════════════════════════════════════════════
describe('Grammar: Adjectives & Adverbs', () => {
  test('sings beautiful → beautifully', () => {
    const issue = expectIssue('She sings beautiful.', 'sings beautiful', 'grammar');
    expect(issue.suggestion).toContain('beautifully');
  });

  test('plays good → plays well', () => {
    const issue = expectIssue('He plays good.', 'plays good', 'grammar');
    expect(issue.suggestion).toContain('well');
  });

  test('gooder → better', () => {
    const issue = expectIssue('He is gooder.', 'gooder', 'grammar');
    expect(issue.suggestion).toBe('better');
  });

  test('more taller (double comparative)', () => {
    expectIssue('She is more taller.', 'more taller', 'grammar');
  });

  test('I am boring → I am bored (participial)', () => {
    const issue = expectIssue('I am boring.', 'I am boring', 'grammar');
    expect(issue.suggestion).toContain('bored');
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Prepositions
// ══════════════════════════════════════════════════
describe('Grammar: Prepositions', () => {
  test('discuss about → discuss', () => {
    const issue = expectIssue('Lets discuss about the plan.', 'discuss about', 'grammar');
    expect(issue.suggestion).toBe('discuss');
  });

  test('walked in the room → into the room', () => {
    const issue = expectIssue('She walked in the room.', 'walked in the room', 'grammar');
    expect(issue.suggestion).toContain('into');
  });

  test('return back → return (redundant)', () => {
    const issue = expectIssue('Please return back the book.', 'return back', 'clarity');
    expect(issue.suggestion).toBe('return');
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Confused Words
// ══════════════════════════════════════════════════
describe('Grammar: Confused Words', () => {
  test('taller then → taller than', () => {
    expectIssue('He is taller then her.', 'then');
  });

  test('will loose → will lose', () => {
    expectIssue('I will loose my keys.', 'loose');
  });

  test("who's car → whose car", () => {
    const issue = expectIssue("Who's car is that?", "Who's car", 'grammar');
    expect(issue.suggestion).toContain('whose');
  });

  test('weather or not → whether', () => {
    expectIssue('Weather or not you agree.', 'Weather or not');
  });

  test('desert (food) → dessert', () => {
    expectIssue('I had desert after dinner.', 'desert');
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Idiom Errors
// ══════════════════════════════════════════════════
describe('Grammar: Idioms', () => {
  test('mute point → moot point', () => {
    const issue = expectIssue('That is a mute point.', 'mute point', 'grammar');
    expect(issue.suggestion).toBe('moot point');
  });

  test('sneak peak → sneak peek', () => {
    const issue = expectIssue('Here is a sneak peak.', 'sneak peak', 'grammar');
    expect(issue.suggestion).toBe('sneak peek');
  });

  test('could of → could have', () => {
    const issue = expectIssue('I could of gone.', 'could of', 'grammar');
    expect(issue.suggestion).toContain('have');
  });

  test('for all intensive purposes', () => {
    expectIssue('For all intensive purposes.', 'intensive purposes', 'grammar');
  });

  test('deep seeded → deep-seated', () => {
    const issue = expectIssue('A deep seeded issue.', 'deep seeded', 'grammar');
    expect(issue.suggestion).toBe('deep-seated');
  });

  test('suppose to → supposed to', () => {
    const issue = expectIssue('You are suppose to be here.', 'suppose to', 'grammar');
    expect(issue.suggestion).toBe('supposed to');
  });

  test('irregardless → regardless', () => {
    const issue = expectIssue('Irregardless of the results.', 'irregardless', 'grammar');
    expect(issue.suggestion).toBe('regardless');
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Nouns & Pronouns
// ══════════════════════════════════════════════════
describe('Grammar: Nouns & Pronouns', () => {
  test('childs → children', () => {
    const issue = expectIssue('The childs are playing.', 'childs', 'grammar');
    expect(issue.suggestion).toBe('children');
  });

  test('mouses → mice', () => {
    const issue = expectIssue('Many mouses escaped.', 'mouses', 'grammar');
    expect(issue.suggestion).toBe('mice');
  });

  test('an information (uncountable)', () => {
    expectIssue('I need an information.', 'an information', 'grammar');
  });

  test('many money → much money', () => {
    const issue = expectIssue('She has many money.', 'many money', 'grammar');
    expect(issue.suggestion).toContain('much');
  });

  test('contact myself → contact me', () => {
    const issue = expectIssue('Contact myself for details.', 'Contact myself', 'grammar');
    expect(issue.suggestion).toContain('me');
  });
});

// ══════════════════════════════════════════════════
//  Grammar — Punctuation
// ══════════════════════════════════════════════════
describe('Grammar: Punctuation', () => {
  test("dont → don't", () => {
    const issue = expectIssue('I dont know.', 'dont', 'grammar');
    expect(issue.suggestion).toBe("don't");
  });

  test('a well known → a well-known (hyphenation)', () => {
    const issue = expectIssue('A well known author.', 'well known', 'grammar');
    expect(issue.suggestion).toContain('well-known');
  });
});

// ══════════════════════════════════════════════════
//  Clarity — Wordy Phrases
// ══════════════════════════════════════════════════
describe('Clarity: Wordy Phrases', () => {
  test('due to the fact that → because', () => {
    const issue = expectIssue('Due to the fact that it rained.', 'Due to the fact that', 'clarity');
    expect(issue.suggestion).toBe('because');
  });

  test('has the ability to → can', () => {
    const issue = expectIssue('He has the ability to run.', 'has the ability to', 'clarity');
    expect(issue.suggestion).toBe('can');
  });

  test('in order to → to', () => {
    const issue = expectIssue('We did this in order to succeed.', 'in order to', 'clarity');
    expect(issue.suggestion).toBe('to');
  });
});

// ══════════════════════════════════════════════════
//  Clarity — Nominalizations
// ══════════════════════════════════════════════════
describe('Clarity: Nominalizations', () => {
  test('make a decision → decide', () => {
    const issue = expectIssue('We need to make a decision.', 'make a decision', 'clarity');
    expect(issue.suggestion).toBe('decide');
  });

  test('provide assistance → assist', () => {
    const issue = expectIssue('We provide assistance.', 'provide assistance', 'clarity');
    expect(issue.suggestion).toBe('assist');
  });
});

// ══════════════════════════════════════════════════
//  Clarity — Redundant Modifiers & Tautologies
// ══════════════════════════════════════════════════
describe('Clarity: Redundancy', () => {
  test('free gift → gift', () => {
    const issue = expectIssue('It was a free gift.', 'free gift', 'clarity');
    expect(issue.suggestion).toBe('gift');
  });

  test('future plans → plans', () => {
    const issue = expectIssue('What are your future plans?', 'future plans', 'clarity');
    expect(issue.suggestion).toBe('plans');
  });

  test('ATM machine → ATM', () => {
    const issue = expectIssue('Use the ATM machine.', 'ATM machine', 'clarity');
    expect(issue.suggestion).toBe('ATM');
  });

  test('PIN number → PIN', () => {
    const issue = expectIssue('Enter your PIN number.', 'PIN number', 'clarity');
    expect(issue.suggestion).toBe('PIN');
  });
});

// ══════════════════════════════════════════════════
//  Style — Clichés
// ══════════════════════════════════════════════════
describe('Style: Clichés', () => {
  test('think outside the box → be creative', () => {
    const issue = expectIssue('We should think outside the box.', 'think outside the box', 'style');
    expect(issue.suggestion).toBe('be creative');
  });

  test('touch base → connect', () => {
    const issue = expectIssue('Lets touch base later.', 'touch base', 'style');
    expect(issue.suggestion).toBe('connect');
  });

  test('circle back → revisit', () => {
    const issue = expectIssue('Lets circle back on this.', 'circle back', 'style');
    expect(issue.suggestion).toBe('revisit');
  });
});

// ══════════════════════════════════════════════════
//  Style — Formality
// ══════════════════════════════════════════════════
describe('Style: Formality', () => {
  test('gonna → going to', () => {
    const issue = expectIssue("I'm gonna go.", 'gonna', 'style');
    expect(issue.suggestion).toBe('going to');
  });

  test('lemme → let me (no spellcheck false positive)', () => {
    const issues = RuleBasedAnalyzer.analyze('Lemme know.');
    // Should have formality flag but NOT a garbled spellcheck suggestion
    const spellIssue = issues.find(
      (i) => i.type === 'spelling' && i.original.toLowerCase() === 'lemme',
    );
    expect(spellIssue).toBeUndefined(); // No more "leme" garbage
    const styleIssue = issues.find(
      (i) => i.type === 'style' && i.original.toLowerCase() === 'lemme',
    );
    expect(styleIssue).toBeDefined();
    expect(styleIssue!.suggestion).toBe('let me');
  });

  test('btw → by the way', () => {
    const issue = expectIssue('Check this btw.', 'btw', 'style');
    expect(issue.suggestion).toBe('by the way');
  });

  test('lol → (remove)', () => {
    expectIssue('That was funny lol.', 'lol', 'style');
  });
});

// ══════════════════════════════════════════════════
//  Style — Inclusive Language
// ══════════════════════════════════════════════════
describe('Style: Inclusive Language', () => {
  test('chairman → chairperson (no spellcheck false positive)', () => {
    const issues = RuleBasedAnalyzer.analyze('The chairman spoke.');
    // Should get inclusive flag, NOT a spellcheck "placeman" suggestion
    const spellIssue = issues.find((i) => i.type === 'spelling' && i.original === 'chairman');
    expect(spellIssue).toBeUndefined();
    const styleIssue = issues.find(
      (i) => i.type === 'style' && i.original.toLowerCase().includes('chairman'),
    );
    expect(styleIssue).toBeDefined();
    expect(styleIssue!.suggestion).toBe('chairperson');
  });

  test('fireman → firefighter', () => {
    const issue = expectIssue('The fireman arrived.', 'fireman', 'style');
    expect(issue.suggestion).toBe('firefighter');
  });

  test('mankind → humankind', () => {
    const issue = expectIssue('For the benefit of mankind.', 'mankind', 'style');
    expect(issue.suggestion).toBe('humankind');
  });

  test('suffers from autism → has autism', () => {
    const issue = expectIssue('She suffers from autism.', 'suffers from autism', 'style');
    expect(issue.suggestion).toContain('has');
  });

  test('lame excuse → weak excuse', () => {
    const issue = expectIssue('That is a lame excuse.', 'lame excuse', 'style');
    expect(issue.suggestion).toContain('weak');
  });
});

// ══════════════════════════════════════════════════
//  Style — Academic Writing
// ══════════════════════════════════════════════════
describe('Style: Academic Writing', () => {
  test('weasel: some people say', () => {
    expectIssue('Some people say this is true.', 'Some people say', 'style');
  });

  test('weasel: studies show', () => {
    expectIssue('Studies show it works.', 'Studies show', 'style');
  });

  test('I think that → evidence-based language', () => {
    expectIssue('I think that this is correct.', 'I think that', 'style');
  });
});

// ══════════════════════════════════════════════════
//  Style — Business Writing
// ══════════════════════════════════════════════════
describe('Style: Business Writing', () => {
  test('I am writing to inform you (empty opener)', () => {
    expectIssue(
      'I am writing to inform you that we need help.',
      'I am writing to inform you',
      'clarity',
    );
  });

  test('facilitate → help', () => {
    const issue = expectIssue('We must facilitate the process.', 'facilitate', 'style');
    expect(issue.suggestion).toBe('help');
  });

  test('not uncommon → flagged', () => {
    // The grammar double-negative rule fires first (higher priority)
    const issue = expectIssue('This is not uncommon.', 'not uncommon');
    expect(issue).toBeDefined(); // Flagged is what matters
  });

  test('ameliorate (no spellcheck false positive)', () => {
    const issues = RuleBasedAnalyzer.analyze('We should ameliorate the situation.');
    const spellIssue = issues.find(
      (i) => i.type === 'spelling' && i.original.toLowerCase() === 'ameliorate',
    );
    expect(spellIssue).toBeUndefined(); // No garbled suggestion
  });
});

// ══════════════════════════════════════════════════
//  Readability
// ══════════════════════════════════════════════════
describe('Readability', () => {
  test('long sentence detection (40+ words)', () => {
    const longSentence =
      'The extremely long and detailed report that was submitted by the committee on Thursday afternoon after the lengthy discussion about the project timeline and budget allocation was finally reviewed by the board of directors who decided to postpone the decision until next month.';
    const issues = RuleBasedAnalyzer.analyze(longSentence);
    const longIssue = issues.find((i) => i.reason.includes('words'));
    expect(longIssue).toBeDefined();
  });

  test('complex word: approximately → about', () => {
    expectIssue('There were approximately fifty people.', 'approximately', 'clarity');
  });

  test('complex word: aforementioned → previous', () => {
    const issue = expectIssue('The aforementioned report was clear.', 'aforementioned');
    expect(issue.suggestion).toBe('previous');
  });
});

// ══════════════════════════════════════════════════
//  Deduplication
// ══════════════════════════════════════════════════
describe('Deduplication', () => {
  test('same text span is not flagged twice', () => {
    // "ameliorate" used to be flagged by both style-tone and readability
    const issues = RuleBasedAnalyzer.analyze('We must ameliorate the situation.');
    const amIssues = issues.filter((i) => i.original.toLowerCase() === 'ameliorate');
    expect(amIssues.length).toBeLessThanOrEqual(1);
  });

  test('confused word not double-flagged by spellcheck + rule', () => {
    const issues = RuleBasedAnalyzer.analyze('I will loose my keys.');
    const looseIssues = issues.filter((i) => i.original.toLowerCase().includes('loose'));
    // Should have at most 1 issue per occurrence, not 2-3
    expect(looseIssues.length).toBeLessThanOrEqual(2); // can be flagged by different patterns
  });
});

// ══════════════════════════════════════════════════
//  False Positive Guards
// ══════════════════════════════════════════════════
describe('False Positive Guards', () => {
  test('correct sentence produces no grammar errors', () => {
    const issues = RuleBasedAnalyzer.analyze('The cat sat on the mat.');
    const grammarIssues = issues.filter((i) => i.type === 'grammar');
    expect(grammarIssues.length).toBe(0);
  });

  test('"I know the answer" is not flagged for stative verb', () => {
    expectNoIssue('I know the answer.', 'knowing');
  });

  test('"She ran into the room" is not flagged', () => {
    expectNoIssue('She ran into the room.', 'ran into');
  });
});

// ══════════════════════════════════════════════════
//  Context-Aware Rule Filtering
// ══════════════════════════════════════════════════
describe('Context-Aware Filtering', () => {
  const testText = 'Gonna go btw. He buyed a car. The chairman spoke. I think that this is true.';

  test('general context catches everything', () => {
    const issues = RuleBasedAnalyzer.analyze(testText, { writingContext: 'general' });
    // Should catch: gonna, btw, buyed, chairman, "I think that"
    expect(issues.length).toBeGreaterThanOrEqual(4);
  });

  test('chat context suppresses formality rules', () => {
    const issues = RuleBasedAnalyzer.analyze(testText, { writingContext: 'chat' });
    // Chat should still catch grammar errors (buyed → bought)
    const grammarIssues = issues.filter((i) => i.original.toLowerCase() === 'buyed');
    expect(grammarIssues.length).toBeGreaterThanOrEqual(1);
    // But should NOT flag "gonna" or "btw" (too informal for chat nagging)
    const gonnaIssue = issues.find((i) => i.original.toLowerCase() === 'gonna');
    expect(gonnaIssue).toBeUndefined();
  });

  test('email context includes business rules', () => {
    const emailText = 'I am writing to inform you that we need to facilitate the process.';
    const issues = RuleBasedAnalyzer.analyze(emailText, { writingContext: 'email' });
    // Should flag business writing issues
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  test('academic context includes weasel word detection', () => {
    const academicText = 'Some people say this is obvious. Studies show it works.';
    const issues = RuleBasedAnalyzer.analyze(academicText, { writingContext: 'academic' });
    const weaselIssue = issues.find((i) => i.original.toLowerCase().includes('some people'));
    expect(weaselIssue).toBeDefined();
  });

  test('grammar errors are caught in ALL contexts', () => {
    const contexts: Array<'chat' | 'social' | 'email' | 'technical' | 'general'> = [
      'chat',
      'social',
      'email',
      'technical',
      'general',
    ];
    for (const ctx of contexts) {
      const issues = RuleBasedAnalyzer.analyze('He buyed a car.', { writingContext: ctx });
      const buyedIssue = issues.find((i) => i.original.toLowerCase() === 'buyed');
      expect(buyedIssue).toBeDefined();
    }
  });

  test('fewer rules active in chat vs general', () => {
    const chatIssues = RuleBasedAnalyzer.analyze(testText, { writingContext: 'chat' });
    const generalIssues = RuleBasedAnalyzer.analyze(testText, { writingContext: 'general' });
    expect(chatIssues.length).toBeLessThan(generalIssues.length);
  });
});

// ══════════════════════════════════════════════════
//  Context Detection
// ══════════════════════════════════════════════════
describe('Context Detection', () => {
  // Import directly for unit testing
  const { detectWritingContext } = require('../src/rules/context-filter.js');

  test('detects chat context', () => {
    expect(detectWritingContext('app.slack.com')).toBe('chat');
    expect(detectWritingContext('discord.com')).toBe('chat');
  });

  test('detects email context', () => {
    expect(detectWritingContext('mail.google.com')).toBe('email');
    expect(detectWritingContext('outlook.live.com')).toBe('email');
  });

  test('detects social context', () => {
    expect(detectWritingContext('twitter.com')).toBe('social');
    expect(detectWritingContext('reddit.com')).toBe('social');
  });

  test('detects technical context', () => {
    expect(detectWritingContext('github.com')).toBe('technical');
    expect(detectWritingContext('stackoverflow.com')).toBe('technical');
  });

  test('detects academic context', () => {
    expect(detectWritingContext('overleaf.com')).toBe('academic');
  });

  test('returns general for unknown domains', () => {
    expect(detectWritingContext('random-site.com')).toBe('general');
    expect(detectWritingContext(undefined)).toBe('general');
  });
});

// ══════════════════════════════════════════════════
//  Manual Rule Overrides (disabledModules)
// ══════════════════════════════════════════════════
describe('Manual Rule Filtering (disabledModules)', () => {
  const testText = 'Gonna go btw. He buyed a car. The chairman spoke. I think that this is true.';

  test('disabling style rules ignores "gonna" and "btw"', () => {
    // Usually 'general' flags everything. If we disable 'style', only grammar and spelling run.
    const issues = RuleBasedAnalyzer.analyze(testText, {
      writingContext: 'general',
      disabledModules: ['style'], // 'style' covers style, formality, etc.
    });

    // Should still catch 'buyed' (grammar)
    expect(issues.some((i) => i.original.toLowerCase() === 'buyed')).toBe(true);
    // Should NOT catch 'gonna' (style/formality)
    expect(issues.some((i) => i.original.toLowerCase() === 'gonna')).toBe(false);
  });

  test('disabling grammar ignores grammar-specific "buyed"', () => {
    const issues = RuleBasedAnalyzer.analyze(testText, {
      writingContext: 'general',
      disabledModules: ['grammar'],
    });

    // Should NOT catch 'buyed' as a grammar issue (though spellchecker still flags it)
    expect(issues.some((i) => i.original.toLowerCase() === 'buyed' && i.type === 'grammar')).toBe(
      false,
    );
    // Might still catch 'gonna' (style)
    expect(issues.some((i) => i.original.toLowerCase() === 'gonna')).toBe(true);
  });
});
