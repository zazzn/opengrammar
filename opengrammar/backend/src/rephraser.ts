import { Groq } from 'groq-sdk';
import OpenAI from 'openai';
import type { LLMProvider } from './shared-types.js';

export type RephraseGoal = 'clarity' | 'formal' | 'concise' | 'friendly';

export interface RephraseSuggestion {
  text: string;
  label: string;
}

export interface RephraseResult {
  suggestions: RephraseSuggestion[];
  explanation: string;
  bestMatch: number;
}

const GOAL_DESCRIPTIONS: Record<RephraseGoal, { adjective: string; label: string }> = {
  clarity:  { adjective: 'clearer and easier to understand',                label: '🎯 Clearer'   },
  formal:   { adjective: 'more formal and professional',                     label: '👔 Formal'    },
  concise:  { adjective: 'shorter and more concise (remove filler words)',   label: '✂️ Concise'  },
  friendly: { adjective: 'warmer, friendlier, and more approachable',        label: '😊 Friendly'  },
};

const SYSTEM_PROMPT = `You are an expert writing assistant. Rewrite the given sentence in exactly 3 different ways.

Rules:
1. Keep the core meaning intact
2. Apply the requested goal (clarity/formal/concise/friendly)  
3. Each rewrite must be meaningfully different from the others
4. Keep the same approximate length unless goal is "concise"
5. Return ONLY a JSON object — no preamble, no markdown

Format:
{
  "suggestions": [
    { "text": "First rewrite", "label": "Option 1" },
    { "text": "Second rewrite", "label": "Option 2" },
    { "text": "Third rewrite", "label": "Option 3" }
  ],
  "explanation": "One sentence explaining what was improved",
  "bestMatch": 0
}`;

export class Rephraser {
  /**
   * Generate 3 rephrase suggestions for a given sentence.
   * Supports Groq (free), OpenAI, Ollama, and OpenRouter.
   */
  static async rephrase(
    sentence: string,
    goal: RephraseGoal = 'clarity',
    apiKey: string,
    provider: LLMProvider = 'groq',
    model?: string,
    baseUrl?: string,
  ): Promise<RephraseResult> {
    const goalDesc = GOAL_DESCRIPTIONS[goal];
    const userPrompt = `Rewrite this sentence in 3 ways that are ${goalDesc.adjective}:\n\n"${sentence}"`;

    try {
      if (provider === 'groq') {
        return await Rephraser.rephraseWithGroq(userPrompt, apiKey, model || 'llama3-8b-8192');
      } else {
        return await Rephraser.rephraseWithOpenAI(userPrompt, apiKey, model || 'gpt-3.5-turbo', provider, baseUrl);
      }
    } catch (err) {
      console.error(`[Rephraser] ${provider} error:`, err);
      // Return empty gracefully
      return {
        suggestions: [],
        explanation: 'Rephrase failed. Please check your API key and try again.',
        bestMatch: 0,
      };
    }
  }

  private static async rephraseWithGroq(
    userPrompt: string,
    apiKey: string,
    model: string,
  ): Promise<RephraseResult> {
    const groq = new Groq({ apiKey });
    const res = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 512,
    });
    const raw = res.choices[0]?.message?.content || '{}';
    return Rephraser.parseResult(raw);
  }

  private static async rephraseWithOpenAI(
    userPrompt: string,
    apiKey: string,
    model: string,
    provider: LLMProvider,
    baseUrl?: string,
  ): Promise<RephraseResult> {
    const providerUrls: Record<string, string> = {
      openai:      'https://api.openai.com/v1',
      openrouter:  'https://openrouter.ai/api/v1',
      together:    'https://api.together.xyz/v1',
      ollama:      'http://localhost:11434/v1',
      custom:      baseUrl || '',
    };
    const openai = new OpenAI({
      apiKey: apiKey || 'ollama',
      baseURL: baseUrl || providerUrls[provider as string] || providerUrls.openai,
    });
    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 512,
    });
    const raw = res.choices[0]?.message?.content || '{}';
    return Rephraser.parseResult(raw);
  }

  private static parseResult(raw: string): RephraseResult {
    try {
      const cleaned = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);
      return {
        suggestions: (parsed.suggestions || []).map((s: any) => ({
          text: s.text || s,
          label: s.label || 'Option',
        })),
        explanation: parsed.explanation || '',
        bestMatch:   typeof parsed.bestMatch === 'number' ? parsed.bestMatch : 0,
      };
    } catch {
      return { suggestions: [], explanation: 'Could not parse response.', bestMatch: 0 };
    }
  }
}
