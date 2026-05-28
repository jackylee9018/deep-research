'use client';

import type { MeetingJob } from '../lib/meeting-jobs';
import {
  jobHasDisplayableContent,
  latestStreamDetail,
} from '../lib/meeting-job-content';
import { latestWorkerPhaseFromJobData } from '../lib/meeting-worker-progress';
import { meetingPhaseLabel, meetingPhaseStepIndex } from '../lib/meeting-status';

function latestPhase(job: MeetingJob): string | null {
  const workerPhase = latestWorkerPhaseFromJobData(job.data);
  if (workerPhase) {
    return workerPhase === 'queued' ? 'transcribing' : workerPhase;
  }

  for (let i = job.data.length - 1; i >= 0; i -= 1) {
    const part = job.data[i];
    if (
      typeof part === 'object' &&
      part !== null &&
      !Array.isArray(part) &&
      (part as { type?: string }).type === 'phase'
    ) {
      return String((part as { phase?: string }).phase ?? '');
    }
  }
  return null;
}

function latestTranscribeDetail(job: MeetingJob): string {
  for (let i = job.data.length - 1; i >= 0; i -= 1) {
    const part = job.data[i];
    if (
      typeof part === 'object' &&
      part !== null &&
      !Array.isArray(part) &&
      (part as { type?: string }).type === 'transcribe'
    ) {
      return String((part as { detail?: string }).detail ?? '');
    }
  }
  return '';
}

export function MeetingProgressPanel({ job }: { job: MeetingJob }) {
  const hasContent = jobHasDisplayableContent(job);

  if (job.status === 'completed') {
    if (job.error && !hasContent) {
      return (
        <p className="meeting-progress error" role="alert">
          {job.error}
        </p>
      );
    }
    if (job.serverJobId && !hasContent) {
      return (
        <p className="meeting-progress" role="status">
          正在載入會議紀要…
        </p>
      );
    }
    return (
      <p className="meeting-progress done" role="status">
        會議紀要已生成
      </p>
    );
  }

  if (job.status === 'failed') {
    return (
      <p className="meeting-progress error" role="alert">
        {job.error ?? '處理失敗'}
      </p>
    );
  }

  const phase = latestPhase(job);
  const detail = latestStreamDetail(job) || latestTranscribeDetail(job);
  const stepIndex = meetingPhaseStepIndex(phase);

  return (
    <div className="meeting-progress" role="status">
      <p className="meeting-progress-title">
        {phase ? meetingPhaseLabel(phase) : '處理中…'}
      </p>
      {detail ? <p className="meeting-progress-detail">{detail}</p> : null}
      <ol className="meeting-phase-steps">
        {['上傳', '轉錄', '摘要', '完成'].map((label, index) => (
          <li
            key={label}
            className={
              index < stepIndex
                ? 'done'
                : index === stepIndex
                  ? 'active'
                  : undefined
            }
          >
            {label}
          </li>
        ))}
      </ol>
      <p className="meeting-progress-file">{job.fileName}</p>
    </div>
  );
}

