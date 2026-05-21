import { mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

export const PPT_JOBS_DIR = path.join(tmpdir(), 'deep-research-ppt-jobs');

export async function createPptJobPaths() {
  const jobId = crypto.randomUUID();
  const jobDir = path.join(PPT_JOBS_DIR, jobId);
  await mkdir(jobDir, { recursive: true });

  return {
    jobId,
    jobDir,
    outputPath: path.join(jobDir, 'deck.pptx'),
  };
}

export function resolvePptJobFile(jobId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    throw new Error('Invalid job id');
  }

  return path.join(PPT_JOBS_DIR, jobId, 'deck.pptx');
}
