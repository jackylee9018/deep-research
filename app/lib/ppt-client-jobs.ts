import type { OutlineDeck, ValidationIssue } from './ppt-types';

import type { PromptAttachment } from './prompt-attachments';
import type { ResearchModelId } from './research-models';

export type PptJobPhase =
  | 'idle'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'done'
  | 'failed';

export type PptJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type PptJob = {
  id: string;
  prompt: string;
  outlineTitle: string;
  outline: OutlineDeck;
  model: ResearchModelId;
  attachments?: PromptAttachment[];
  status: PptJobStatus;
  phase: PptJobPhase;
  attempt: number;
  maxAttempts: number;
  logs: string[];
  issues: ValidationIssue[];
  downloadUrl?: string;
  slideCount?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

const JOBS_KEY = 'deep-research:ppt-jobs';

export function loadPersistedPptJobs(): PptJob[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as PptJob[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(job => ({
      ...job,
      status:
        job.status === 'running' || job.status === 'pending'
          ? 'failed'
          : job.status,
      phase:
        job.status === 'running' || job.status === 'pending'
          ? 'failed'
          : job.phase,
      error:
        job.status === 'running' || job.status === 'pending'
          ? (job.error ?? '頁面重新載入，任務已中斷')
          : job.error,
      logs: job.logs ?? [],
      issues: job.issues ?? [],
      attempt: job.attempt ?? 0,
      maxAttempts: job.maxAttempts ?? 3,
    }));
  } catch {
    return [];
  }
}

export function persistPptJobs(jobs: PptJob[]) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

export function createPptJob(input: {
  prompt: string;
  outline: OutlineDeck;
  model: ResearchModelId;
  attachments?: PromptAttachment[];
}): PptJob {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    prompt: input.prompt,
    outlineTitle: input.outline.title.trim() || '未命名簡報',
    outline: input.outline,
    model: input.model,
    attachments: input.attachments,
    status: 'pending',
    phase: 'idle',
    attempt: 0,
    maxAttempts: 3,
    logs: ['已確認大綱，啟動 LangGraph...'],
    issues: [],
    createdAt: now,
    updatedAt: now,
  };
}
