import { getConfiguredModelId, getModelEnvSource, isOpenRouter } from '@/ai/providers';
import { getOpenRouterProviderRouting } from '@/ai/openrouter-routing';

export const runtime = 'nodejs';

export async function GET() {
  const routing = isOpenRouter() ? getOpenRouterProviderRouting() : undefined;

  return Response.json({
    model: getConfiguredModelId(),
    source: getModelEnvSource(),
    openRouter: isOpenRouter(),
    providers: routing?.order,
    quantizations: routing?.quantizations,
  });
}
