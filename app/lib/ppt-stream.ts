import { processDataStream, type JSONValue } from 'ai';

import type { OutlineDeck, ValidationIssue } from './ppt-types';

import type { PromptAttachment } from './prompt-attachments';
import type { ResearchModelId } from './research-models';

export type PptStreamDataPart =
  | {
      type: 'phase';
      phase: 'planning' | 'generating' | 'validating' | 'done' | 'failed';
    }
  | { type: 'attempt'; n: number; max: number }
  | { type: 'issues'; items: ValidationIssue[] }
  | { type: 'log'; message: string }
  | { type: 'complete'; downloadUrl: string; slideCount: number };

export type PptStreamCallbacks = {
  onData: (data: PptStreamDataPart) => void;
  onError: (message: string) => void;
};

function isPptStreamDataPart(value: JSONValue): value is PptStreamDataPart {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'type' in value,
  );
}

function* eachPptStreamDataPart(
  value: JSONValue,
): Generator<PptStreamDataPart> {
  const candidates = Array.isArray(value) ? value : [value];
  for (const item of candidates) {
    if (isPptStreamDataPart(item)) {
      yield item;
    }
  }
}

function isDataStreamResponse(response: Response): boolean {
  const type = response.headers.get('content-type') ?? '';
  return (
    type.includes('text/plain') ||
    type.includes('text/event-stream') ||
    type.includes('application/octet-stream')
  );
}

export async function runPptGenerationStream(
  body: {
    prompt: string;
    outline: OutlineDeck;
    model: ResearchModelId;
    attachments?: PromptAttachment[];
  },
  callbacks: PptStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch('/api/ppt/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (response.ok || response.status !== 404 || attempt === 1) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  if (!response) {
    callbacks.onError('PPT generation failed: no response');
    return;
  }

  if (!response.ok) {
    let message = `PPT 生成失敗（HTTP ${response.status}）`;
    try {
      const json = (await response.json()) as {
        message?: string;
        error?: string;
      };
      message = json.message ?? json.error ?? message;
    } catch {
      if (response.status === 404) {
        message =
          'PPT 生成 API 暫時無法使用，請重新整理頁面後再試一次。';
      }
    }
    callbacks.onError(message);
    return;
  }

  if (!isDataStreamResponse(response)) {
    callbacks.onError('伺服器回傳格式錯誤，請重新整理頁面後再試。');
    return;
  }

  if (!response.body) {
    callbacks.onError('Empty response body');
    return;
  }

  try {
    await processDataStream({
      stream: response.body,
      onDataPart: data => {
        for (const part of eachPptStreamDataPart(data)) {
          callbacks.onData(part);
        }
      },
      onErrorPart: error => {
        callbacks.onError(error);
      },
    });
  } catch (error) {
    callbacks.onError(
      error instanceof Error
        ? error.message
        : 'PPT 串流解析失敗，請重新整理頁面後再試。',
    );
  }
}
