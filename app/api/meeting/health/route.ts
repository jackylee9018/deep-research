import { getLlmEnvStatus } from '@/ai/providers';
import { getWhisperxWorkerUrl } from '@/meeting/config';
import { checkWhisperxWorkerHealth } from '@/meeting/whisperx-client';

export const runtime = 'nodejs';

export async function GET() {
  const llm = getLlmEnvStatus();
  const workerOk = await checkWhisperxWorkerHealth();

  return Response.json({
    llmConfigured: llm.configured,
    llmModelId: llm.modelId,
    whisperxWorkerUrl: getWhisperxWorkerUrl(),
    whisperxWorkerOk: workerOk,
    ready: llm.configured && workerOk,
  });
}
