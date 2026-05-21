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
import type { JSONValue } from 'ai';

import type { FollowUpEntry } from '@/research-query';

import {
  appendResearchHistory,
  loadResearchHistory,
  makeHistoryPreview,
  removeResearchHistory,
  type ResearchHistoryEntry,
} from '../lib/research-history';
import {
  createResearchJob,
  loadPersistedJobs,
  persistJobs,
  type ResearchJob,
} from '../lib/research-jobs';
import {
  DEFAULT_RESEARCH_MODEL,
  loadSelectedModel,
  saveSelectedModel,
  type ResearchModelId,
} from '../lib/research-models';
import type { PromptAttachment } from '../lib/prompt-attachments';
import { runResearchStream } from '../lib/run-research-stream';

type EnqueueInput = {
  query: string;
  breadth: number;
  depth: number;
  mode: 'report' | 'answer';
  model: ResearchModelId;
  followUp?: FollowUpEntry[];
  attachments?: PromptAttachment[];
};

type ResearchJobsContextValue = {
  jobs: ResearchJob[];
  history: ResearchHistoryEntry[];
  selectedModel: ResearchModelId;
  setSelectedModel: (model: ResearchModelId) => void;
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
  activeJob: ResearchJob | undefined;
  enqueueJob: (input: EnqueueInput) => string;
  cancelJob: (id: string) => void;
  dismissJob: (id: string) => void;
  removeHistoryEntry: (id: string) => void;
  refreshHistory: () => void;
  runningCount: number;
  pendingCount: number;
};

const ResearchJobsContext = createContext<ResearchJobsContextValue | null>(
  null,
);

function sourcesMarkdown(urls: string[]) {
  if (!urls.length) {
    return '';
  }
  return `\n\n## Sources\n\n${urls.map(url => `- ${url}`).join('\n')}`;
}

function buildExportContent(job: ResearchJob): string {
  const assistant = [...job.messages]
    .reverse()
    .find(m => m.role === 'assistant');
  const report = assistant?.content ?? '';
  const sourcesPart = [...job.data]
    .reverse()
    .find(
      (part): part is { type: 'sources'; urls: string[] } =>
        typeof part === 'object' &&
        part !== null &&
        !Array.isArray(part) &&
        (part as { type?: string }).type === 'sources',
    );
  const answerPart = [...job.data]
    .reverse()
    .find(
      (part): part is { type: 'answer'; answer: string } =>
        typeof part === 'object' &&
        part !== null &&
        !Array.isArray(part) &&
        (part as { type?: string }).type === 'answer',
    );

  if (job.mode === 'answer' && answerPart?.answer) {
    return answerPart.answer;
  }
  return report + sourcesMarkdown(sourcesPart?.urls ?? []);
}

export function ResearchJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [history, setHistory] = useState<ResearchHistoryEntry[]>([]);
  const [selectedModel, setSelectedModelState] = useState<ResearchModelId>(
    DEFAULT_RESEARCH_MODEL,
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobsRef = useRef(jobs);
  const abortControllers = useRef(new Map<string, AbortController>());
  const hydrated = useRef(false);

  jobsRef.current = jobs;

  useEffect(() => {
    setJobs(loadPersistedJobs());
    setHistory(loadResearchHistory());
    setSelectedModelState(loadSelectedModel());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    persistJobs(jobs);
  }, [jobs]);

  const setSelectedModel = useCallback((model: ResearchModelId) => {
    setSelectedModelState(model);
    saveSelectedModel(model);
  }, []);

  const refreshHistory = useCallback(() => {
    setHistory(loadResearchHistory());
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<ResearchJob>) => {
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

      updateJob(jobId, { status: 'running', error: undefined });

      let assistantText = '';
      const dataParts: JSONValue[] = [];
      let streamFailed = false;

      try {
        await runResearchStream(
          {
            query: job.query,
            breadth: job.breadth,
            depth: job.depth,
            mode: job.mode,
            model: job.model,
            followUp: job.followUp,
            attachments: job.attachments,
          },
          {
            onText: text => {
              assistantText = text;
              updateJob(jobId, {
                messages: [
                  { id: `${jobId}-user`, role: 'user', content: job.query },
                  {
                    id: `${jobId}-assistant`,
                    role: 'assistant',
                    content: text,
                  },
                ],
                data: [...dataParts],
              });
            },
            onData: data => {
              dataParts.push(data);
              updateJob(jobId, {
                data: [...dataParts],
                messages: assistantText
                  ? [
                      { id: `${jobId}-user`, role: 'user', content: job.query },
                      {
                        id: `${jobId}-assistant`,
                        role: 'assistant',
                        content: assistantText,
                      },
                    ]
                  : [{ id: `${jobId}-user`, role: 'user', content: job.query }],
              });
            },
            onError: message => {
              streamFailed = true;
              updateJob(jobId, { status: 'failed', error: message });
            },
          },
          controller.signal,
        );

        if (streamFailed || controller.signal.aborted) {
          return;
        }

        const latest = jobsRef.current.find(item => item.id === jobId);
        if (!latest) {
          return;
        }

        const content = buildExportContent(latest);
        updateJob(jobId, { status: 'completed' });

        if (content.trim()) {
          appendResearchHistory({
            id: jobId,
            query: job.query,
            mode: job.mode,
            model: job.model,
            createdAt: job.createdAt,
            completedAt: Date.now(),
            preview: makeHistoryPreview(content),
            content,
          });
          setHistory(loadResearchHistory());
        }
      } catch (e) {
        if (controller.signal.aborted) {
          updateJob(jobId, {
            status: 'failed',
            error: '已取消',
          });
          return;
        }
        updateJob(jobId, {
          status: 'failed',
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
    const job = createResearchJob(input);
    setJobs(prev => {
      const busy = prev.some(
        item => item.status === 'running' || item.status === 'pending',
      );
      if (!busy) {
        setActiveJobId(job.id);
      }
      return [...prev, job];
    });
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

  const dismissJob = useCallback(
    (id: string) => {
      setJobs(prev => prev.filter(job => job.id !== id));
      if (activeJobId === id) {
        setActiveJobId(null);
      }
    },
    [activeJobId],
  );

  const removeHistoryEntry = useCallback((id: string) => {
    removeResearchHistory(id);
    setHistory(loadResearchHistory());
  }, []);

  const activeJob = useMemo(
    () => jobs.find(job => job.id === activeJobId),
    [activeJobId, jobs],
  );

  const runningCount = jobs.filter(job => job.status === 'running').length;
  const pendingCount = jobs.filter(job => job.status === 'pending').length;

  const value: ResearchJobsContextValue = {
    jobs,
    history,
    selectedModel,
    setSelectedModel,
    activeJobId,
    setActiveJobId,
    activeJob,
    enqueueJob,
    cancelJob,
    dismissJob,
    removeHistoryEntry,
    refreshHistory,
    runningCount,
    pendingCount,
  };

  return (
    <ResearchJobsContext.Provider value={value}>
      {children}
    </ResearchJobsContext.Provider>
  );
}

export function useResearchJobs() {
  const ctx = useContext(ResearchJobsContext);
  if (!ctx) {
    throw new Error('useResearchJobs must be used within ResearchJobsProvider');
  }
  return ctx;
}
