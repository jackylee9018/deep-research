import { readFile, readdir } from 'fs/promises';
import path from 'path';

import { resolveMeetingJobDir } from './jobs';

export type JobSourceFile = {
  buffer: Buffer;
  fileName: string;
  ext: string;
};

export async function readMeetingJobSource(jobId: string): Promise<JobSourceFile> {
  const jobDir = resolveMeetingJobDir(jobId);

  try {
    const metaRaw = await readFile(path.join(jobDir, 'meta.json'), 'utf-8');
    const meta = JSON.parse(metaRaw) as { fileName?: string; ext?: string };
    const ext = meta.ext ?? '.mp3';
    const fileName = meta.fileName ?? `source${ext}`;
    const buffer = await readFile(path.join(jobDir, `source${ext}`));
    return { buffer, fileName, ext };
  } catch {
  }

  const entries = await readdir(jobDir);
  const sourceName = entries.find(name => name.startsWith('source.'));
  if (!sourceName) {
    throw new Error('找不到已上傳的音訊檔案');
  }
  const ext = path.extname(sourceName) || '.mp3';
  const buffer = await readFile(path.join(jobDir, sourceName));
  return { buffer, fileName: `audio${ext}`, ext };
}
