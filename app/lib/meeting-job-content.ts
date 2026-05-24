import type { JSONValue } from 'ai';

import type { MeetingMinutes } from '@/meeting/schemas/minutes';
import type {
  MeetingTranscript,
  MeetingUtterance,
} from '@/meeting/schemas/transcript';
import {
  renderMeetingMinutesMarkdown,
} from '@/meeting/render-minutes-md';

import type { MeetingJob } from './meeting-jobs';

function isRecord(value: JSONValue): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractMarkdownFromJobData(data: JSONValue[]): string {
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const part = data[i];
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'markdown' &&
      typeof part.content === 'string'
    ) {
      return part.content;
    }
  }
  return '';
}

export function extractServerJobIdFromJobData(data: JSONValue[]): string | undefined {
  for (const part of data) {
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'job' &&
      typeof part.jobId === 'string'
    ) {
      return part.jobId;
    }
  }
  return undefined;
}

export function extractMinutesFromJobData(data: JSONValue[]): MeetingMinutes | undefined {
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const part = data[i];
    const minutes = part !== undefined && isRecord(part) ? part.minutes : undefined;
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'minutes' &&
      minutes !== undefined &&
      isRecord(minutes)
    ) {
      return minutes as unknown as MeetingMinutes;
    }
  }
  return undefined;
}

export function extractTranscriptFromJobData(
  data: JSONValue[],
): MeetingTranscript | undefined {
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const part = data[i];
    const transcript =
      part !== undefined && isRecord(part) ? part.transcript : undefined;
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'transcript' &&
      transcript !== undefined &&
      isRecord(transcript)
    ) {
      return transcript as unknown as MeetingTranscript;
    }
  }
  return undefined;
}

export function resolveJobMarkdown(job: MeetingJob): string {
  if (job.markdown.trim()) {
    return job.markdown;
  }
  const fromData = extractMarkdownFromJobData(job.data);
  if (fromData.trim()) {
    return fromData;
  }
  const minutes = resolveJobMinutes(job);
  if (minutes) {
    const transcript = resolveJobTranscript(job);
    return renderMeetingMinutesMarkdown(minutes, transcript, {
      includeAppendix: Boolean(transcript?.utterances.length),
    });
  }
  return '';
}

export function resolveJobTranscript(job: MeetingJob): MeetingTranscript | undefined {
  return job.transcript ?? extractTranscriptFromJobData(job.data);
}

export function resolveJobMinutes(job: MeetingJob): MeetingMinutes | undefined {
  return job.minutes ?? extractMinutesFromJobData(job.data);
}

export function mergeTranscriptChunk(
  existing: MeetingTranscript | undefined,
  meta: MeetingTranscript['meta'],
  speakers: string[],
  utterances: MeetingUtterance[],
): MeetingTranscript {
  if (!existing) {
    return { meta, speakers, utterances: [...utterances] };
  }
  return {
    meta: existing.meta.durationSec ? existing.meta : meta,
    speakers: speakers.length ? speakers : existing.speakers,
    utterances: [...existing.utterances, ...utterances],
  };
}

export function latestStreamDetail(job: MeetingJob): string {
  for (let i = job.data.length - 1; i >= 0; i -= 1) {
    const part = job.data[i];
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'punctuateProgress' &&
      typeof part.batchIndex === 'number' &&
      typeof part.batchCount === 'number'
    ) {
      return `標點還原 ${part.batchIndex}/${part.batchCount}`;
    }
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'step' &&
      part.step === 'punctuation' &&
      typeof part.detail === 'string' &&
      part.detail.trim()
    ) {
      return part.detail;
    }
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'summarizeProgress' &&
      typeof part.chunkIndex === 'number' &&
      typeof part.chunkCount === 'number'
    ) {
      return `整理第 ${part.chunkIndex}/${part.chunkCount} 段`;
    }
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'step' &&
      part.step === 'minutes' &&
      typeof part.detail === 'string' &&
      part.detail.trim()
    ) {
      return part.detail;
    }
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'transcribe' &&
      typeof part.detail === 'string' &&
      part.detail.trim()
    ) {
      return part.detail;
    }
  }
  return '';
}

export function jobHasDisplayableContent(job: MeetingJob): boolean {
  return Boolean(
    resolveJobMarkdown(job).trim() ||
      resolveJobTranscript(job)?.utterances.length,
  );
}

export function finalizeMeetingJobContent(
  job: Pick<
    MeetingJob,
    'markdown' | 'minutes' | 'transcript' | 'data' | 'serverJobId'
  >,
  incoming: {
    markdown?: string;
    minutes?: MeetingMinutes;
    transcript?: MeetingTranscript;
    serverJobId?: string;
    data?: JSONValue[];
  },
): Pick<MeetingJob, 'markdown' | 'minutes' | 'transcript' | 'serverJobId' | 'data' | 'error'> {
  const merged: MeetingJob = {
    id: 'finalize',
    fileName: '',
    language: 'zh',
    detailLevel: 'full',
    includeAppendix: true,
    restorePunctuation: false,
    status: 'completed',
    createdAt: 0,
    updatedAt: 0,
    markdown: incoming.markdown?.trim() ? incoming.markdown : job.markdown,
    minutes: incoming.minutes ?? job.minutes,
    transcript: incoming.transcript ?? job.transcript,
    serverJobId: incoming.serverJobId ?? job.serverJobId,
    data: incoming.data ?? job.data,
  };

  const markdown = resolveJobMarkdown(merged);
  const hasContent = Boolean(
    markdown.trim() || merged.transcript?.utterances.length,
  );

  return {
    markdown,
    minutes: merged.minutes,
    transcript: merged.transcript,
    serverJobId: merged.serverJobId,
    data: merged.data,
    error: hasContent
      ? undefined
      : merged.serverJobId
        ? '紀要已生成但未能載入內容，請點左側任務重試或重新整理'
        : '紀要已生成但未能載入內容，請重新整理或再試一次',
  };
}

/** Strip heavy stream payloads before localStorage persistence. */
export function meetingJobForPersistence(job: MeetingJob): MeetingJob {
  const markdown = resolveJobMarkdown(job);
  const minutes = resolveJobMinutes(job);
  const serverJobId = job.serverJobId ?? extractServerJobIdFromJobData(job.data);

  const slimData = job.data.filter(part => {
    if (!isRecord(part)) {
      return true;
    }
    return (
      part.type !== 'transcript' &&
      part.type !== 'transcriptChunk' &&
      part.type !== 'transcriptMeta' &&
      part.type !== 'markdown'
    );
  });

  if (markdown.trim()) {
    slimData.push({ type: 'markdown', content: markdown });
  }
  if (minutes) {
    slimData.push({ type: 'minutes', minutes: minutes as unknown as JSONValue });
  }
  if (serverJobId) {
    slimData.push({ type: 'job', jobId: serverJobId });
  }

  return {
    ...job,
    serverJobId: serverJobId ?? undefined,
    markdown,
    minutes,
    transcript: undefined,
    data: slimData,
  };
}
