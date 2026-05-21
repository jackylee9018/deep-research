import { createDataStreamResponse } from 'ai';

import { runWithResearchModel } from '@/ai/model-context';
import { assertLlmConfigured } from '@/ai/providers';
import { resolveResearchModelId } from '@/ai/research-models';
import type { PromptAttachment } from '@/prompt-attachments';
import { buildPptGraph } from '@/ppt/graph/build-graph';
import { createPptJobPaths } from '@/ppt/jobs';
import { pptLog, pptLogError } from '@/ppt/log';
import { outlineDeckSchema } from '@/ppt/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type PptGenerateRequestBody = {
  prompt?: string;
  outline?: unknown;
  model?: string;
  attachments?: PromptAttachment[];
};

function phaseForNode(nodeName: string) {
  if (nodeName === 'contentPlanner') {
    return 'planning';
  }
  if (nodeName === 'generatePptx') {
    return 'generating';
  }
  if (nodeName === 'validate') {
    return 'validating';
  }
  return 'planning';
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

  const outlineTitle = outlineParse.data.title.trim() || '未命名簡報';
  const slideCount = outlineParse.data.slides.length;
  pptLog(
    `開始生成：「${outlineTitle}」｜${slideCount} 頁｜模型 ${modelId}${
      attachments?.length ? `｜${attachments.length} 個附件` : ''
    }`,
  );
  pptLog(`需求摘要：${prompt.slice(0, 120)}${prompt.length > 120 ? '…' : ''}`);

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
        pptLog(`工作目錄 jobId=${jobId}`);
        pptLog(`輸出路徑 ${outputPath}`);
        const graph = buildPptGraph();

        dataStream.writeData({ type: 'phase', phase: 'planning' });
        dataStream.writeData({ type: 'attempt', n: 0, max: 3 });

        let finalState: Record<string, any> = {
          userPrompt: prompt,
          attachments,
          confirmedOutline: outlineParse.data,
          attempt: 0,
          maxAttempts: 3,
          issues: [],
          success: false,
          outputPath,
        };

        const stream = await graph.stream(
          {
            userPrompt: prompt,
            attachments,
            confirmedOutline: outlineParse.data,
            attempt: 0,
            maxAttempts: 3,
            issues: [],
            success: false,
            outputPath,
          },
          { streamMode: 'updates' },
        );

        for await (const update of stream) {
          const entries = Object.entries(
            update as Record<string, Record<string, unknown>>,
          );
          for (const [nodeName, nodeUpdate] of entries) {
            finalState = { ...finalState, ...nodeUpdate };
            const phase = phaseForNode(nodeName);
            const attempt =
              typeof nodeUpdate.attempt === 'number'
                ? nodeUpdate.attempt
                : undefined;
            const issues = Array.isArray(nodeUpdate.issues)
              ? nodeUpdate.issues
              : [];
            const nodeSuccess =
              typeof nodeUpdate.success === 'boolean'
                ? nodeUpdate.success
                : undefined;

            pptLog(
              `節點完成：${nodeName} → ${phase}` +
                (attempt != null ? `｜嘗試 ${attempt}/3` : '') +
                (nodeSuccess != null ? `｜success=${nodeSuccess}` : '') +
                (issues.length ? `｜${issues.length} 個 issue` : ''),
            );
            for (const issue of issues) {
              if (
                issue &&
                typeof issue === 'object' &&
                'message' in issue &&
                typeof issue.message === 'string'
              ) {
                pptLog(`  · ${issue.message}`);
              }
            }
            if (
              typeof nodeUpdate.error === 'string' &&
              nodeUpdate.error.trim()
            ) {
              pptLog(`  錯誤：${nodeUpdate.error}`);
            }
            if (typeof nodeUpdate.filePath === 'string') {
              pptLog(`  檔案：${nodeUpdate.filePath}`);
            }

            dataStream.writeData({
              type: 'phase',
              phase,
            });
            dataStream.writeData({
              type: 'log',
              message: `${nodeName} completed`,
            });

            if (attempt != null) {
              dataStream.writeData({
                type: 'attempt',
                n: attempt,
                max: 3,
              });
            }

            if (issues.length) {
              dataStream.writeData({
                type: 'issues',
                items: issues,
              });
            }

            if (
              nodeName === 'validate' &&
              nodeUpdate.success === true &&
              typeof nodeUpdate.slideCount === 'number'
            ) {
              dataStream.writeData({
                type: 'complete',
                downloadUrl: `/api/ppt/download?jobId=${encodeURIComponent(jobId)}`,
                slideCount: nodeUpdate.slideCount,
              });
            }
          }
        }

        if (finalState.success && finalState.filePath) {
          const slides =
            finalState.slideCount ?? outlineParse.data.slides.length;
          pptLog(
            `生成成功｜${slides} 頁｜下載 /api/ppt/download?jobId=${jobId}`,
          );
          dataStream.writeData({ type: 'phase', phase: 'done' });
          dataStream.writeData({
            type: 'complete',
            downloadUrl: `/api/ppt/download?jobId=${encodeURIComponent(jobId)}`,
            slideCount: slides,
          });
        } else {
          const issues = Array.isArray(finalState.issues)
            ? finalState.issues
            : [];
          pptLogError(
            `生成失敗｜最終嘗試 ${finalState.attempt ?? '?'}/3｜${issues.length} 個 issue`,
          );
          for (const issue of issues) {
            if (issue?.message) {
              pptLogError(`  · ${issue.message}`);
            }
          }
          dataStream.writeData({ type: 'phase', phase: 'failed' });
          dataStream.writeData({ type: 'issues', items: finalState.issues });
        }
      }),
    onError: error => {
      const message = error instanceof Error ? error.message : String(error);
      pptLogError('串流錯誤：', message);
      if (error instanceof Error && error.stack) {
        pptLogError(error.stack);
      }
      return message;
    },
  });
}
