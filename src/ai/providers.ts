import { existsSync, readFileSync } from 'fs';
import { createFireworks } from '@ai-sdk/fireworks';
import { createOpenAI } from '@ai-sdk/openai';
import {
  extractReasoningMiddleware,
  LanguageModelV1,
  wrapLanguageModel,
} from 'ai';
import { getEncoding } from 'js-tiktoken';

import {
  createOpenRouterFetch,
  getOpenRouterProviderRouting,
} from './openrouter-routing';
import { RecursiveCharacterTextSplitter } from './text-splitter';

export { getOpenRouterProviderRouting } from './openrouter-routing';

type LlmConfig = {
  llmApiKey: string | undefined;
  llmBaseURL: string;
  llmModelId: string | undefined;
  useStructuredOutputs: boolean;
  routingKey: string;
};

function readLlmConfig(): LlmConfig {
  const llmApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_KEY;
  const llmBaseURL =
    process.env.OPENAI_ENDPOINT ||
    (process.env.OPENROUTER_API_KEY
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.openai.com/v1');
  const llmModelId =
    process.env.CUSTOM_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.OPENROUTER_MODEL;
  const openRouter = llmBaseURL.includes('openrouter.ai') || Boolean(process.env.OPENROUTER_API_KEY);
  const useStructuredOutputs =
    process.env.STRUCTURED_OUTPUTS === 'true' ||
    (!openRouter && process.env.STRUCTURED_OUTPUTS !== 'false');
  const routing = openRouter ? getOpenRouterProviderRouting() : undefined;

  return {
    llmApiKey,
    llmBaseURL,
    llmModelId,
    useStructuredOutputs,
    routingKey: JSON.stringify(routing ?? null),
  };
}

function configCacheKey(config: LlmConfig): string {
  return [
    config.llmApiKey,
    config.llmBaseURL,
    config.llmModelId,
    config.useStructuredOutputs,
    config.routingKey,
    process.env.FIREWORKS_KEY,
    process.env.OPENROUTER_REFERER,
    process.env.OPENROUTER_TITLE,
  ].join('\0');
}

let modelCache: { key: string; model: LanguageModelV1 } | undefined;

export function isOpenRouter(): boolean {
  const llmBaseURL =
    process.env.OPENAI_ENDPOINT ||
    (process.env.OPENROUTER_API_KEY
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.openai.com/v1');
  return llmBaseURL.includes('openrouter.ai') || Boolean(process.env.OPENROUTER_API_KEY);
}

export type ModelEnvSource =
  | 'CUSTOM_MODEL'
  | 'OPENAI_MODEL'
  | 'OPENROUTER_MODEL'
  | 'FIREWORKS_KEY'
  | 'default';

export function getModelEnvSource(): ModelEnvSource {
  if (process.env.CUSTOM_MODEL?.trim()) {
    return 'CUSTOM_MODEL';
  }
  if (process.env.OPENAI_MODEL?.trim()) {
    return 'OPENAI_MODEL';
  }
  if (process.env.OPENROUTER_MODEL?.trim()) {
    return 'OPENROUTER_MODEL';
  }
  if (process.env.FIREWORKS_KEY?.trim()) {
    return 'FIREWORKS_KEY';
  }
  return 'default';
}

/** Model id from current process.env (not the SDK wrapper's modelId). */
export function getConfiguredModelId(): string {
  const { llmModelId } = readLlmConfig();
  if (llmModelId) {
    return llmModelId;
  }
  if (process.env.FIREWORKS_KEY?.trim()) {
    return 'accounts/fireworks/models/deepseek-r1';
  }
  return 'o3-mini';
}

function readOpenRouterModelFromFile(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const match = trimmed.match(
        /^(?:export\s+)?(?:OPENROUTER_MODEL|CUSTOM_MODEL|OPENAI_MODEL)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^#\s]+))/,
      );
      if (match) {
        return (match[1] ?? match[2] ?? match[3])?.trim();
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function logModelConfiguration(): void {
  const source = getModelEnvSource();
  const modelId = getConfiguredModelId();
  console.log(`Using model: ${modelId} (${source})`);

  const envFileModel = readOpenRouterModelFromFile('.env');
  const envLocalModel = readOpenRouterModelFromFile('.env.local');
  if (envFileModel && envLocalModel && envFileModel !== envLocalModel) {
    console.warn(
      `⚠ .env 的模型為「${envFileModel}」，但 .env.local 覆寫為「${envLocalModel}」。` +
        ` npm start / dev:web 會以 .env.local 為準；請改 .env.local 或刪除其中的 OPENROUTER_MODEL。`,
    );
  }

  if (isOpenRouter()) {
    const routing = getOpenRouterProviderRouting();
    if (routing?.order?.length) {
      console.log(`OpenRouter provider: ${routing.order.join(' → ')}`);
    }
    if (routing?.quantizations?.length) {
      console.log(`OpenRouter quantizations: ${routing.quantizations.join(', ')}`);
    }
  }
}

function buildModel(config: LlmConfig): LanguageModelV1 {
  const { llmApiKey, llmBaseURL, llmModelId, useStructuredOutputs } = config;
  const openRouterProviderRouting = isOpenRouter()
    ? getOpenRouterProviderRouting()
    : undefined;

  const openai = llmApiKey
    ? createOpenAI({
        apiKey: llmApiKey,
        baseURL: llmBaseURL,
        headers: llmBaseURL.includes('openrouter.ai')
          ? {
              'HTTP-Referer':
                process.env.OPENROUTER_REFERER || 'https://github.com/dzhng/deep-research',
              'X-Title': process.env.OPENROUTER_TITLE || 'Open Deep Research',
            }
          : undefined,
        fetch: openRouterProviderRouting
          ? createOpenRouterFetch(openRouterProviderRouting)
          : undefined,
      })
    : undefined;

  if (llmModelId && openai) {
    return openai(llmModelId, {
      structuredOutputs: useStructuredOutputs,
    });
  }

  const fireworks = process.env.FIREWORKS_KEY
    ? createFireworks({ apiKey: process.env.FIREWORKS_KEY })
    : undefined;

  if (fireworks) {
    return wrapLanguageModel({
      model: fireworks('accounts/fireworks/models/deepseek-r1') as LanguageModelV1,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    });
  }

  const o3Mini = openai?.('o3-mini', {
    reasoningEffort: 'medium',
    structuredOutputs: true,
  });

  if (o3Mini) {
    return o3Mini;
  }

  if (process.env.OPENROUTER_API_KEY && !llmModelId) {
    throw new Error('Set OPENROUTER_MODEL or CUSTOM_MODEL when using OpenRouter');
  }

  throw new Error(
    'No model found. Set OPENROUTER_API_KEY + OPENROUTER_MODEL, or OPENAI_KEY, or FIREWORKS_KEY',
  );
}

export function getModel(): LanguageModelV1 {
  const config = readLlmConfig();
  const key = configCacheKey(config);

  if (modelCache?.key === key) {
    return modelCache.model;
  }

  const model = buildModel(config);
  modelCache = { key, model };
  return model;
}

const MinChunkSize = 140;
const encoder = getEncoding('o200k_base');

// trim prompt to maximum context size
export function trimPrompt(
  prompt: string,
  contextSize = Number(process.env.CONTEXT_SIZE) || 128_000,
) {
  if (!prompt) {
    return '';
  }

  const length = encoder.encode(prompt).length;
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // on average it's 3 characters per token, so multiply by 3 to get a rough estimate of the number of characters
  const chunkSize = prompt.length - overflowTokens * 3;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? '';

  // last catch, there's a chance that the trimmed prompt is same length as the original prompt, due to how tokens are split & innerworkings of the splitter, handle this case by just doing a hard cut
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // recursively trim until the prompt is within the context size
  return trimPrompt(trimmedPrompt, contextSize);
}
