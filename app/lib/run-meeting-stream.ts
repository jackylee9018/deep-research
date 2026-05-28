import type { JSONValue } from 'ai';

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

  callbacks.onUploadProgress?.('上傳完成，建立後台任務…');
  callbacks.onData({ type: 'job', jobId: uploadJson.jobId });

  const response = await fetch('/api/meeting/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: uploadJson.jobId,
      language: body.language,
      detailLevel: body.detailLevel,
      includeAppendix: body.includeAppendix,
      minSpeakers: body.minSpeakers,
      maxSpeakers: body.maxSpeakers,
    }),
    signal,
  });

  if (!response.ok) {
    callbacks.onError(await parseErrorMessage(response));
    return;
  }

  callbacks.onData({ type: 'phase', phase: 'queued' });

  const pollIntervalMs = 2000;
  const maxWaitMs = 90 * 60 * 1000;
  const startedAt = Date.now();
  let lastDetail = '';
  let lastPhase = '';
  let lastWorkerJobId = '';

  while (Date.now() - startedAt < maxWaitMs) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const jobRes = await fetch(`/api/meeting/jobs/${encodeURIComponent(uploadJson.jobId)}`, {
      signal,
    });
    if (!jobRes.ok) {
      callbacks.onError(await parseErrorMessage(jobRes));
      return;
    }

    const jobJson = (await jobRes.json()) as {
      status?: string;
      phase?: string;
      detail?: string;
      workerJobId?: string;
      error?: string;
      markdown?: string;
      minutes?: MeetingMinutes;
      transcript?: MeetingTranscript;
    };

    if (jobJson.phase && jobJson.phase !== lastPhase) {
      lastPhase = jobJson.phase;
      callbacks.onData({ type: 'phase', phase: jobJson.phase });
    }
    if (jobJson.detail && jobJson.detail !== lastDetail) {
      lastDetail = jobJson.detail;
      callbacks.onData({
        type: 'transcribe',
        detail: jobJson.detail,
        phase: jobJson.phase ?? 'transcribing',
        status: jobJson.status ?? 'running',
      });
    }
    if (jobJson.workerJobId && jobJson.workerJobId !== lastWorkerJobId) {
      lastWorkerJobId = jobJson.workerJobId;
      callbacks.onData({
        type: 'workerJob',
        workerJobId: jobJson.workerJobId,
      });
    }
    if (jobJson.transcript) {
      callbacks.onTranscript?.(jobJson.transcript);
      callbacks.onData({ type: 'transcript', transcript: jobJson.transcript });
    }
    if (jobJson.minutes) {
      callbacks.onMinutes?.(jobJson.minutes);
      callbacks.onData({ type: 'minutes', minutes: jobJson.minutes });
    }
    if (jobJson.markdown) {
      callbacks.onMarkdown(jobJson.markdown);
      callbacks.onData({ type: 'markdown', content: jobJson.markdown });
    }

    if (jobJson.status === 'failed') {
      callbacks.onError(jobJson.error ?? 'Meeting processing failed');
      return;
    }
    if (jobJson.status === 'completed') {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  callbacks.onError('Meeting processing timeout (90 min)');
}
