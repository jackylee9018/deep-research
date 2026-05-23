import { NextResponse } from 'next/server';

import { getLlmEnvStatus } from '@/ai/providers';

import { resolveAppDisplayName } from '../../lib/app-brand';
import { getPptJobsBaseDir, isPptOutputDirConfigured } from '@/ppt/jobs';

export const runtime = 'nodejs';

const DEFAULT_OPENWEBUI_URL = 'https://ai.spit.hk';
const DEFAULT_PRESENTATION_AI_URL = 'http://localhost:9081';

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function GET() {
  const openWebUIUrl = normalizeOrigin(
    process.env.OPENWEBUI_URL ??
      process.env.NEXT_PUBLIC_OPENWEBUI_URL ??
      DEFAULT_OPENWEBUI_URL,
  );

  const presentationAiUrl = normalizeOrigin(
    process.env.PRESENTATION_AI_URL ??
      process.env.NEXT_PUBLIC_PRESENTATION_AI_URL ??
      DEFAULT_PRESENTATION_AI_URL,
  );

  const llm = getLlmEnvStatus();

  return NextResponse.json({
    openWebUIUrl,
    presentationAiUrl,
    appName: resolveAppDisplayName(),
    webSearchAvailable: Boolean(process.env.TAVILY_API_KEY?.trim()),
    llmConfigured: llm.configured,
    llmProvider: llm.provider,
    llmModelId: llm.modelId,
    pptOutputDir: isPptOutputDirConfigured() ? getPptJobsBaseDir() : null,
    meetingWorkerUrl: process.env.WHISPERX_WORKER_URL?.trim() || 'http://127.0.0.1:8091',
  });
}
