import type { JSONValue } from 'ai';

import { meetingPhaseLabel } from './meeting-status';

export type WorkerJobStatusPayload = {
  status: string;
  phase?: string;
  detail?: string;
  error?: string;
};

function isRecord(value: JSONValue): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractWorkerJobIdFromJobData(
  data: JSONValue[],
): string | undefined {
  for (const part of data) {
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'workerJob' &&
      typeof part.workerJobId === 'string'
    ) {
      return part.workerJobId;
    }
  }
  return undefined;
}

export function formatWorkerProgressDetail(
  status: WorkerJobStatusPayload,
): string {
  const phase = status.phase ?? status.status;
  const detail = status.detail?.trim() ?? '';

  if (status.status === 'queued' || phase === 'queued') {
    return detail || '排隊等待轉錄…';
  }

  const phaseLabel = meetingPhaseLabel(phase);
  if (detail) {
    return `${phaseLabel} — ${detail}`;
  }
  return phaseLabel;
}

/** Merge polled WhisperX worker status into job stream data for UI progress. */
export function mergeWorkerStatusIntoJobData(
  data: JSONValue[],
  status: WorkerJobStatusPayload,
): JSONValue[] {
  const phase = status.phase ?? status.status;
  const uiPhase =
    phase === 'queued' ? 'transcribing' : phase || 'transcribing';
  const detail = formatWorkerProgressDetail(status);

  const withoutPoll = data.filter(
    part => !(isRecord(part) && part.source === 'workerPoll'),
  );

  return [
    ...withoutPoll,
    { type: 'phase', phase: uiPhase, source: 'workerPoll' },
    {
      type: 'transcribe',
      phase,
      status: status.status,
      detail,
      source: 'workerPoll',
    },
  ];
}

export function latestWorkerPhaseFromJobData(data: JSONValue[]): string | null {
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const part = data[i];
    if (
      part !== undefined &&
      isRecord(part) &&
      part.type === 'transcribe' &&
      typeof part.phase === 'string' &&
      part.phase.trim()
    ) {
      return part.phase;
    }
  }
  return null;
}
