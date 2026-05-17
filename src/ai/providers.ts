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

// Providers (OpenRouter via OPENROUTER_API_KEY or OPENAI_KEY + OPENAI_ENDPOINT)
const llmApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_KEY;
const llmBaseURL =
  process.env.OPENAI_ENDPOINT ||
  (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
const llmModelId = process.env.CUSTOM_MODEL || process.env.OPENROUTER_MODEL;

export function isOpenRouter(): boolean {
  return llmBaseURL.includes('openrouter.ai') || Boolean(process.env.OPENROUTER_API_KEY);
}

const useStructuredOutputs =
  process.env.STRUCTURED_OUTPUTS === 'true' ||
  (!isOpenRouter() && process.env.STRUCTURED_OUTPUTS !== 'false');

const openRouterProviderRouting = isOpenRouter()
  ? getOpenRouterProviderRouting()
  : undefined;

const openai = llmApiKey
  ? createOpenAI({
      apiKey: llmApiKey,
      baseURL: llmBaseURL,
      headers:
        llmBaseURL.includes('openrouter.ai')
          ? {
              'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://github.com/dzhng/deep-research',
              'X-Title': process.env.OPENROUTER_TITLE || 'Open Deep Research',
            }
          : undefined,
      fetch: openRouterProviderRouting
        ? createOpenRouterFetch(openRouterProviderRouting)
        : undefined,
    })
  : undefined;

export { getOpenRouterProviderRouting } from './openrouter-routing';

const fireworks = process.env.FIREWORKS_KEY
  ? createFireworks({
      apiKey: process.env.FIREWORKS_KEY,
    })
  : undefined;

const customModel = llmModelId
  ? openai?.(llmModelId, {
      structuredOutputs: useStructuredOutputs,
    })
  : undefined;

// Models

const o3MiniModel = openai?.('o3-mini', {
  reasoningEffort: 'medium',
  structuredOutputs: true,
});

const deepSeekR1Model = fireworks
  ? wrapLanguageModel({
      model: fireworks(
        'accounts/fireworks/models/deepseek-r1',
      ) as LanguageModelV1,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  : undefined;

export function getModel(): LanguageModelV1 {
  if (customModel) {
    return customModel;
  }

  const model = deepSeekR1Model ?? o3MiniModel;
  if (!model) {
    if (process.env.OPENROUTER_API_KEY && !llmModelId) {
      throw new Error('Set OPENROUTER_MODEL or CUSTOM_MODEL when using OpenRouter');
    }
    throw new Error(
      'No model found. Set OPENROUTER_API_KEY + OPENROUTER_MODEL, or OPENAI_KEY, or FIREWORKS_KEY',
    );
  }

  return model as LanguageModelV1;
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
