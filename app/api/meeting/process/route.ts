import { writeFile } from 'fs/promises';
import { after } from 'next/server';
import path from 'path';
import { z } from 'zod';

import { getLlmEnvStatus } from '@/ai/providers';
import {
  getWhisperxWorkerUrl,
} from '@/meeting/config';
import {
  readMeetingJobJson,
  resolveMeetingJobDir,
  writeMeetingJobJson,
} from '@/meeting/jobs';
import { readMeetingJobSource } from '@/meeting/read-job-source';
import {
  renderMeetingMinutesMarkdown,
} from '@/meeting/render-minutes-md';
import { punctuateMeetingTranscript } from '@/meeting/punctuate-transcript';
import { summarizeMeetingMinutes } from '@/meeting/summarize-minutes';
import {
  checkWhisperxWorkerHealth,
  submitTranscription,
  waitForTranscription,
} from '@/meeting/whisperx-client';

export const runtime = 'nodejs';
// 長音檔（例如 15~30 分鐘）在轉錄+標點+摘要常超過 10 分鐘
export const maxDuration = 1800;

const processBodySchema = z.object({
  jobId: z.string().uuid(),
  language: z.string().default('zh'),
  detailLevel: z.enum(['brief', 'full']).default('full'),
  includeAppendix: z.boolean().default(true),
  minSpeakers: z.number().int().positive().optional(),
  maxSpeakers: z.number().int().positive().optional(),
});

type MeetingProcessState = {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  phase:
    | 'queued'
    | 'transcribing'
    | 'preprocessing'
    | 'loading'
    | 'aligning'
    | 'diarizing'
    | 'punctuating'
    | 'summarizing'
    | 'done'
    | 'failed';
  detail: string;
  workerJobId?: string;
  error?: string;
  updatedAt: number;
  heartbeatAt: number;
  startedAt?: number;
  completedAt?: number;
};

async function updateState(
  jobId: string,
  patch: Partial<MeetingProcessState>,
): Promise<MeetingProcessState> {
  const current =
    (await readMeetingJobJson<MeetingProcessState>(jobId, 'status.json')) ?? {
      jobId,
      status: 'pending',
      phase: 'queued',
      detail: '等待處理',
      updatedAt: Date.now(),
    };
  const next: MeetingProcessState = {
    ...current,
    ...patch,
    jobId,
    updatedAt: Date.now(),
    heartbeatAt: Date.now(),
  };
  await writeMeetingJobJson(jobId, 'status.json', next);
  return next;
}

async function runMeetingProcess(input: z.infer<typeof processBodySchema>) {
  const {
    jobId,
    language,
    detailLevel,
    includeAppendix,
    minSpeakers,
    maxSpeakers,
  } = input;

  const { buffer, fileName } = await readMeetingJobSource(jobId);
  const heartbeat = setInterval(() => {
    void updateState(jobId, {});
  }, 15_000);

  try {
    await updateState(jobId, {
      status: 'running',
      phase: 'transcribing',
      detail: '音訊已上傳，準備轉錄',
      startedAt: Date.now(),
    });

    const workerJobId = await submitTranscription(
      new Blob([buffer]),
      fileName,
      {
        language,
        minSpeakers,
        maxSpeakers,
      },
    );

    await updateState(jobId, {
      workerJobId,
      phase: 'queued',
      detail: '排隊等待轉錄',
    });

    let transcript = await waitForTranscription(workerJobId, status => {
      void updateState(jobId, {
        workerJobId,
        phase: (status.phase ?? status.status) as MeetingProcessState['phase'],
        detail: status.detail ?? '',
        status: status.status === 'failed' ? 'failed' : 'running',
        error: status.error ?? undefined,
      });
    }, partialTranscript => {
      void writeMeetingJobJson(jobId, 'transcript.partial.json', partialTranscript);
      void updateState(jobId, {
        phase: 'transcribing',
        detail: `逐字稿累積 ${partialTranscript.utterances.length} 句`,
      });
    });

    await writeMeetingJobJson(jobId, 'transcript.raw.json', transcript);
    await updateState(jobId, {
      phase: 'punctuating',
      detail: '正在還原標點',
    });

    const punctuateResult = await punctuateMeetingTranscript(transcript, {
      language,
      onProgress: ({ batchIndex, batchCount }) => {
        void updateState(jobId, {
          phase: 'punctuating',
          detail: `標點還原 ${batchIndex}/${batchCount}`,
        });
      },
    });
    transcript = punctuateResult.transcript;

    if (punctuateResult.punctuatedCount === 0) {
      await updateState(jobId, {
        phase: 'punctuating',
        detail:
          punctuateResult.failedBatchCount > 0
            ? '標點還原失敗，改用原始逐字稿繼續摘要'
            : '標點還原未變更，繼續摘要',
        error: undefined,
      });
    } else if (punctuateResult.failedBatchCount > 0) {
      await updateState(jobId, {
        phase: 'punctuating',
        detail: `標點還原完成 ${punctuateResult.punctuatedCount} 句（${punctuateResult.failedBatchCount} 批失敗）`,
        error: undefined,
      });
    }

    await writeMeetingJobJson(jobId, 'transcript.json', transcript);
    await updateState(jobId, {
      phase: 'summarizing',
      detail: '正在生成會議紀要',
    });

    const minutes = await summarizeMeetingMinutes(transcript, fileName, {
      detailLevel,
      language,
      onProgress: ({ chunkIndex, chunkCount }) => {
        void updateState(jobId, {
          phase: 'summarizing',
          detail: `正在整理第 ${chunkIndex}/${chunkCount} 段`,
        });
      },
    });

    const markdown = renderMeetingMinutesMarkdown(minutes, transcript, {
      includeAppendix,
    });

    await writeMeetingJobJson(jobId, 'minutes.json', minutes);
    await writeFile(path.join(resolveMeetingJobDir(jobId), 'minutes.md'), markdown, 'utf-8');
    await updateState(jobId, {
      status: 'completed',
      phase: 'done',
      detail: '會議紀要完成',
      completedAt: Date.now(),
    });
  } finally {
    clearInterval(heartbeat);
  }
}

export async function POST(req: Request) {
  const llm = getLlmEnvStatus();
  if (!llm.configured) {
    return Response.json(
      { error: 'LLM not configured', message: '請設定 OPENROUTER_API_KEY 或 OPENAI_ENDPOINT' },
      { status: 503 },
    );
  }

  const workerOk = await checkWhisperxWorkerHealth();
  if (!workerOk) {
    return Response.json(
      {
        error: 'WhisperX worker unavailable',
        message: `請先啟動轉錄服務：npm run meeting:worker（${getWhisperxWorkerUrl()}）`,
      },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = processBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    jobId,
    language,
    detailLevel,
    includeAppendix,
    minSpeakers,
    maxSpeakers,
  } = parsed.data;

  try {
    resolveMeetingJobDir(jobId);
  } catch {
    return Response.json({ error: 'Invalid job id' }, { status: 400 });
  }

  const current = await readMeetingJobJson<MeetingProcessState>(jobId, 'status.json');
  if (current?.status === 'running') {
    return Response.json(
      { error: 'Job is already running', jobId },
      { status: 409 },
    );
  }

  await updateState(jobId, {
    status: 'pending',
    phase: 'queued',
    detail: '任務已建立，等待後台處理',
    error: undefined,
    completedAt: undefined,
  });

  after(() => {
    void runMeetingProcess({
      jobId,
      language,
      detailLevel,
      includeAppendix,
      minSpeakers,
      maxSpeakers,
    }).catch(async error => {
      console.error('Meeting process error:', error);
      await updateState(jobId, {
        status: 'failed',
        phase: 'failed',
        detail: '處理失敗',
        error: error instanceof Error
          ? error.message
          : 'Meeting processing failed',
        completedAt: Date.now(),
      });
    });
  });

  return Response.json({
    jobId,
    status: 'running',
    phase: 'queued',
    detail: '任務已送出，後台處理中',
  });
}
