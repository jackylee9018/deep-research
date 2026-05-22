import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

import { runPptExport } from '@/ppt/export/run-ppt-export';
import { persistDeckPlan } from '@/ppt/persist-deck-plan';
import {
  resolvePptJobDeckPlan,
  resolvePptJobDir,
  resolvePptJobFile,
} from '@/ppt/jobs';
import { resolveSlideImages } from '@/ppt/media/resolve-slide-images';
import { deckPlanSchema } from '@/ppt/schemas';
import { pptLog, pptLogError } from '@/ppt/log';

export const runtime = 'nodejs';
export const maxDuration = 120;

type ExportBody = {
  jobId?: string;
  deckPlan?: unknown;
};

export async function POST(req: Request) {
  let body: ExportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  }

  let deckPlan;
  try {
    if (body.deckPlan != null) {
      deckPlan = await persistDeckPlan(jobId, body.deckPlan);
    } else {
      const raw = await readFile(resolvePptJobDeckPlan(jobId), 'utf8');
      deckPlan = deckPlanSchema.parse(JSON.parse(raw));
    }
  } catch {
    return NextResponse.json(
      { error: 'Deck plan not found for this job' },
      { status: 404 },
    );
  }

  deckPlan = await resolveSlideImages(deckPlan, resolvePptJobDir(jobId));

  const outputPath = resolvePptJobFile(jobId);
  pptLog(`匯出 PPTX｜jobId=${jobId}｜${deckPlan.slides.length} 頁`);

  const result = await runPptExport({
    action: 'generate',
    plan: deckPlan,
    outputPath,
  });

  if (!result.success) {
    pptLogError(`匯出失敗｜${result.issues.length} 個 issue`);
    return NextResponse.json(
      {
        error: 'Export failed',
        issues: result.issues,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    jobId,
    downloadUrl: `/api/ppt/download?jobId=${encodeURIComponent(jobId)}`,
    slideCount: result.slide_count ?? deckPlan.slides.length,
    filePath: result.file_path ?? outputPath,
  });
}
