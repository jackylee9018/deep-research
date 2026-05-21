export const RESEARCH_MODELS = [
  'google/gemma-4-31b-it',
  'openai/gpt-oss-120b',
] as const;

export type ResearchModelId = (typeof RESEARCH_MODELS)[number];

export const DEFAULT_RESEARCH_MODEL: ResearchModelId = 'google/gemma-4-31b-it';

export const RESEARCH_MODEL_LABELS: Record<ResearchModelId, string> = {
  'google/gemma-4-31b-it': 'Gemma 4 31B',
  'openai/gpt-oss-120b': 'GPT-OSS 120B',
};

const MODEL_STORAGE_KEY = 'deep-research:selected-model';

export function isResearchModelId(
  value: string | undefined,
): value is ResearchModelId {
  return RESEARCH_MODELS.includes(value as ResearchModelId);
}

export function loadSelectedModel(): ResearchModelId {
  if (typeof window === 'undefined') {
    return DEFAULT_RESEARCH_MODEL;
  }
  const stored = localStorage.getItem(MODEL_STORAGE_KEY);
  return isResearchModelId(stored ?? undefined)
    ? (stored as ResearchModelId)
    : DEFAULT_RESEARCH_MODEL;
}

export function saveSelectedModel(model: ResearchModelId) {
  localStorage.setItem(MODEL_STORAGE_KEY, model);
}
