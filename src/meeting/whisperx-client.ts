import { meetingTranscriptSchema, type MeetingTranscript } from './schemas/transcript';
import {
  getMeetingPollIntervalMs,
  getMeetingPollTimeoutMs,
  getWhisperxWorkerUrl,
} from './config';

export type WhisperxJobStatus = {
  jobId: string;
  status: string;
  phase?: string;
  detail?: string;
  error?: string;
  fileName?: string;
};

export type TranscribeOptions = {
  language?: string;
  minSpeakers?: number;
  maxSpeakers?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function checkWhisperxWorkerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getWhisperxWorkerUrl()}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function submitTranscription(
  file: Blob,
  fileName: string,
  options: TranscribeOptions,
): Promise<string> {
  const form = new FormData();
  form.append('file', file, fileName);

  const params = new URLSearchParams();
  if (options.language) {
    params.set('language', options.language);
  }
  if (options.minSpeakers != null) {
    params.set('min_speakers', String(options.minSpeakers));
  }
  if (options.maxSpeakers != null) {
    params.set('max_speakers', String(options.maxSpeakers));
  }

  const url = `${getWhisperxWorkerUrl()}/transcribe?${params.toString()}`;
  const res = await fetch(url, { method: 'POST', body: form });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `WhisperX worker rejected upload (${res.status}): ${body.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as { jobId?: string };
  if (!json.jobId) {
    throw new Error('WhisperX worker did not return jobId');
  }
  return json.jobId;
}

export async function getWhisperxJobStatus(
  workerJobId: string,
): Promise<WhisperxJobStatus> {
  const res = await fetch(
    `${getWhisperxWorkerUrl()}/jobs/${encodeURIComponent(workerJobId)}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch job status (${res.status})`);
  }
  return (await res.json()) as WhisperxJobStatus;
}

export async function waitForTranscription(
  workerJobId: string,
  onProgress?: (status: WhisperxJobStatus) => void,
): Promise<MeetingTranscript> {
  const started = Date.now();
  const interval = getMeetingPollIntervalMs();
  const timeout = getMeetingPollTimeoutMs();

  while (Date.now() - started < timeout) {
    const status = await getWhisperxJobStatus(workerJobId);
    onProgress?.(status);

    if (status.status === 'done') {
      const res = await fetch(
        `${getWhisperxWorkerUrl()}/jobs/${encodeURIComponent(workerJobId)}/result`,
        { signal: AbortSignal.timeout(120_000) },
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch transcript (${res.status})`);
      }
      const json = await res.json();
      return meetingTranscriptSchema.parse(json);
    }

    if (status.status === 'failed') {
      throw new Error(status.error ?? 'Transcription failed');
    }

    await sleep(interval);
  }

  throw new Error('Transcription timed out');
}
