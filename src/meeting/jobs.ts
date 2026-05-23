import { mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const DEFAULT_MEETING_JOBS_DIR = path.join(tmpdir(), 'deep-research-meeting-jobs');

export function getMeetingJobsBaseDir(): string {
  const custom = process.env.MEETING_OUTPUT_DIR?.trim();
  if (custom) {
    return path.resolve(custom);
  }
  return DEFAULT_MEETING_JOBS_DIR;
}

export function resolveMeetingJobDir(jobId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    throw new Error('Invalid job id');
  }
  return path.join(getMeetingJobsBaseDir(), jobId);
}

export async function createMeetingJobDir(jobId: string): Promise<string> {
  const jobDir = resolveMeetingJobDir(jobId);
  await mkdir(jobDir, { recursive: true });
  return jobDir;
}

export async function writeMeetingJobJson(
  jobId: string,
  fileName: string,
  payload: unknown,
): Promise<void> {
  const jobDir = await createMeetingJobDir(jobId);
  await writeFile(
    path.join(jobDir, fileName),
    JSON.stringify(payload, null, 2),
    'utf-8',
  );
}

export async function readMeetingJobJson<T>(
  jobId: string,
  fileName: string,
): Promise<T | null> {
  try {
    const raw = await readFile(
      path.join(resolveMeetingJobDir(jobId), fileName),
      'utf-8',
    );
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
