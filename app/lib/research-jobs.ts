import type { JSONValue, Message } from 'ai';

import type { FollowUpEntry } from '@/research-query';

import type { PromptAttachment } from './prompt-attachments';
import type { ResearchModelId } from './research-models';

export type ResearchJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ResearchJob = {
  id: string;
  query: string;
  breadth: number;
  depth: number;
  mode: 'report' | 'answer';
  model: ResearchModelId;
  followUp?: FollowUpEntry[];
  attachments?: PromptAttachment[];
  status: ResearchJobStatus;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  data: JSONValue[];
  error?: string;
};

const JOBS_KEY = 'deep-research:jobs';

export function loadPersistedJobs(): ResearchJob[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ResearchJob[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(job => ({
      ...job,
      status:
        job.status === 'running' || job.status === 'pending'
          ? 'failed'
          : job.status,
      error:
        job.status === 'running' || job.status === 'pending'
          ? (job.error ?? '頁面重新載入，任務已中斷')
          : job.error,
      messages: job.messages ?? [],
      data: job.data ?? [],
    }));
  } catch {
    return [];
  }
}

export function persistJobs(jobs: ResearchJob[]) {
  const serializable = jobs.map(job => ({
    ...job,
    messages: job.messages,
    data: job.data,
  }));
  localStorage.setItem(JOBS_KEY, JSON.stringify(serializable));
}

export function createResearchJob(input: {
  query: string;
  breadth: number;
  depth: number;
  mode: 'report' | 'answer';
  model: ResearchModelId;
  followUp?: FollowUpEntry[];
  attachments?: PromptAttachment[];
}): ResearchJob {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    ...input,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    messages: [],
    data: [],
  };
}
