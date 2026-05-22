'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { pptPreviewPath } from '../lib/ppt-job-id';
import {
  createPptJob,
  loadPersistedPptJobs,
  persistPptJobs,
  type PptJob,
  type PptJobPhase,
} from '../lib/ppt-client-jobs';
import {
  appendPptHistory,
  loadPptHistory,
  removePptHistory,
  type PptHistoryEntry,
} from '../lib/ppt-history';
import type { OutlineDeck } from '../lib/ppt-types';
import {
  recoverPptPreviewFromServer,
  runPptGenerationStream,
  type PptStreamDataPart,
} from '../lib/ppt-stream';
import type { PromptAttachment } from '../lib/prompt-attachments';
import type { ResearchModelId } from '../lib/research-models';

import type { PptTemplateId } from '../lib/ppt-templates';

type EnqueueInput = {
  prompt: string;
  outline: OutlineDeck;
  model: ResearchModelId;
  attachments?: PromptAttachment[];
  templateId?: PptTemplateId;
};

function migrateCompletedJobsToHistory(jobs: PptJob[]): PptJob[] {
  const history = loadPptHistory();
  const historyIds = new Set(history.map(entry => entry.id));

  for (const job of jobs) {
    if (
      job.status === 'completed' &&
      job.serverJobId &&
      !historyIds.has(job.id)
    ) {
      appendPptHistory({
        id: job.id,
        prompt: job.prompt,
        outlineTitle: job.outlineTitle,
        outline: job.outline,
        model: job.model,
        slideCount: job.slideCount,
        serverJobId: job.serverJobId,
        previewUrl: job.previewUrl ?? pptPreviewPath(job.serverJobId),
        downloadUrl: job.downloadUrl,
        createdAt: job.createdAt,
        completedAt: job.updatedAt,
      });
      historyIds.add(job.id);
    }
  }

  return jobs.filter(job => job.status !== 'completed');
}

type PptJobsContextValue = {
  jobs: PptJob[];
  history: PptHistoryEntry[];
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
  activeJob: PptJob | undefined;
  enqueueJob: (input: EnqueueInput) => string;
  cancelJob: (id: string) => void;
  /** Aborts and removes all pending/running jobs (e.g. before a new outline-only run). */
  cancelActiveJobs: () => void;
  dismissJob: (id: string) => void;
  removeHistoryEntry: (id: string) => void;
  runningCount: number;
  pendingCount: number;
};

const PptJobsContext = createContext<PptJobsContextValue | null>(null);

function applyStreamPart(job: PptJob, part: PptStreamDataPart): Partial<PptJob> {
  if (part.type === 'phase') {
    return { phase: part.phase as PptJobPhase };
  }
  if (part.type === 'attempt') {
    return { attempt: part.n, maxAttempts: part.max };
  }
  if (part.type === 'issues') {
    return { issues: part.items };
  }
  if (part.type === 'log') {
    return { logs: [...job.logs, part.message] };
  }
  if (part.type === 'job') {
    return { serverJobId: part.jobId };
  }
  if (part.type === 'slideReady') {
    return {
      serverJobId: part.jobId,
      readySlideCount: part.readyCount,
      slideCount: part.total,
      phase: 'generating',
    };
  }
  if (part.type === 'previewReady') {
    return {
      serverJobId: part.jobId,
      previewUrl: part.previewUrl,
      slideCount: part.slideCount,
      readySlideCount: part.slideCount,
      phase: 'done',
    };
  }
  return {};
}

export function PptJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<PptJob[]>([]);
  const [history, setHistory] = useState<PptHistoryEntry[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobsRef = useRef(jobs);
  const abortControllers = useRef(new Map<string, AbortController>());
  const hydrated = useRef(false);

  jobsRef.current = jobs;

  useEffect(() => {
    const persisted = migrateCompletedJobsToHistory(loadPersistedPptJobs());
    setJobs(persisted);
    setHistory(loadPptHistory());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    persistPptJobs(jobs);
  }, [jobs]);

  const updateJob = useCallback((id: string, patch: Partial<PptJob>) => {
    setJobs(prev =>
      prev.map(job =>
        job.id === id ? { ...job, ...patch, updatedAt: Date.now() } : job,
      ),
    );
  }, []);

  const runJob = useCallback(
    async (jobId: string) => {
      const job = jobsRef.current.find(item => item.id === jobId);
      if (!job) {
        return;
      }

      const controller = new AbortController();
      abortControllers.current.set(jobId, controller);

      updateJob(jobId, {
        status: 'running',
        phase: 'generating',
        error: undefined,
        readySlideCount: 0,
      });

      let streamFailed = false;
      let streamServerJobId: string | undefined;
      let streamPreviewUrl: string | undefined;
      let streamSlideCount: number | undefined;
      let streamPhase: PptJobPhase | undefined;
      let streamIssues: PptJob['issues'] = [];

      const completeJob = (
        serverJobId: string,
        previewUrl: string,
        slideCount?: number,
      ) => {
        updateJob(jobId, {
          status: 'completed',
          phase: 'done',
          serverJobId,
          previewUrl,
          slideCount,
          error: undefined,
        });
        appendPptHistory({
          id: jobId,
          prompt: job.prompt,
          outlineTitle: job.outlineTitle,
          outline: job.outline,
          model: job.model,
          slideCount,
          serverJobId,
          previewUrl,
          createdAt: job.createdAt,
          completedAt: Date.now(),
        });
        setHistory(loadPptHistory());
      };

      try {
        const streamResult = await runPptGenerationStream(
          {
            prompt: job.prompt,
            outline: job.outline,
            model: job.model,
            attachments: job.attachments,
            templateId: job.templateId,
          },
          {
            onData: part => {
              const latest = jobsRef.current.find(item => item.id === jobId);
              if (!latest) {
                return;
              }
              if (part.type === 'job') {
                streamServerJobId = part.jobId;
              }
              if (part.type === 'previewReady') {
                streamServerJobId = part.jobId;
                streamPreviewUrl = part.previewUrl;
                streamSlideCount = part.slideCount;
              }
              if (part.type === 'phase') {
                streamPhase = part.phase as PptJobPhase;
              }
              if (part.type === 'issues') {
                streamIssues = part.items;
              }
              updateJob(jobId, applyStreamPart(latest, part));
            },
            onError: message => {
              if (streamPreviewUrl) {
                return;
              }
              streamFailed = true;
              updateJob(jobId, {
                status: 'failed',
                phase: 'failed',
                error: message,
              });
            },
          },
          controller.signal,
        );

        if (controller.signal.aborted) {
          updateJob(jobId, {
            status: 'failed',
            phase: 'failed',
            error: '已取消',
          });
          return;
        }

        if (streamResult.ok) {
          completeJob(
            streamResult.preview.jobId,
            streamResult.preview.previewUrl,
            streamResult.preview.slideCount,
          );
          return;
        }

        streamServerJobId ??= streamResult.serverJobId;

        if (streamServerJobId) {
          const recovered = await recoverPptPreviewFromServer(streamServerJobId);
          if (recovered) {
            completeJob(
              recovered.jobId,
              recovered.previewUrl,
              recovered.slideCount,
            );
            return;
          }
        }

        if (streamFailed) {
          return;
        }

        const latest = jobsRef.current.find(item => item.id === jobId);
        if (!latest) {
          return;
        }

        const phase = streamPhase ?? latest.phase;
        const issues = streamIssues.length ? streamIssues : latest.issues;
        const issueMessage = issues[0]?.message;
        updateJob(jobId, {
          status: 'failed',
          phase: 'failed',
          error:
            streamResult.error ??
            latest.error ??
            issueMessage ??
            (phase === 'failed'
              ? '驗證未通過，請調整大綱後再試'
              : '生成未完成'),
        });
      } catch (e) {
        if (controller.signal.aborted) {
          updateJob(jobId, {
            status: 'failed',
            phase: 'failed',
            error: '已取消',
          });
          return;
        }
        if (streamServerJobId) {
          const recovered = await recoverPptPreviewFromServer(streamServerJobId);
          if (recovered) {
            completeJob(
              recovered.jobId,
              recovered.previewUrl,
              recovered.slideCount,
            );
            return;
          }
        }
        updateJob(jobId, {
          status: 'failed',
          phase: 'failed',
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        abortControllers.current.delete(jobId);
        processQueueRef.current();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateJob],
  );

  const processQueueRef = useRef<() => void>(() => {});

  const processQueue = useCallback(() => {
    const current = jobsRef.current;
    const hasRunning = current.some(job => job.status === 'running');
    if (hasRunning) {
      return;
    }
    const next = current.find(job => job.status === 'pending');
    if (next) {
      void runJob(next.id);
    }
  }, [runJob]);

  processQueueRef.current = processQueue;

  const enqueueJob = useCallback((input: EnqueueInput) => {
    const job = createPptJob(input);
    setJobs(prev => [...prev, job]);
    setActiveJobId(job.id);
    queueMicrotask(() => processQueueRef.current());
    return job.id;
  }, []);

  const cancelJob = useCallback(
    (id: string) => {
      const controller = abortControllers.current.get(id);
      if (controller) {
        controller.abort();
      }
      setJobs(prev => prev.filter(job => job.id !== id));
      if (activeJobId === id) {
        setActiveJobId(null);
      }
      queueMicrotask(() => processQueueRef.current());
    },
    [activeJobId],
  );

  const cancelActiveJobs = useCallback(() => {
    for (const id of abortControllers.current.keys()) {
      abortControllers.current.get(id)?.abort();
    }
    abortControllers.current.clear();
    setJobs(prev =>
      prev.filter(job => job.status !== 'pending' && job.status !== 'running'),
    );
    setActiveJobId(null);
  }, []);

  const dismissJob = useCallback(
    (id: string) => {
      setJobs(prev => prev.filter(job => job.id !== id));
      if (activeJobId === id) {
        setActiveJobId(null);
      }
      queueMicrotask(() => processQueueRef.current());
    },
    [activeJobId],
  );

  const removeHistoryEntry = useCallback(
    (id: string) => {
      removePptHistory(id);
      setHistory(loadPptHistory());
    },
    [],
  );

  const activeJob = useMemo(
    () => jobs.find(job => job.id === activeJobId),
    [activeJobId, jobs],
  );

  const runningCount = jobs.filter(job => job.status === 'running').length;
  const pendingCount = jobs.filter(job => job.status === 'pending').length;

  const value: PptJobsContextValue = {
    jobs,
    history,
    activeJobId,
    setActiveJobId,
    activeJob,
    enqueueJob,
    cancelJob,
    cancelActiveJobs,
    dismissJob,
    removeHistoryEntry,
    runningCount,
    pendingCount,
  };

  return (
    <PptJobsContext.Provider value={value}>{children}</PptJobsContext.Provider>
  );
}

export function usePptJobs() {
  const ctx = useContext(PptJobsContext);
  if (!ctx) {
    throw new Error('usePptJobs must be used within PptJobsProvider');
  }
  return ctx;
}
