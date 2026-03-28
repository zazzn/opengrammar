import type { Issue } from '../shared-types.js';

export type RuleCategory = 'spelling' | 'grammar' | 'style' | 'clarity';

export interface BaseRule {
  id: string;
  category: RuleCategory;
  reason: string;
}

export interface RegexRule extends BaseRule {
  type: 'regex';
  pattern: RegExp;
  suggestion: string | ((match: RegExpExecArray) => string);
  /**
   * Execute regex on text and return any matching issues.
   */
  check: (text: string) => Issue[];
}

export interface NLPRule extends BaseRule {
  type: 'nlp';
  /**
   * Returns a suggestion based on the NLP match.
   */
  suggestion: string;
  /**
   * Execute compromise match logic on the parsed document.
   */
  check: (text: string, doc: any) => Issue[];
}

export type Rule = RegexRule | NLPRule;

/**
 * Helper to easily create Regex-based rules.
 */
export function createRegexRule({
  id,
  category,
  reason,
  pattern,
  suggestion,
}: Omit<RegexRule, 'type' | 'check'>): RegexRule {
  return {
    id,
    type: 'regex',
    category,
    reason,
    pattern,
    suggestion,
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      let match: RegExpExecArray | null;

      // Ensure the regex has the 'g' flag if we want all matches
      const checkPattern = new RegExp(
        pattern.source,
        pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g',
      );

      while ((match = checkPattern.exec(text)) !== null) {
        issues.push({
          type: category,
          original: match[0],
          suggestion:
            typeof suggestion === 'function'
              ? suggestion(match)
              : match[0].replace(pattern, suggestion),
          reason,
          offset: match.index,
          length: match[0].length,
          id: `${id}-${match.index}`,
        });
      }
      return issues;
    },
  };
}
