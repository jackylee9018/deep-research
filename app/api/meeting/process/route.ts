import { createDataStreamResponse, type JSONValue } from 'ai';
import { writeFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';

import { getLlmEnvStatus } from '@/ai/providers';
import {
  getWhisperxWorkerUrl,
} from '@/meeting/config';
import {
  resolveMeetingJobDir,
  writeMeetingJobJson,
} from '@/meeting/jobs';
import { readMeetingJobSource } from '@/meeting/read-job-source';
import {
  renderMeetingMinutesMarkdown,
  renderPartialMeetingMinutesMarkdown,
} from '@/meeting/render-minutes-md';
import { punctuateMeetingTranscript } from '@/meeting/punctuate-transcript';
import { summarizeMeetingMinutes } from '@/meeting/summarize-minutes';
import {
  checkWhisperxWorkerHealth,
  submitTranscription,
  waitForTranscription,
  type WhisperxJobStatus,
} from '@/meeting/whisperx-client';

export const runtime = 'nodejs';
export const maxDuration = 600;

const processBodySchema = z.object({
  jobId: z.string().uuid(),
  language: z.string().default('zh'),
  detailLevel: z.enum(['brief', 'full']).default('full'),
  includeAppendix: z.boolean().default(true),
  restorePunctuation: z.boolean().default(false),
  minSpeakers: z.number().int().positive().optional(),
  maxSpeakers: z.number().int().positive().optional(),
});

function workerPhasePayload(status: WhisperxJobStatus) {
  return {
    type: 'transcribe' as const,
    status: status.status,
    phase: status.phase ?? status.status,
    detail: status.detail ?? '',
  };
}

const TRANSCRIPT_CHUNK_SIZE = 40;

function streamTranscriptChunks(
  dataStream: { writeData: (value: JSONValue) => void },
  transcript: Awaited<ReturnType<typeof waitForTranscription>>,
) {
  dataStream.writeData({
    type: 'transcriptMeta',
    meta: transcript.meta,
    speakers: transcript.speakers,
    utteranceCount: transcript.utterances.length,
  });

  for (let offset = 0; offset < transcript.utterances.length; offset += TRANSCRIPT_CHUNK_SIZE) {
    const utterances = transcript.utterances.slice(
      offset,
      offset + TRANSCRIPT_CHUNK_SIZE,
    );
    dataStream.writeData({
      type: 'transcriptChunk',
      offset,
      total: transcript.utterances.length,
      utterances,
    });
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
    restorePunctuation,
    minSpeakers,
    maxSpeakers,
  } = parsed.data;

  try {
    resolveMeetingJobDir(jobId);
  } catch {
    return Response.json({ error: 'Invalid job id' }, { status: 400 });
  }

  return createDataStreamResponse({
    execute: async dataStream => {
      dataStream.writeData({ type: 'job', jobId });
      dataStream.writeData({ type: 'phase', phase: 'transcribing' });

      const { buffer, fileName } = await readMeetingJobSource(jobId);

      const workerJobId = await submitTranscription(
        new Blob([buffer]),
        fileName,
        {
          language,
          minSpeakers,
          maxSpeakers,
        },
      );

      dataStream.writeData({ type: 'workerJob', workerJobId });

      let transcript = await waitForTranscription(workerJobId, status => {
        dataStream.writeData(workerPhasePayload(status));
      });

      if (restorePunctuation) {
        dataStream.writeData({ type: 'phase', phase: 'punctuating' });
        dataStream.writeData({
          type: 'step',
          step: 'punctuation',
          status: 'active',
          detail: '正在還原標點',
        });

        transcript = await punctuateMeetingTranscript(transcript, {
          language,
          onProgress: ({ batchIndex, batchCount }) => {
            dataStream.writeData({
              type: 'punctuateProgress',
              batchIndex,
              batchCount,
            });
            dataStream.writeData({
              type: 'step',
              step: 'punctuation',
              status: 'active',
              detail: `標點還原 ${batchIndex}/${batchCount}`,
            });
          },
        });

        dataStream.writeData({
          type: 'step',
          step: 'punctuation',
          status: 'done',
          detail: '標點還原完成',
        });
      }

      await writeMeetingJobJson(jobId, 'transcript.json', transcript);
      dataStream.writeData({
        type: 'transcript',
        speakers: transcript.speakers,
        utteranceCount: transcript.utterances.length,
      });
      streamTranscriptChunks(dataStream, transcript);

      dataStream.writeData({ type: 'phase', phase: 'summarizing' });
      dataStream.writeData({
        type: 'step',
        step: 'minutes',
        status: 'active',
        detail: '正在生成會議紀要',
      });

      const minutes = await summarizeMeetingMinutes(transcript, fileName, {
        detailLevel,
        language,
        onProgress: ({ chunkIndex, chunkCount, merged }) => {
          dataStream.writeData({
            type: 'summarizeProgress',
            chunkIndex,
            chunkCount,
          });
          const partialMarkdown = renderPartialMeetingMinutesMarkdown(merged, {
            chunkIndex,
            chunkCount,
          });
          dataStream.writeData({
            type: 'markdown',
            content: partialMarkdown,
            partial: true,
          });
          dataStream.writeData({
            type: 'step',
            step: 'minutes',
            status: 'active',
            detail: `正在整理第 ${chunkIndex}/${chunkCount} 段`,
          });
        },
      });

      const markdown = renderMeetingMinutesMarkdown(minutes, transcript, {
        includeAppendix,
      });

      await writeMeetingJobJson(jobId, 'minutes.json', minutes);
      await writeFile(path.join(resolveMeetingJobDir(jobId), 'minutes.md'), markdown, 'utf-8');

      dataStream.writeData({ type: 'minutes', minutes });
      dataStream.writeData({ type: 'markdown', content: markdown });
      dataStream.writeData({
        type: 'step',
        step: 'minutes',
        status: 'done',
        detail: '會議紀要完成',
      });
      dataStream.writeData({ type: 'phase', phase: 'done' });
    },
    onError: error => {
      console.error('Meeting process error:', error);
      return error instanceof Error ? error.message : 'Meeting processing failed';
    },
  });
}
