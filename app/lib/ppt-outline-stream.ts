import { processDataStream, type JSONValue } from 'ai';

import type { PptPageTextPreset } from './ppt-page-text';
import type { PptTemplateId } from './ppt-templates';
import type { OutlineDeck } from './ppt-types';
import type { PromptAttachment } from './prompt-attachments';
import type { ResearchModelId } from './research-models';

export type PptOutlineStreamDataPart =
  | { type: 'status'; message: string }
  | { type: 'outline'; outline: OutlineDeck };

export type PptOutlineStreamCallbacks = {
  onStatus?: (message: string) => void;
  onText: (text: string) => void;
  onOutline?: (outline: OutlineDeck) => void;
  onError: (message: string) => void;
};

function isOutlineStreamDataPart(
  value: JSONValue,
): value is PptOutlineStreamDataPart {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'type' in value &&
      (value.type === 'status' || value.type === 'outline'),
  );
}

function* eachOutlineStreamDataPart(
  value: JSONValue,
): Generator<PptOutlineStreamDataPart> {
  const candidates = Array.isArray(value) ? value : [value];
  for (const item of candidates) {
    if (isOutlineStreamDataPart(item)) {
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

export async function runPptOutlineStream(
  body: {
    prompt: string;
    pageTextPreset: PptPageTextPreset;
    templateId?: PptTemplateId;
    model: ResearchModelId;
    attachments?: PromptAttachment[];
    webSearch?: boolean;
  },
  callbacks: PptOutlineStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/ppt/outline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let message = `產生大綱失敗（HTTP ${response.status}）`;
    try {
      const json = (await response.json()) as {
        message?: string;
        error?: string;
      };
      message = json.message ?? json.error ?? message;
    } catch {
      // ignore
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

  let accumulatedText = '';

  try {
    await processDataStream({
      stream: response.body,
      onTextPart: text => {
        accumulatedText += text;
        callbacks.onText(accumulatedText);
      },
      onDataPart: data => {
        for (const part of eachOutlineStreamDataPart(data)) {
          if (part.type === 'status') {
            callbacks.onStatus?.(part.message);
          } else if (part.type === 'outline') {
            callbacks.onOutline?.(part.outline);
          }
        }
      },
      onErrorPart: error => {
        callbacks.onError(error);
      },
    });
  } catch (error) {
    if (signal?.aborted) {
      return;
    }
    callbacks.onError(
      error instanceof Error
        ? error.message
        : '大綱串流解析失敗，請重新整理頁面後再試。',
    );
  }
}
