import { readFile } from 'fs/promises';
import path from 'path';

import { contentDispositionAttachment } from '@/http-headers';
import { PPT_JOBS_DIR, resolvePptJobFile } from '@/ppt/jobs';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return Response.json({ error: 'jobId is required' }, { status: 400 });
  }

  let filePath: string;
  try {
    filePath = resolvePptJobFile(jobId);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }

  const relative = path.relative(PPT_JOBS_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return Response.json({ error: 'Invalid file path' }, { status: 400 });
  }

  try {
    const bytes = await readFile(filePath);
    return new Response(bytes, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition':
          contentDispositionAttachment('presentation.pptx'),
      },
    });
  } catch {
    return Response.json({ error: 'PPTX file not found' }, { status: 404 });
  }
}
