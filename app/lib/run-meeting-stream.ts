import { processDataStream, type JSONValue } from 'ai';

import type { MeetingMinutes } from '@/meeting/schemas/minutes';
import type { MeetingTranscript } from '@/meeting/schemas/transcript';

export type MeetingStreamCallbacks = {
  onMarkdown: (markdown: string) => void;
  onData: (data: JSONValue) => void;
  onError: (message: string) => void;
  onMinutes?: (minutes: MeetingMinutes) => void;
  onTranscript?: (transcript: MeetingTranscript) => void;
  onUploadProgress?: (detail: string) => void;
};

async function parseErrorMessage(response: Response): Promise<string> {
  let message = `Meeting request failed (${response.status})`;
  try {
    const json = (await response.json()) as { message?: string; error?: string };
    message = json.message ?? json.error ?? message;
  } catch {
    // ignore
  }
  return message;
}

export async function runMeetingStream(
  body: {
    file: File;
    language: string;
    detailLevel: 'brief' | 'full';
    includeAppendix: boolean;
    restorePunctuation: boolean;
    minSpeakers?: number;
    maxSpeakers?: number;
  },
  callbacks: MeetingStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  callbacks.onUploadProgress?.('正在上傳音訊…');

  const uploadForm = new FormData();
  uploadForm.append('file', body.file);

  const uploadResponse = await fetch('/api/meeting/upload', {
    method: 'POST',
    body: uploadForm,
    signal,
  });

  if (!uploadResponse.ok) {
    callbacks.onError(await parseErrorMessage(uploadResponse));
    return;
  }

  const uploadJson = (await uploadResponse.json()) as {
    jobId?: string;
    fileName?: string;
  };

  if (!uploadJson.jobId) {
    callbacks.onError('上傳成功但未收到 jobId');
    return;
  }

  callbacks.onUploadProgress?.('上傳完成，開始處理…');
  callbacks.onData({ type: 'job', jobId: uploadJson.jobId });
  callbacks.onData({ type: 'phase', phase: 'transcribing' });

  const response = await fetch('/api/meeting/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: uploadJson.jobId,
      language: body.language,
      detailLevel: body.detailLevel,
      includeAppendix: body.includeAppendix,
      restorePunctuation: body.restorePunctuation,
      minSpeakers: body.minSpeakers,
      maxSpeakers: body.maxSpeakers,
    }),
    signal,
  });

  if (!response.ok) {
    callbacks.onError(await parseErrorMessage(response));
    return;
  }

  if (!response.body) {
    callbacks.onError('Empty response body');
    return;
  }

  let markdown = '';

  await processDataStream({
    stream: response.body,
    onTextPart: text => {
      markdown += text;
      callbacks.onMarkdown(markdown);
    },
    onDataPart: data => {
      callbacks.onData(data);
      if (
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        (data as { type?: string }).type === 'markdown'
      ) {
        const content = (data as { content?: string }).content;
        if (content) {
          markdown = content;
          callbacks.onMarkdown(markdown);
        }
      }
      if (
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        (data as { type?: string }).type === 'minutes'
      ) {
        callbacks.onMinutes?.((data as { minutes: MeetingMinutes }).minutes);
      }
      if (
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        (data as { type?: string }).type === 'transcript' &&
        (data as { transcript?: MeetingTranscript }).transcript
      ) {
        callbacks.onTranscript?.(
          (data as { transcript: MeetingTranscript }).transcript,
        );
      }
    },
    onErrorPart: error => {
      callbacks.onError(error);
    },
  });
}
