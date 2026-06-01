export interface OllamaModelChoice {
  model: string;
  rank: number;
  label?: string;
  excluded?: boolean;
  reason?: string;
}

export const DEFAULT_WRITING_MODEL = 'qwen3.5:4b';

const EXCLUDED_MODEL_RE =
  /\b(?:coder|code|embed|embedding|vision|vl|math|guard|moderation|rerank|nomic|clip|whisper|llava)\b/i;

const UNSUPPORTED_WRITING_MODEL_RE =
  /^qwen3:(?:4b|8b)(?!.*instruct)/i;

const WRITING_RANKS: Array<{ re: RegExp; rank: number; label?: string }> = [
  { re: /^qwen3\.5:4b(?:$|[-_])/i, rank: 100, label: 'Recommended' },
  { re: /^qwen2\.5:7b(?:$|[-_])/i, rank: 96, label: 'Sentence-review baseline' },
  { re: /^qwen3:latest(?:$|[-_])/i, rank: 94, label: 'Context alternate' },
  { re: /^qwen3:4b-instruct(?:$|[-_])/i, rank: 92, label: 'Fast safe alternate' },
  { re: /^qwen3\.5:2b(?:$|[-_])/i, rank: 91, label: 'Fast alternate' },
  { re: /^qwen2\.5:3b(?:$|[-_])/i, rank: 88, label: 'Fast alternate' },
  { re: /^llama3\.2:3b(?:$|[-_])/i, rank: 86, label: 'Fast alternate' },
  { re: /^qwen2\.5:14b(?:$|[-_])/i, rank: 86, label: 'Large alternate' },
  { re: /^qwen3:1\.7b(?:$|[-_])/i, rank: 76, label: 'Small alternate' },
  { re: /^gemma2:9b(?:$|[-_])/i, rank: 82, label: 'Good alternate' },
  { re: /^gemma3:4b(?:$|[-_])/i, rank: 80, label: 'Good alternate' },
  { re: /^llama3\.1:8b-instruct/i, rank: 78, label: 'Good alternate' },
  { re: /^llama3\.1:8b(?:$|[-_])/i, rank: 74, label: 'Usable' },
  { re: /^mistral:7b(?:$|[-_])/i, rank: 70, label: 'Usable' },
  { re: /^qwen3\.5:0\.8b(?:$|[-_])/i, rank: 62, label: 'Tiny safe fallback' },
  { re: /^gemma2:2b(?:$|[-_])/i, rank: 45, label: 'Small fallback' },
];

export function isExcludedOllamaWritingModel(model: string): boolean {
  return EXCLUDED_MODEL_RE.test(model) || UNSUPPORTED_WRITING_MODEL_RE.test(model);
}

export function scoreOllamaWritingModel(model: string): OllamaModelChoice {
  if (isExcludedOllamaWritingModel(model)) {
    return {
      model,
      rank: -1,
      excluded: true,
      reason:
        'Code, embedding, vision, math, safety, and weak thinking models are hidden from writing correction.',
    };
  }

  const normalized = model.toLowerCase();
  const hit = WRITING_RANKS.find((entry) => entry.re.test(normalized));
  if (hit) return { model, rank: hit.rank, label: hit.label };

  return { model, rank: 10, label: 'Installed' };
}

export function visibleOllamaWritingModels(models: string[]): string[] {
  return [...models]
    .map(scoreOllamaWritingModel)
    .filter((choice) => !choice.excluded)
    .sort((a, b) => b.rank - a.rank || a.model.localeCompare(b.model))
    .map((choice) => choice.model);
}

export function hiddenOllamaWritingModels(models: string[]): string[] {
  return models.filter(isExcludedOllamaWritingModel).sort((a, b) => a.localeCompare(b));
}

export function pickRecommendedOllamaWritingModel(models: string[]): string | null {
  return visibleOllamaWritingModels(models)[0] || null;
}

export function ollamaWritingModelLabel(model: string, recommended?: string | null): string {
  if (recommended && model === recommended) return 'Recommended';
  return scoreOllamaWritingModel(model).label || '';
}
