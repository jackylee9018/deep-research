import type { JSONValue } from 'ai';

import type { MeetingMinutes } from '@/meeting/schemas/minutes';
import type { MeetingTranscript } from '@/meeting/schemas/transcript';

import {
  extractServerJobIdFromJobData,
  jobHasDisplayableContent,
  meetingJobForPersistence,
  resolveJobMarkdown,
} from './meeting-job-content';
import { extractWorkerJobIdFromJobData } from './meeting-worker-progress';

export type MeetingJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export type MeetingJob = {
  id: string;
  fileName: string;
  language: string;
  detailLevel: 'brief' | 'full';
  includeAppendix: boolean;
  status: MeetingJobStatus;
  createdAt: number;
  updatedAt: number;
  data: JSONValue[];
  serverJobId?: string;
  /** WhisperX worker job id (transcription queue on :8091). */
  workerJobId?: string;
  markdown: string;
  editedMarkdown?: string;
  speakerAliases?: Record<string, string>;
  minutes?: MeetingMinutes;
  transcript?: MeetingTranscript;
  error?: string;
};

const JOBS_KEY = 'deep-research:meeting-jobs';

export function loadPersistedMeetingJobs(): MeetingJob[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as MeetingJob[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(job => {
      const normalized: MeetingJob = {
        ...job,
        status:
          job.status === 'running' || job.status === 'pending'
            ? 'failed'
            : job.status,
        error:
          job.status === 'running' || job.status === 'pending'
            ? (job.error ?? '頁面重新載入，任務已中斷')
            : job.error,
        data: job.data ?? [],
        markdown: job.markdown ?? '',
        editedMarkdown: job.editedMarkdown ?? undefined,
        speakerAliases:
          job.speakerAliases &&
          typeof job.speakerAliases === 'object' &&
          !Array.isArray(job.speakerAliases)
            ? job.speakerAliases
            : undefined,
        serverJobId:
          job.serverJobId ?? extractServerJobIdFromJobData(job.data ?? []),
        workerJobId:
          job.workerJobId ?? extractWorkerJobIdFromJobData(job.data ?? []),
      };
      const markdown = resolveJobMarkdown(normalized);
      return {
        ...normalized,
        markdown,
        error: jobHasDisplayableContent({ ...normalized, markdown })
          ? undefined
          : normalized.error,
      };
    });
  } catch {
    return [];
  }
}

export function persistMeetingJobs(jobs: MeetingJob[]) {
  try {
    const slim = jobs.map(meetingJobForPersistence);
    localStorage.setItem(JOBS_KEY, JSON.stringify(slim));
  } catch {
    // localStorage quota — skip persist rather than breaking UI
  }
}

export function createMeetingJob(input: {
  fileName: string;
  language: string;
  detailLevel: 'brief' | 'full';
  includeAppendix: boolean;
}): MeetingJob {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    fileName: input.fileName,
    language: input.language,
    detailLevel: input.detailLevel,
    includeAppendix: input.includeAppendix,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    data: [],
    markdown: '',
  };
}
