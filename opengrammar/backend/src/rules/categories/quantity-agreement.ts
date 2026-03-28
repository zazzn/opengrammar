import { createRegexRule, type Rule } from '../types.js';

/**
 * ═══════════════════════════════════════════════════════
 *  Quantity Agreement Rules — QA Module
 *  Catches: "9 year old", "2 hour meeting", "3 mile run",
 *           "5 dollar bill", missing plurals after numbers
 * ═══════════════════════════════════════════════════════
 */
export const quantityAgreementRules: Rule[] = [
  // ─── NUMBER + UNIT + OLD (must come first, most specific) ───
  createRegexRule({
    id: 'QA_NUM_year_old',
    category: 'grammar',
    pattern: /\b(\d+(?:\.\d+)?)\s+year[\s-]old\b/i,
    suggestion: (m) => `${m[1]}-year-old`,
    reason: 'Use hyphens in compound adjectives: "9-year-old".',
  }),

  // ─── NUMBER + SINGULAR TIME UNIT (standalone/predicate) ───
  createRegexRule({
    id: 'QA_NUM_years_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+year\b(?!\s*[-—]?\s*old)/i,
    suggestion: (m) => `${m[1]} years`,
    reason: 'Use the plural form "years" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_months_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+month\b/i,
    suggestion: (m) => `${m[1]} months`,
    reason: 'Use the plural form "months" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_weeks_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+week\b/i,
    suggestion: (m) => `${m[1]} weeks`,
    reason: 'Use the plural form "weeks" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_days_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+day\b/i,
    suggestion: (m) => `${m[1]} days`,
    reason: 'Use the plural form "days" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_hours_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+hour\b/i,
    suggestion: (m) => `${m[1]} hours`,
    reason: 'Use the plural form "hours" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_minutes_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+minute\b/i,
    suggestion: (m) => `${m[1]} minutes`,
    reason: 'Use the plural form "minutes" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_seconds_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+second\b/i,
    suggestion: (m) => `${m[1]} seconds`,
    reason: 'Use the plural form "seconds" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_miles_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+mile\b/i,
    suggestion: (m) => `${m[1]} miles`,
    reason: 'Use the plural form "miles" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_km_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+kilometer\b/i,
    suggestion: (m) => `${m[1]} kilometers`,
    reason: 'Use the plural form "kilometers" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_dollars_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+dollar\b/i,
    suggestion: (m) => `${m[1]} dollars`,
    reason: 'Use the plural form "dollars" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_pounds_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+pound\b(?!\s*(sterling|force|per))/i,
    suggestion: (m) => `${m[1]} pounds`,
    reason: 'Use the plural form "pounds" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_points_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+point\b/i,
    suggestion: (m) => `${m[1]} points`,
    reason: 'Use the plural form "points" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_times_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+time\b(?!\s+(zone|frame|stamp|out|line))/i,
    suggestion: (m) => `${m[1]} times`,
    reason: 'Use the plural form "times" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_pages_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+page\b/i,
    suggestion: (m) => `${m[1]} pages`,
    reason: 'Use the plural form "pages" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_items_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+item\b/i,
    suggestion: (m) => `${m[1]} items`,
    reason: 'Use the plural form "items" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_steps_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+step\b/i,
    suggestion: (m) => `${m[1]} steps`,
    reason: 'Use the plural form "steps" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_words_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+word\b/i,
    suggestion: (m) => `${m[1]} words`,
    reason: 'Use the plural form "words" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_NUM_people_plural',
    category: 'grammar',
    pattern: /\b([2-9]\d*|1\d+)\s+person\b/i,
    suggestion: (m) => `${m[1]} people`,
    reason: 'Use "people" for counts greater than one, not "person".',
  }),

  // ─── WRITTEN-OUT NUMBER PLURALS ───
  createRegexRule({
    id: 'QA_WORD_two_year',
    category: 'grammar',
    pattern: /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\s+year\b(?!\s*[-—]?\s*old)/i,
    suggestion: (m) => `${m[1]} years`,
    reason: 'Use the plural form "years" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_WORD_two_month',
    category: 'grammar',
    pattern: /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\s+month\b/i,
    suggestion: (m) => `${m[1]} months`,
    reason: 'Use the plural form "months" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_WORD_two_day',
    category: 'grammar',
    pattern: /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\s+day\b/i,
    suggestion: (m) => `${m[1]} days`,
    reason: 'Use the plural form "days" after numbers greater than one.',
  }),
  createRegexRule({
    id: 'QA_WORD_two_hour',
    category: 'grammar',
    pattern: /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\s+hour\b/i,
    suggestion: (m) => `${m[1]} hours`,
    reason: 'Use the plural form "hours" after numbers greater than one.',
  }),

  // ─── HYPHENATED AGE COMPOUNDS ───
  createRegexRule({
    id: 'QA_AGE_month_old',
    category: 'grammar',
    pattern: /\b(\d+)\s+month[\s-]old\b/i,
    suggestion: (m) => `${m[1]}-month-old`,
    reason: 'Hyphenate compound age modifiers: "6-month-old".',
  }),
  createRegexRule({
    id: 'QA_AGE_week_old',
    category: 'grammar',
    pattern: /\b(\d+)\s+week[\s-]old\b/i,
    suggestion: (m) => `${m[1]}-week-old`,
    reason: 'Hyphenate compound age modifiers: "3-week-old".',
  }),
  createRegexRule({
    id: 'QA_AGE_day_old',
    category: 'grammar',
    pattern: /\b(\d+)\s+day[\s-]old\b/i,
    suggestion: (m) => `${m[1]}-day-old`,
    reason: 'Hyphenate compound age modifiers: "2-day-old".',
  }),
];
