import {
  generateObject as aiGenerateObject,
  generateText,
  type GenerateObjectResult,
  type LanguageModel,
} from 'ai';
import type { z } from 'zod';

import { getModel, isOpenRouter } from './providers';

export type GenerateObjectOptions<T extends z.ZodTypeAny> = {
  model?: LanguageModel;
  system?: string;
  prompt?: string;
  schema: T;
  temperature?: number;
  abortSignal?: AbortSignal;
};

function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Empty model response');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error('Could not parse JSON from model response');
  }
}

function isJsonParseError(error: unknown): boolean {
  return (
    error != null &&
    typeof error === 'object' &&
    (String((error as { name?: string }).name).includes('JSONParse') ||
      String((error as { message?: string }).message).includes('JSON'))
  );
}

export async function generateObject<T extends z.ZodTypeAny>(
  options: GenerateObjectOptions<T>,
): Promise<GenerateObjectResult<z.infer<T>>> {
  const model = options.model ?? getModel();
  const base = {
    model,
    system: options.system,
    prompt: options.prompt,
    schema: options.schema,
    temperature: options.temperature,
    abortSignal: options.abortSignal,
  };

  if (!isOpenRouter()) {
    return aiGenerateObject(base);
  }

  for (const mode of ['tool', 'json'] as const) {
    try {
      return await aiGenerateObject({ ...base, mode });
    } catch (error) {
      if (!isJsonParseError(error)) {
        throw error;
      }
    }
  }

  const textResult = await generateText({
    model,
    system: options.system,
    prompt: `${options.prompt}\n\nReturn only a single valid JSON object. No markdown, no explanation.`,
    temperature: options.temperature,
    abortSignal: options.abortSignal,
  });

  return {
    object: options.schema.parse(parseJsonFromText(textResult.text)),
    finishReason: textResult.finishReason,
    usage: textResult.usage,
    warnings: textResult.warnings,
    request: textResult.request,
    response: textResult.response,
    logprobs: textResult.logprobs,
    experimental_providerMetadata: textResult.experimental_providerMetadata,
    toJsonResponse: () => {
      throw new Error('toJsonResponse is not available for fallback parsing');
    },
  } as GenerateObjectResult<z.infer<T>>;
}
