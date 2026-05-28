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

import type { MeetingMinutes } from '@/meeting/schemas/minutes';
import type {
  MeetingTranscript,
  MeetingUtterance,
} from '@/meeting/schemas/transcript';
import { renderMeetingMinutesMarkdown } from '@/meeting/render-minutes-md';

import {
  extractMarkdownFromJobData,
  extractMinutesFromJobData,
  extractServerJobIdFromJobData,
  finalizeMeetingJobContent,
  mergeTranscriptChunk,
  resolveJobMarkdown,
} from '../lib/meeting-job-content';
import {
  createMeetingJob,
  loadPersistedMeetingJobs,
  persistMeetingJobs,
  type MeetingJob,
} from '../lib/meeting-jobs';
import { runMeetingStream } from '../lib/run-meeting-stream';

type EnqueueInput = {
  file: File;
  language: string;
  detailLevel: 'brief' | 'full';
  includeAppendix: boolean;
  minSpeakers?: number;
  maxSpeakers?: number;
};

type MeetingJobsContextValue = {
  jobs: MeetingJob[];
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
  activeJob: MeetingJob | undefined;
  enqueueJob: (input: EnqueueInput) => string;
  cancelJob: (id: string) => void;
  dismissJob: (id: string) => void;
  runningCount: number;
};

const MeetingJobsContext = createContext<MeetingJobsContextValue | null>(null);

function isRecord(value: JSONValue): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function fetchServerJobResult(serverJobId: string): Promise<{
  markdown?: string;
  minutes?: MeetingMinutes;
  transcript?: MeetingTranscript;
} | null> {
  try {
    const res = await fetch(`/api/meeting/jobs/${encodeURIComponent(serverJobId)}`);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as {
      markdown?: string;
      minutes?: MeetingMinutes;
      transcript?: MeetingTranscript;
    };
  } catch {
    return null;
  }
}

async function fetchServerJobResultWithRetry(
  serverJobId: string,
  attempts = 4,
): Promise<{
  markdown?: string;
  minutes?: MeetingMinutes;
  transcript?: MeetingTranscript;
} | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const remote = await fetchServerJobResult(serverJobId);
    if (remote?.markdown?.trim() || remote?.minutes) {
      return remote;
    }
    if (attempt < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  return null;
}

function applyRemoteJobResult(
  remote: {
    markdown?: string;
    minutes?: MeetingMinutes;
    transcript?: MeetingTranscript;
  },
  current: Pick<MeetingJob, 'markdown' | 'minutes' | 'transcript'>,
): Partial<MeetingJob> {
  const transcript = remote.transcript ?? current.transcript;
  const minutes = remote.minutes ?? current.minutes;
  let markdown = remote.markdown?.trim() ?? '';
  if (!markdown && minutes) {
    markdown = renderMeetingMinutesMarkdown(minutes, transcript, {
      includeAppendix: Boolean(transcript?.utterances.length),
    });
  }
  return { markdown, minutes, transcript };
}

export function MeetingJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<MeetingJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobsRef = useRef(jobs);
  const abortControllers = useRef(new Map<string, AbortController>());
  const fileRegistry = useRef(new Map<string, File>());
  const hydrated = useRef(false);
  const fetchedServerResults = useRef(new Set<string>());
  const pendingServerFetches = useRef(new Set<string>());

  jobsRef.current = jobs;

  useEffect(() => {
    const loaded = loadPersistedMeetingJobs();
    setJobs(loaded);
    const activeRunning = loaded.find(job => job.status === 'running');
    const latestCompleted = loaded.find(job => job.status === 'completed');
    if (activeRunning) {
      setActiveJobId(activeRunning.id);
    } else if (latestCompleted) {
      setActiveJobId(latestCompleted.id);
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    persistMeetingJobs(jobs);
  }, [jobs]);

  const updateJob = useCallback((jobId: string, patch: Partial<MeetingJob>) => {
    setJobs(prev =>
      prev.map(job =>
        job.id === jobId
          ? { ...job, ...patch, updatedAt: Date.now() }
          : job,
      ),
    );
  }, []);

  const hydrateJobFromServer = useCallback(
    async (job: MeetingJob): Promise<boolean> => {
      const serverJobId = job.serverJobId;
      if (!serverJobId) {
        return false;
      }
      if (job.status === 'completed' && resolveJobMarkdown(job).trim()) {
        return false;
      }

      const key = `recover:${job.id}:${serverJobId}`;
      if (pendingServerFetches.current.has(key)) {
        return false;
      }
      if (
        job.status === 'completed' &&
        fetchedServerResults.current.has(`${job.id}:${serverJobId}`)
      ) {
        return false;
      }
      pendingServerFetches.current.add(key);

      try {
        const remote = await fetchServerJobResult(serverJobId);
        if (!remote) {
          return false;
        }

        const hasMinutes = Boolean(remote.minutes || remote.markdown?.trim());
        const hasTranscript = Boolean(remote.transcript?.utterances.length);

        if (job.status === 'running') {
          if (hasMinutes) {
            abortControllers.current.get(job.id)?.abort();
            const finalized = finalizeMeetingJobContent(job, {
              ...applyRemoteJobResult(remote, job),
              serverJobId,
              data: job.data,
            });
            updateJob(job.id, { status: 'completed', ...finalized });
            return true;
          }
          if (hasTranscript && !job.transcript?.utterances.length) {
            updateJob(job.id, {
              transcript: remote.transcript,
              data: [
                ...job.data,
                {
                  type: 'transcribe',
                  detail: '轉錄完成，正在生成會議紀要…',
                },
              ],
            });
            return true;
          }
          return false;
        }

        if (!hasMinutes && !hasTranscript) {
          return false;
        }

        fetchedServerResults.current.add(`${job.id}:${serverJobId}`);
        const finalized = finalizeMeetingJobContent(job, {
          ...applyRemoteJobResult(remote, job),
          serverJobId,
          data: job.data,
        });
        updateJob(job.id, finalized);
        return true;
      } finally {
        pendingServerFetches.current.delete(key);
      }
    },
    [updateJob],
  );

  useEffect(() => {
    const job = jobsRef.current.find(item => item.id === activeJobId);
    if (job) {
      void hydrateJobFromServer(job);
    }
  }, [activeJobId, hydrateJobFromServer]);

  const applyDataPart = useCallback(
    (jobId: string, data: JSONValue, dataParts: JSONValue[]) => {
      const patch: Partial<MeetingJob> = { data: [...dataParts] };

      if (isRecord(data)) {
        if (data.type === 'job' && typeof data.jobId === 'string') {
          patch.serverJobId = data.jobId;
        }
        if (data.type === 'markdown' && typeof data.content === 'string') {
          patch.markdown = data.content;
        }
        if (
          data.type === 'minutes' &&
          data.minutes !== undefined &&
          isRecord(data.minutes)
        ) {
          patch.minutes = data.minutes as unknown as MeetingMinutes;
        }
      }

      const markdown = patch.markdown ?? extractMarkdownFromJobData(dataParts);
      if (markdown) {
        patch.markdown = markdown;
      }

      updateJob(jobId, patch);
    },
    [updateJob],
  );

  const runJob = useCallback(
    async (jobId: string, input: EnqueueInput) => {
      const controller = new AbortController();
      abortControllers.current.set(jobId, controller);
      updateJob(jobId, {
        status: 'running',
        error: undefined,
        data: [{ type: 'phase', phase: 'uploading' }],
      });

      const dataParts: JSONValue[] = [];
      let liveTranscript: MeetingTranscript | undefined;
      let streamServerJobId: string | undefined;
      let failed = false;

      const handleStreamData = (data: JSONValue) => {
        if (isRecord(data)) {
          if (data.type === 'job' && typeof data.jobId === 'string') {
            streamServerJobId = data.jobId;
            updateJob(jobId, { serverJobId: data.jobId });
          }

          if (data.type === 'workerJob' && typeof data.workerJobId === 'string') {
            updateJob(jobId, { workerJobId: data.workerJobId });
          }

          if (
            data.type === 'transcriptMeta' &&
            data.meta !== undefined &&
            isRecord(data.meta)
          ) {
            liveTranscript = mergeTranscriptChunk(
              liveTranscript,
              data.meta as unknown as MeetingTranscript['meta'],
              Array.isArray(data.speakers)
                ? (data.speakers as string[])
                : [],
              [],
            );
            dataParts.push({
              type: 'transcribe',
              detail: '正在載入逐字稿…',
            });
            updateJob(jobId, {
              transcript: liveTranscript,
              data: [...dataParts],
            });
            return;
          }

          if (
            data.type === 'transcriptChunk' &&
            Array.isArray(data.utterances)
          ) {
            const utterances = data.utterances as unknown as MeetingUtterance[];
            const total =
              typeof data.total === 'number'
                ? data.total
                : utterances.length;
            liveTranscript = mergeTranscriptChunk(
              liveTranscript,
              liveTranscript?.meta ?? {
                durationSec: 0,
                language: input.language,
              },
              liveTranscript?.speakers ?? [],
              utterances,
            );
            const loaded = liveTranscript.utterances.length;
            dataParts.push({
              type: 'transcribe',
              detail: `已載入逐字稿 ${loaded}/${total} 句`,
            });
            updateJob(jobId, {
              transcript: liveTranscript,
              data: [...dataParts],
            });
            return;
          }
        }

        if (
          isRecord(data) &&
          data.type === 'workerJob' &&
          typeof data.workerJobId === 'string'
        ) {
          dataParts.push(data);
          updateJob(jobId, {
            workerJobId: data.workerJobId,
            data: [...dataParts],
          });
          return;
        }

        dataParts.push(data);
        applyDataPart(jobId, data, dataParts);
      };

      try {
        await runMeetingStream(
          {
            file: input.file,
            language: input.language,
            detailLevel: input.detailLevel,
            includeAppendix: input.includeAppendix,
            minSpeakers: input.minSpeakers,
            maxSpeakers: input.maxSpeakers,
          },
          {
            onMarkdown: markdown => {
              updateJob(jobId, { markdown, data: [...dataParts] });
            },
            onData: handleStreamData,
            onUploadProgress: detail => {
              dataParts.push({ type: 'transcribe', detail });
              updateJob(jobId, { data: [...dataParts] });
            },
            onMinutes: minutes => {
              updateJob(jobId, { minutes });
            },
            onTranscript: transcript => {
              liveTranscript = transcript;
              updateJob(jobId, { transcript });
            },
            onError: message => {
              failed = true;
              updateJob(jobId, { status: 'failed', error: message });
            },
          },
          controller.signal,
        );

        if (!failed && !controller.signal.aborted) {
          const current = jobsRef.current.find(item => item.id === jobId);
          let markdown = extractMarkdownFromJobData(dataParts);
          let minutes = extractMinutesFromJobData(dataParts);
          let transcript = liveTranscript;
          const serverJobId =
            streamServerJobId ??
            extractServerJobIdFromJobData(dataParts) ??
            current?.serverJobId;

          if (serverJobId) {
            const remote = await fetchServerJobResultWithRetry(serverJobId);
            if (remote) {
              const patch = applyRemoteJobResult(remote, {
                markdown: markdown || current?.markdown || '',
                minutes: minutes ?? current?.minutes,
                transcript: transcript ?? current?.transcript,
              });
              markdown = patch.markdown ?? markdown;
              minutes = patch.minutes ?? minutes;
              transcript = patch.transcript ?? transcript;
            }
          }

          const finalized = finalizeMeetingJobContent(
            {
              markdown: current?.markdown ?? '',
              minutes: current?.minutes,
              transcript: current?.transcript,
              data: current?.data ?? [],
              serverJobId: current?.serverJobId,
            },
            {
              markdown,
              minutes,
              transcript,
              serverJobId,
              data: [...dataParts],
            },
          );

          updateJob(jobId, {
            status: 'completed',
            ...finalized,
          });
        }
      } catch (error) {
        const current = jobsRef.current.find(item => item.id === jobId);
        const serverJobId =
          streamServerJobId ??
          extractServerJobIdFromJobData(dataParts) ??
          current?.serverJobId;
        if (serverJobId && current) {
          const recovered = await hydrateJobFromServer({
            ...current,
            serverJobId,
          });
          if (recovered) {
            return;
          }
        }
        if (controller.signal.aborted) {
          updateJob(jobId, { status: 'failed', error: '已取消' });
        } else {
          updateJob(jobId, {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        abortControllers.current.delete(jobId);
      }
    },
    [applyDataPart, hydrateJobFromServer, updateJob],
  );

  const enqueueJob = useCallback(
    (input: EnqueueInput) => {
      const job = createMeetingJob({
        fileName: input.file.name,
        language: input.language,
        detailLevel: input.detailLevel,
        includeAppendix: input.includeAppendix,
      });
      fileRegistry.current.set(job.id, input.file);
      setJobs(prev => [job, ...prev]);
      setActiveJobId(job.id);
      void runJob(job.id, input);
      return job.id;
    },
    [runJob],
  );

  const cancelJob = useCallback(
    (id: string) => {
      abortControllers.current.get(id)?.abort();
      updateJob(id, { status: 'failed', error: '已取消' });
    },
    [updateJob],
  );

  const dismissJob = useCallback((id: string) => {
    abortControllers.current.get(id)?.abort();
    fileRegistry.current.delete(id);
    setJobs(prev => prev.filter(job => job.id !== id));
    setActiveJobId(current => (current === id ? null : current));
  }, []);

  const value = useMemo<MeetingJobsContextValue>(
    () => ({
      jobs,
      activeJobId,
      setActiveJobId,
      activeJob: jobs.find(j => j.id === activeJobId),
      enqueueJob,
      cancelJob,
      dismissJob,
      runningCount: jobs.filter(j => j.status === 'running').length,
    }),
    [jobs, activeJobId, enqueueJob, cancelJob, dismissJob],
  );

  return (
    <MeetingJobsContext.Provider value={value}>
      {children}
    </MeetingJobsContext.Provider>
  );
}

export function useMeetingJobs() {
  const ctx = useContext(MeetingJobsContext);
  if (!ctx) {
    throw new Error('useMeetingJobs must be used within MeetingJobsProvider');
  }
  return ctx;
}

export { resolveJobMarkdown };
