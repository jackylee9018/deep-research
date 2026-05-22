import { access, readFile } from 'fs/promises';
import { NextResponse } from 'next/server';

import {
  countReadySlides,
  isDeckContentReady,
} from '@/ppt/deck-plan-progress';
import { resolvePptJobDeckPlan, resolvePptJobFile } from '@/ppt/jobs';
import { persistDeckPlan } from '@/ppt/persist-deck-plan';
import { deckPlanSchema } from '@/ppt/schemas';

export const runtime = 'nodejs';

type PatchBody = {
  jobId?: string;
  deckPlan?: unknown;
};

export async function PATCH(req: Request) {
  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  }

  if (body.deckPlan == null) {
    return NextResponse.json({ error: 'deckPlan is required' }, { status: 400 });
  }

  try {
    const deckPlan = await persistDeckPlan(jobId, body.deckPlan);
    return NextResponse.json({ jobId, deckPlan });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId')?.trim();

  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  }

  let deckPlan;
  try {
    const raw = await readFile(resolvePptJobDeckPlan(jobId), 'utf8');
    deckPlan = deckPlanSchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: 'Preview not available for this job' },
      { status: 404 },
    );
  }

  let pptxAvailable = false;
  try {
    await access(resolvePptJobFile(jobId));
    pptxAvailable = true;
  } catch {
    // deck plan may exist without pptx
  }

  const readyCount = countReadySlides(deckPlan);
  const contentReady = isDeckContentReady(deckPlan);

  return NextResponse.json({
    jobId,
    deckPlan,
    downloadUrl: `/api/ppt/download?jobId=${encodeURIComponent(jobId)}`,
    slideCount: deckPlan.slides.length,
    readyCount,
    contentReady,
    pptxAvailable,
  });
}
