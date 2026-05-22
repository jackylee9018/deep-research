import { mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const DEFAULT_PPT_JOBS_DIR = path.join(tmpdir(), 'deep-research-ppt-jobs');

/** Default temp jobs directory when `PPT_OUTPUT_DIR` is unset. */
export const PPT_JOBS_DIR = DEFAULT_PPT_JOBS_DIR;

/** Root directory for job folders (`{base}/{jobId}/deck.pptx`). Uses `PPT_OUTPUT_DIR` when set. */
export function getPptJobsBaseDir(): string {
  const custom = process.env.PPT_OUTPUT_DIR?.trim();
  if (custom) {
    return path.resolve(custom);
  }
  return DEFAULT_PPT_JOBS_DIR;
}

export function isPptOutputDirConfigured(): boolean {
  return Boolean(process.env.PPT_OUTPUT_DIR?.trim());
}

export async function createPptJobPaths() {
  const jobId = crypto.randomUUID();
  const jobDir = path.join(getPptJobsBaseDir(), jobId);
  await mkdir(jobDir, { recursive: true });

  return {
    jobId,
    jobDir,
    outputPath: path.join(jobDir, 'deck.pptx'),
  };
}

export const PPT_DECK_PLAN_FILENAME = 'deck-plan.json';

export function resolvePptJobDir(jobId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    throw new Error('Invalid job id');
  }

  return path.join(getPptJobsBaseDir(), jobId);
}

export function resolvePptJobFile(jobId: string) {
  return path.join(resolvePptJobDir(jobId), 'deck.pptx');
}

export function resolvePptJobDeckPlan(jobId: string) {
  return path.join(resolvePptJobDir(jobId), PPT_DECK_PLAN_FILENAME);
}

export function resolvePptJobMediaDir(jobId: string) {
  return path.join(resolvePptJobDir(jobId), 'media');
}

export function resolvePptJobSlideImage(jobId: string, slideIndex: number) {
  return path.join(resolvePptJobMediaDir(jobId), `slide-${slideIndex}.jpg`);
}
