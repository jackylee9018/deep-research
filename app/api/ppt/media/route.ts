import { access, readFile } from 'fs/promises';
import { NextResponse } from 'next/server';

import { resolvePptJobSlideImage } from '@/ppt/jobs';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId')?.trim();
  const slideRaw = url.searchParams.get('slide')?.trim();
  const slideIndex = slideRaw ? Number(slideRaw) : NaN;

  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  }
  if (!Number.isFinite(slideIndex) || slideIndex < 1) {
    return NextResponse.json({ error: 'Invalid slide index' }, { status: 400 });
  }

  const filePath = resolvePptJobSlideImage(jobId, slideIndex);
  try {
    await access(filePath);
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const bytes = await readFile(filePath);
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
