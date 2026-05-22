import { createDataStreamResponse } from 'ai';

import { runWithResearchModel } from '@/ai/model-context';
import { assertLlmConfigured } from '@/ai/providers';
import { resolveResearchModelId } from '@/ai/research-models';
import type { PromptAttachment } from '@/prompt-attachments';
import { createPptJobPaths, resolvePptJobDir } from '@/ppt/jobs';
import { resolveSlideImages } from '@/ppt/media/resolve-slide-images';
import { pptLog, pptLogError } from '@/ppt/log';
import { planPptContent, planPptContentBySlide } from '@/ppt/planner';
import { persistDeckPlan } from '@/ppt/persist-deck-plan';
import { countReadySlides } from '@/ppt/deck-plan-progress';
import { buildSkeletonDeckPlan } from '@/ppt/skeleton-deck-plan';
import { runPptExport } from '@/ppt/export/run-ppt-export';
import { outlineDeckSchema } from '@/ppt/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type PptGenerateRequestBody = {
  prompt?: string;
  outline?: unknown;
  model?: string;
  attachments?: PromptAttachment[];
  templateId?: string;
};

function previewUrlForJob(jobId: string) {
  return `/ppt/preview?jobId=${encodeURIComponent(jobId)}`;
}

export async function POST(req: Request) {
  let body: PptGenerateRequestBody;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return Response.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const outlineParse = outlineDeckSchema.safeParse(body.outline);
  if (!outlineParse.success) {
    return Response.json(
      { error: 'Invalid outline', message: outlineParse.error.message },
      { status: 400 },
    );
  }

  const modelId = resolveResearchModelId(body.model);
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.filter(
        (item): item is PromptAttachment =>
          Boolean(item?.name?.trim()) && Boolean(item?.text?.trim()),
      )
    : undefined;

  const outline = outlineParse.data;
  const outlineTitle = outline.title.trim() || '未命名簡報';
  const slideCount = outline.slides.length;
  pptLog(
    `開始生成內容：「${outlineTitle}」｜${slideCount} 頁｜模型 ${modelId}${
      attachments?.length ? `｜${attachments.length} 個附件` : ''
    }`,
  );

  try {
    assertLlmConfigured();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pptLogError('生成 API：', message);
    return Response.json({ error: 'LLM not configured', message }, { status: 503 });
  }

  return createDataStreamResponse({
    execute: async dataStream =>
      runWithResearchModel(modelId, async () => {
        const { jobId, outputPath } = await createPptJobPaths();
        const templateId = body.templateId?.trim() || 'default';
        const maxAttempts = 3;

        pptLog(`工作目錄 jobId=${jobId}`);
        dataStream.writeData({ type: 'job', jobId });
        dataStream.writeData({ type: 'phase', phase: 'generating' });
        dataStream.writeData({ type: 'attempt', n: 0, max: maxAttempts });

        const skeleton = buildSkeletonDeckPlan(outline, templateId);
        await persistDeckPlan(jobId, skeleton);
        dataStream.writeData({
          type: 'slideReady',
          jobId,
          readyCount: 0,
          total: slideCount,
        });

        const jobDir = resolvePptJobDir(jobId);

        let deckPlan = await planPptContentBySlide({
          prompt,
          outline,
          attachments,
          templateId,
          onSlideReady: async (partial, readyCount, total) => {
            const withMedia = await resolveSlideImages(partial, jobDir);
            await persistDeckPlan(jobId, withMedia);
            dataStream.writeData({
              type: 'slideReady',
              jobId,
              readyCount,
              total,
            });
          },
        });

        deckPlan = await resolveSlideImages(deckPlan, jobDir);

        dataStream.writeData({ type: 'phase', phase: 'validating' });

        let attempt = 0;
        let issues: { code: string; message: string }[] = [];
        let success = false;

        while (attempt < maxAttempts) {
          attempt += 1;
          dataStream.writeData({ type: 'attempt', n: attempt, max: maxAttempts });

          const result = await runPptExport({
            action: 'validate',
            plan: deckPlan,
          });

          if (result.success) {
            success = true;
            issues = [];
            pptLog(`驗證通過｜嘗試 ${attempt}/${maxAttempts}`);
            break;
          }

          issues = result.issues;
          pptLog(
            `驗證未過｜嘗試 ${attempt}/${maxAttempts}｜${issues.length} 個 issue`,
          );
          for (const issue of issues) {
            pptLog(`  · ${issue.message}`);
          }

          dataStream.writeData({ type: 'issues', items: issues });

          if (attempt < maxAttempts) {
            dataStream.writeData({ type: 'phase', phase: 'planning' });
            deckPlan = await planPptContent({
              prompt,
              outline,
              issues,
              attachments,
              templateId,
            });
            deckPlan = await resolveSlideImages(deckPlan, jobDir);
            await persistDeckPlan(jobId, deckPlan);
            dataStream.writeData({
              type: 'slideReady',
              jobId,
              readyCount: countReadySlides(deckPlan),
              total: slideCount,
            });
            dataStream.writeData({ type: 'phase', phase: 'validating' });
          }
        }

        if (success) {
          await persistDeckPlan(jobId, deckPlan);
          const previewUrl = previewUrlForJob(jobId);
          pptLog(`內容就緒｜${deckPlan.slides.length} 頁｜預覽 ${previewUrl}`);
          dataStream.writeData({ type: 'phase', phase: 'done' });
          dataStream.writeData({
            type: 'previewReady',
            jobId,
            previewUrl,
            slideCount: deckPlan.slides.length,
          });
        } else {
          pptLogError(
            `生成失敗｜驗證 ${attempt}/${maxAttempts} 次未通過｜${issues.length} 個 issue`,
          );
          dataStream.writeData({ type: 'phase', phase: 'failed' });
          dataStream.writeData({ type: 'issues', items: issues });
        }

        void outputPath;
      }),
    onError: error => {
      const message = error instanceof Error ? error.message : String(error);
      pptLogError('串流錯誤：', message);
      return message;
    },
  });
}
