export interface Issue {
  type: 'grammar' | 'spelling' | 'clarity' | 'style';
  original: string;
  suggestion: string;
  reason: string;
  offset: number;
  length: number;
  id?: string;
  ignored?: boolean;
  confidence?: number;
  priority?: number;
  source?: 'rule' | 'llm' | 'context';
}

export interface AnalysisContext {
  domain?: string;
  editorType?: string;
  activeSentence?: string;
  previousText?: string;
  nextText?: string;
  fullTextExcerpt?: string;
}

export interface AnalyzeRequest {
  text: string;
  apiKey?: string;
  model?: string;
  provider?: LLMProvider;
  baseUrl?: string;
  ignoredIssues?: string[];
  customRules?: CustomRule[];
  dictionary?: string[];
  context?: AnalysisContext;
  disabledModules?: string[];
}

export interface CustomRule {
  id: string;
  pattern: string;
  replacement: string;
  description: string;
  type: 'grammar' | 'spelling' | 'clarity' | 'style';
}

export interface AnalysisMetadata {
  textLength: number;
  issuesCount: number;
  processingTimeMs: number;
  contextUsed?: boolean;
  model?: string;
  provider?: string;
}

export interface AnalyzeResponse {
  issues: Issue[];
  metadata?: AnalysisMetadata;
  error?: string;
  message?: string;
}

export interface AutocompleteRequest {
  text: string;
  cursor: number;
  apiKey?: string;
  model?: string;
  provider?: LLMProvider;
  baseUrl?: string;
  context?: AnalysisContext;
}

export interface AutocompleteResponse {
  suggestion: string;
  confidence: number;
  replaceStart: number;
  replaceEnd: number;
  source: 'heuristic' | 'llm';
  error?: string;
}

export type LLMProvider = 'openai' | 'openrouter' | 'groq' | 'together' | 'ollama' | 'custom';

export interface ProviderConfig {
  id: LLMProvider;
  name: string;
  baseUrl: string;
  models: string[];
  requiresApiKey: boolean;
  description: string;
}

// Curated default model lists, ordered best-first for grammar/writing
// correction (strong instruction-following + low latency, cost-effective).
// When an API key is set these are refined by the provider's live /models
// list; obsolete/decommissioned models have been removed.
export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4.1'],
    requiresApiKey: true,
    description: 'Official OpenAI API',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-haiku',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.0-flash-001',
    ],
    requiresApiKey: true,
    description: 'Access 100+ models with one API',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma2-9b-it',
    ],
    requiresApiKey: true,
    description: 'Blazing fast inference',
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    ],
    requiresApiKey: true,
    description: 'Open source models at scale',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    models: ['qwen3', 'qwen2.5', 'llama3.1', 'gemma2', 'mistral'],
    requiresApiKey: false,
    description: 'Run models locally on your machine',
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    baseUrl: '',
    models: [],
    requiresApiKey: true,
    description: 'Your own OpenAI-compatible API',
  },
];
