import { access, readFile } from 'fs/promises';
import path from 'path';

import {
  readMeetingJobJson,
  resolveMeetingJobDir,
  writeMeetingJobJson,
} from '@/meeting/jobs';

export const runtime = 'nodejs';
const RUNNING_STALE_MS = 15 * 60 * 1000;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let jobDir = '';

  try {
    jobDir = resolveMeetingJobDir(id);
    await access(jobDir);
  } catch {
    return Response.json({ error: 'Invalid or missing job id' }, { status: 404 });
  }

  let markdown = '';
  try {
    markdown = await readFile(
      path.join(jobDir, 'minutes.md'),
      'utf-8',
    );
  } catch {
    // minutes.md may not exist yet
  }

  const minutes = await readMeetingJobJson(id, 'minutes.json');
  const transcript =
    (await readMeetingJobJson(id, 'transcript.json')) ??
    (await readMeetingJobJson(id, 'transcript.partial.json'));
  const status = await readMeetingJobJson<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    phase?: string;
    detail?: string;
    workerJobId?: string;
    error?: string;
    updatedAt?: number;
    heartbeatAt?: number;
    startedAt?: number;
    completedAt?: number;
  }>(id, 'status.json');

  let effectiveStatus = status;
  if (
    effectiveStatus?.status === 'running' &&
    typeof (effectiveStatus.heartbeatAt ?? effectiveStatus.updatedAt) === 'number'
  ) {
    const heartbeatAt = effectiveStatus.heartbeatAt ?? effectiveStatus.updatedAt ?? 0;
    const staleFor = Date.now() - heartbeatAt;
    if (staleFor > RUNNING_STALE_MS) {
      const hasTranscript = Boolean(transcript);
      const failedDetail = hasTranscript
        ? '摘要階段心跳逾時'
        : '後台任務心跳逾時';
      const failedError = hasTranscript
        ? '轉錄已完成，但摘要階段超過時間沒有進度更新，可能已中斷；你仍可查看逐字稿。'
        : `任務超過 ${Math.round(RUNNING_STALE_MS / 60000)} 分鐘無進度更新，可能已中斷`;
      effectiveStatus = {
        ...effectiveStatus,
        status: 'failed',
        phase: 'failed',
        detail: failedDetail,
        error: failedError,
        completedAt: Date.now(),
        updatedAt: Date.now(),
        heartbeatAt: Date.now(),
      };
      await writeMeetingJobJson(id, 'status.json', effectiveStatus);
    }
  }

  if (!markdown && !minutes && !transcript && !status) {
    return Response.json({
      jobId: id,
      status: 'pending',
      phase: 'queued',
      detail: '等待處理',
      markdown: '',
      minutes: null,
      transcript: null,
    });
  }

  return Response.json({
    jobId: id,
    status:
      effectiveStatus?.status ??
      (minutes || markdown
        ? 'completed'
        : transcript
          ? 'running'
          : 'pending'),
    phase:
      effectiveStatus?.phase ??
      (minutes || markdown
        ? 'done'
        : transcript
          ? 'summarizing'
          : 'queued'),
    detail: effectiveStatus?.detail ?? '',
    workerJobId: effectiveStatus?.workerJobId,
    error: effectiveStatus?.error,
    updatedAt: effectiveStatus?.updatedAt,
    startedAt: effectiveStatus?.startedAt,
    completedAt: effectiveStatus?.completedAt,
    markdown,
    minutes,
    transcript,
  });
}
