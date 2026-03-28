import type { AnalysisContext, Issue, CustomRule, LLMProvider } from './shared-types.js';
import OpenAI from 'openai';
import { Groq } from 'groq-sdk';
import { checkSpelling, SAFE_WORDS } from './spellchecker.js';
import { NLPEngine } from './nlp/nlp-engine.js';
import { CORE_RULES } from './rules/index.js';
import { filterRulesByContext, type WritingContext } from './rules/context-filter.js';

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

  static analyze(text: string, options?: { dictionary?: string[]; customRules?: CustomRule[]; writingContext?: WritingContext }): Issue[] {
    const issues: Issue[] = [];

    if (options?.dictionary) {
      this.dictionary = new Set(options.dictionary.map(w => w.toLowerCase()));
    }

    if (options?.customRules) {
      this.customRules = options.customRules;
    }

    // Dictionary-based spell checking (real spell checker)
    issues.push(...checkSpelling(text, this.dictionary));

    // Initialize NLP Engine for Syntax Checks
    let doc: any = null;
    try {
      doc = NLPEngine.parse(text);
    } catch (e) {
      console.warn('NLP Engine parsing disabled or failed:', e);
    }

    // Run Modular CORE RULES (filtered by writing context)
    const activeRules = options?.writingContext
      ? filterRulesByContext(CORE_RULES, options.writingContext)
      : CORE_RULES;

    for (const rule of activeRules) {
      try {
        if (rule.type === 'regex') {
          issues.push(...rule.check(text));
        } else if (rule.type === 'nlp' && doc) {
          issues.push(...rule.check(text, doc));
        }
      } catch (e) {
        console.error(`Rule ${rule.id} failed:`, e);
      }
    }

    // Custom Rules (Runtime injections)
    issues.push(...this.checkCustomRules(text));

    // Deduplicate: when multiple rules flag the same text span,
    // keep the highest-priority match (grammar > spelling > clarity > style)
    return this.deduplicateIssues(issues);
  }

  /**
   * Remove duplicate issues that flag the same or overlapping text spans.
   * Priority: grammar errors > spelling > clarity > style suggestions.
   * When two issues share the same offset+length, keep the higher priority one.
   * When one issue fully contains another, keep the more specific (shorter) one.
   */
  private static deduplicateIssues(issues: Issue[]): Issue[] {
    const PRIORITY: Record<string, number> = { grammar: 4, spelling: 3, clarity: 2, style: 1 };

    // Sort by offset, then by priority (highest first)
    const sorted = issues.sort((a, b) => {
      if (a.offset !== b.offset) return a.offset - b.offset;
      return (PRIORITY[b.type] || 0) - (PRIORITY[a.type] || 0);
    });

    const result: Issue[] = [];
    const seenSpans = new Map<string, Issue>(); // key: "offset:length" or normalized original

    for (const issue of sorted) {
      const spanKey = `${issue.offset}:${issue.length}`;
      const origKey = issue.original.toLowerCase().trim();

      // Case 1: Exact same span — keep higher priority
      if (seenSpans.has(spanKey)) {
        const existing = seenSpans.get(spanKey)!;
        if ((PRIORITY[issue.type] || 0) > (PRIORITY[existing.type] || 0)) {
          // Replace with higher-priority version
          const idx = result.indexOf(existing);
          if (idx >= 0) result[idx] = issue;
          seenSpans.set(spanKey, issue);
        }
        continue;
      }

      // Case 2: Same original text, same suggestion — skip duplicate
      const dedupKey = `${origKey}→${(issue.suggestion || '').toLowerCase().trim()}`;
      let isDuplicate = false;
      for (const seen of result) {
        const seenDedupKey = `${seen.original.toLowerCase().trim()}→${(seen.suggestion || '').toLowerCase().trim()}`;
        if (dedupKey === seenDedupKey && Math.abs(issue.offset - seen.offset) < 3) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) continue;

      // Case 3: Different rules flagging the same original text at the same position
      let overlapping = false;
      for (const seen of result) {
        if (seen.original.toLowerCase().trim() === origKey &&
            Math.abs(issue.offset - seen.offset) <= issue.original.length) {
          overlapping = true;
          // Keep the one with higher priority
          if ((PRIORITY[issue.type] || 0) > (PRIORITY[seen.type] || 0)) {
            const idx = result.indexOf(seen);
            if (idx >= 0) result[idx] = issue;
          }
          break;
        }
      }
      if (overlapping) continue;

      result.push(issue);
      seenSpans.set(spanKey, issue);
    }

    return result;
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
