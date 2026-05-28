const DEFAULT_WORKER_URL = 'http://127.0.0.1:8091';

export function getWhisperxWorkerUrl(): string {
  return (
    process.env.WHISPERX_WORKER_URL?.trim().replace(/\/+$/, '') ||
    DEFAULT_WORKER_URL
  );
}

export function getMeetingMaxFileBytes(): number {
  const mb = Number(process.env.MEETING_MAX_FILE_MB ?? '200');
  if (!Number.isFinite(mb) || mb <= 0) {
    return 200 * 1024 * 1024;
  }
  return mb * 1024 * 1024;
}

export function getMeetingPollIntervalMs(): number {
  const ms = Number(process.env.MEETING_POLL_INTERVAL_MS ?? '2000');
  return Number.isFinite(ms) && ms > 500 ? ms : 2000;
}

export function getMeetingPollTimeoutMs(): number {
  const ms = Number(process.env.MEETING_POLL_TIMEOUT_MS ?? '7200000');
  return Number.isFinite(ms) && ms > 60_000 ? ms : 7_200_000;
}

/** Per-batch LLM timeout for transcript punctuation (OpenRouter can exceed 2 min). */
export function getMeetingPunctuateTimeoutMs(): number {
  const ms = Number(process.env.MEETING_PUNCTUATE_TIMEOUT_MS ?? '300000');
  return Number.isFinite(ms) && ms >= 30_000 ? ms : 300_000;
}
