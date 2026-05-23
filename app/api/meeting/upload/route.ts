import { writeFile } from 'fs/promises';
import path from 'path';

import {
  isMeetingAudioFile,
  meetingAudioExtension,
} from '@/meeting/audio-upload';
import { getMeetingMaxFileBytes } from '@/meeting/config';
import { createMeetingJobDir } from '@/meeting/jobs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Audio file is required' }, { status: 400 });
  }

  if (!isMeetingAudioFile(file)) {
    return Response.json(
      { error: '僅支援 MP3、WAV、M4A 音訊檔案' },
      { status: 400 },
    );
  }

  const maxBytes = getMeetingMaxFileBytes();
  if (file.size > maxBytes) {
    return Response.json(
      {
        error: `音訊檔不得超過 ${Math.round(maxBytes / (1024 * 1024))} MB`,
      },
      { status: 400 },
    );
  }

  const jobId = crypto.randomUUID();
  const ext = meetingAudioExtension(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const jobDir = await createMeetingJobDir(jobId);

  await writeFile(path.join(jobDir, `source${ext}`), buffer);
  await writeFile(
    path.join(jobDir, 'meta.json'),
    JSON.stringify({ fileName: file.name, ext }, null, 2),
    'utf-8',
  );

  return Response.json({ jobId, fileName: file.name, ext, size: file.size });
}
