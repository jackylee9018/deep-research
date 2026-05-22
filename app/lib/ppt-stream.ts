import { processDataStream, type JSONValue } from 'ai';

import { pptPreviewPath } from './ppt-job-id';
import type { OutlineDeck, ValidationIssue } from './ppt-types';

import type { PromptAttachment } from './prompt-attachments';
import type { ResearchModelId } from './research-models';

export type PptStreamDataPart =
  | {
      type: 'phase';
      phase: 'planning' | 'generating' | 'validating' | 'done' | 'failed';
    }
  | { type: 'job'; jobId: string }
  | { type: 'attempt'; n: number; max: number }
  | { type: 'issues'; items: ValidationIssue[] }
  | { type: 'log'; message: string }
  | {
      type: 'slideReady';
      jobId: string;
      readyCount: number;
      total: number;
    }
  | {
      type: 'previewReady';
      jobId: string;
      previewUrl: string;
      slideCount: number;
    };

export type PptPreviewReady = {
  jobId: string;
  previewUrl: string;
  slideCount: number;
};

export type PptStreamResult =
  | { ok: true; preview: PptPreviewReady }
  | { ok: false; error: string; serverJobId?: string };

export type PptStreamCallbacks = {
  onData: (data: PptStreamDataPart) => void;
  onError: (message: string) => void;
};

function isPptStreamDataPart(value: JSONValue): value is PptStreamDataPart {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('type' in value)) {
    return false;
  }
  const t = (value as { type: unknown }).type;
  if (t === 'phase') {
    return typeof (value as { phase?: unknown }).phase === 'string';
  }
  if (t === 'job') {
    return typeof (value as { jobId?: unknown }).jobId === 'string';
  }
  if (t === 'attempt') {
    return (
      typeof (value as { n?: unknown }).n === 'number' &&
      typeof (value as { max?: unknown }).max === 'number'
    );
  }
  if (t === 'issues') {
    return Array.isArray((value as { items?: unknown }).items);
  }
  if (t === 'log') {
    return typeof (value as { message?: unknown }).message === 'string';
  }
  if (t === 'slideReady') {
    return (
      typeof (value as { jobId?: unknown }).jobId === 'string' &&
      typeof (value as { readyCount?: unknown }).readyCount === 'number' &&
      typeof (value as { total?: unknown }).total === 'number'
    );
  }
  if (t === 'previewReady') {
    return (
      typeof (value as { jobId?: unknown }).jobId === 'string' &&
      typeof (value as { previewUrl?: unknown }).previewUrl === 'string' &&
      typeof (value as { slideCount?: unknown }).slideCount === 'number'
    );
  }
  return false;
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

function isBenignStreamCloseError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('terminated') ||
    msg.includes('aborted') ||
    msg.includes('closed') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('incomplete')
  );
}

/** If the stream dropped after the server finished, recover via preview API. */
export async function recoverPptPreviewFromServer(
  serverJobId: string,
): Promise<PptPreviewReady | null> {
  try {
    const res = await fetch(
      `/api/ppt/preview?jobId=${encodeURIComponent(serverJobId)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      jobId?: string;
      slideCount?: number;
    };
    return {
      jobId: data.jobId ?? serverJobId,
      previewUrl: pptPreviewPath(serverJobId),
      slideCount: data.slideCount ?? 0,
    };
  } catch {
    return null;
  }
}

export async function runPptGenerationStream(
  body: {
    prompt: string;
    outline: OutlineDeck;
    model: ResearchModelId;
    attachments?: PromptAttachment[];
    templateId?: string;
  },
  callbacks: PptStreamCallbacks,
  signal?: AbortSignal,
): Promise<PptStreamResult> {
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
    const error = 'PPT generation failed: no response';
    callbacks.onError(error);
    return { ok: false, error };
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
    return { ok: false, error: message };
  }

  if (!isDataStreamResponse(response)) {
    const error = '伺服器回傳格式錯誤，請重新整理頁面後再試。';
    callbacks.onError(error);
    return { ok: false, error };
  }

  if (!response.body) {
    const error = 'Empty response body';
    callbacks.onError(error);
    return { ok: false, error };
  }

  let previewReady: PptPreviewReady | null = null;
  let serverJobId: string | undefined;
  let streamError: string | undefined;

  try {
    await processDataStream({
      stream: response.body,
      onDataPart: data => {
        for (const part of eachPptStreamDataPart(data)) {
          if (part.type === 'job') {
            serverJobId = part.jobId;
          }
          if (part.type === 'previewReady') {
            previewReady = {
              jobId: part.jobId,
              previewUrl: part.previewUrl,
              slideCount: part.slideCount,
            };
            serverJobId = part.jobId;
          }
          callbacks.onData(part);
        }
      },
      onErrorPart: error => {
        if (previewReady) {
          return;
        }
        streamError = error;
        callbacks.onError(error);
      },
    });
  } catch (error) {
    if (!previewReady && !isBenignStreamCloseError(error)) {
      const message =
        error instanceof Error
          ? error.message
          : 'PPT 串流解析失敗，請重新整理頁面後再試。';
      streamError = message;
      callbacks.onError(message);
    }
  }

  if (previewReady) {
    return { ok: true, preview: previewReady };
  }

  const recoverId = serverJobId;
  if (recoverId) {
    const recovered = await recoverPptPreviewFromServer(recoverId);
    if (recovered) {
      callbacks.onData({
        type: 'previewReady',
        jobId: recovered.jobId,
        previewUrl: recovered.previewUrl,
        slideCount: recovered.slideCount,
      });
      return { ok: true, preview: recovered };
    }
  }

  const error =
    streamError ??
    '連線中斷，未能收到完成訊號。若終端機顯示「內容就緒」，請到預覽頁或重新整理後再試。';
  if (!streamError) {
    callbacks.onError(error);
  }
  return { ok: false, error, serverJobId: recoverId };
}
