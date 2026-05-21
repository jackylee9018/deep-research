export const RESEARCH_MODELS = [
  'google/gemma-4-31b-it',
  'openai/gpt-oss-120b',
] as const;

export type ResearchModelId = (typeof RESEARCH_MODELS)[number];

export const DEFAULT_RESEARCH_MODEL: ResearchModelId = 'google/gemma-4-31b-it';

export function isResearchModelId(
  value: string | undefined,
): value is ResearchModelId {
  return RESEARCH_MODELS.includes(value as ResearchModelId);
}

export function resolveResearchModelId(requested?: string): ResearchModelId {
  if (requested && isResearchModelId(requested)) {
    return requested;
  }
  return DEFAULT_RESEARCH_MODEL;
}

export const RESEARCH_MODEL_LABELS: Record<ResearchModelId, string> = {
  'google/gemma-4-31b-it': 'Gemma 4 31B',
  'openai/gpt-oss-120b': 'GPT-OSS 120B',
};
