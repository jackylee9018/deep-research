import { readFile } from 'fs/promises';
import path from 'path';

import {
  readMeetingJobJson,
  resolveMeetingJobDir,
} from '@/meeting/jobs';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    resolveMeetingJobDir(id);
  } catch {
    return Response.json({ error: 'Invalid job id' }, { status: 400 });
  }

  let markdown = '';
  try {
    markdown = await readFile(
      path.join(resolveMeetingJobDir(id), 'minutes.md'),
      'utf-8',
    );
  } catch {
    // minutes.md may not exist yet
  }

  const minutes = await readMeetingJobJson(id, 'minutes.json');
  const transcript = await readMeetingJobJson(id, 'transcript.json');

  if (!markdown && !minutes && !transcript) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  return Response.json({
    jobId: id,
    markdown,
    minutes,
    transcript,
  });
}
