import { getOpenRouterProviderRouting } from '@/ai/openrouter-routing';
import {
  getConfiguredModelId,
  getModelEnvSource,
  isOpenRouter,
} from '@/ai/providers';
import {
  DEFAULT_RESEARCH_MODEL,
  RESEARCH_MODEL_LABELS,
  RESEARCH_MODELS,
} from '@/ai/research-models';

export const runtime = 'nodejs';

export async function GET() {
  const routing = isOpenRouter() ? getOpenRouterProviderRouting() : undefined;

  return Response.json({
    model: getConfiguredModelId(),
    source: getModelEnvSource(),
    openRouter: isOpenRouter(),
    providers: routing?.order,
    quantizations: routing?.quantizations,
    researchModels: RESEARCH_MODELS.map(id => ({
      id,
      label: RESEARCH_MODEL_LABELS[id],
    })),
    defaultResearchModel: DEFAULT_RESEARCH_MODEL,
  });
}
