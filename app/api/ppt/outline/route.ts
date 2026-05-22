import { createDataStreamResponse } from 'ai';

import { runWithResearchModel } from '@/ai/model-context';
import { assertLlmConfigured, getLlmEnvStatus } from '@/ai/providers';
import { resolveResearchModelId } from '@/ai/research-models';
import type { PromptAttachment } from '@/prompt-attachments';
import { SearchAuthError } from '@/search';
import { outlineFromFreeFormatText } from '@/ppt/outline-from-text';
import {
  gatherOutlineWebContext,
  OutlineWebSearchUnavailableError,
} from '@/ppt/outline-web-context';
import { pptLog, pptLogError } from '@/ppt/log';
import {
  DEFAULT_PPT_OUTLINE_SLIDE_COUNT,
  resolvePptPageTextPreset,
  type PptPageTextPreset,
} from '@/ppt/page-text';
import { streamPptOutlineText } from '@/ppt/stream-outline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type PptOutlineRequestBody = {
  prompt?: string;
  /** @deprecated Use pageTextPreset; kept for older clients. */
  slideCount?: number;
  pageTextPreset?: PptPageTextPreset;
  templateId?: string;
  model?: string;
  attachments?: PromptAttachment[];
  webSearch?: boolean;
};

export async function POST(req: Request) {
  let body: PptOutlineRequestBody;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return Response.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const slideCount = Math.min(
    Math.max(body.slideCount ?? DEFAULT_PPT_OUTLINE_SLIDE_COUNT, 3),
    15,
  );
  const pageTextPreset = resolvePptPageTextPreset(body.pageTextPreset);
  const templateId = body.templateId?.trim() || 'default';
  const modelId = resolveResearchModelId(body.model);
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.filter(
        (item): item is PromptAttachment =>
          Boolean(item?.name?.trim()) && Boolean(item?.text?.trim()),
      )
    : undefined;

  pptLog(
    `開始產生大綱（串流）｜模型 ${modelId}｜約 ${slideCount} 頁｜文字量 ${pageTextPreset}｜模板 ${templateId}${
      body.webSearch ? '｜聯網搜尋' : ''
    }${attachments?.length ? `｜${attachments.length} 個附件` : ''}`,
  );
  pptLog(`需求摘要：${prompt.slice(0, 120)}${prompt.length > 120 ? '…' : ''}`);

  try {
    assertLlmConfigured();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pptLogError('大綱 API：', message);
    return Response.json({ error: 'LLM not configured', message }, { status: 503 });
  }

  return createDataStreamResponse({
    execute: async dataStream =>
      runWithResearchModel(modelId, async () => {
        let webContext: string | undefined;

        if (body.webSearch) {
          dataStream.writeData({
            type: 'status',
            message: '聯網搜尋中…',
          });
          pptLog('聯網搜尋中…');
          const web = await gatherOutlineWebContext(prompt);
          webContext = web.context;
          pptLog(`聯網搜尋完成（約 ${webContext.length} 字元筆記）`);
        }

        dataStream.writeData({
          type: 'status',
          message: '正在撰寫大綱…',
        });
        pptLog('LLM 串流大綱中…');

        const { stream, resolveFullText } = streamPptOutlineText({
          prompt,
          slideCount,
          pageTextPreset,
          templateId,
          attachments,
          webContext,
        });

        stream.mergeIntoDataStream(dataStream);

        const fullText = await resolveFullText();
        const outline = outlineFromFreeFormatText(prompt, fullText, slideCount);

        pptLog(
          `大綱完成：「${outline.title.trim() || '未命名'}」｜${outline.slides.length} 頁`,
        );

        dataStream.writeData({ type: 'outline', outline });
      }),
    onError: error => {
      const message = error instanceof Error ? error.message : String(error);
      pptLogError('大綱串流錯誤：', message);
      if (error instanceof OutlineWebSearchUnavailableError) {
        return '聯網搜尋未設定。請在環境變數設定 TAVILY_API_KEY，或關閉聯網後再試。';
      }
      if (error instanceof SearchAuthError) {
        return (
          '聯網搜尋 API key 無效。請到 tavily.com 確認 TAVILY_API_KEY 是否正確、未過期，' +
          '更新 .env 後重新執行 npm run dev:web；或關閉「聯網搜尋」後再產生大綱。'
        );
      }
      if (/unauthorized|invalid api key|missing.*api key/i.test(message)) {
        const status = getLlmEnvStatus();
        if (!status.configured) {
          return (
            'LLM API key 未載入到 Next.js 程序。請確認 .env 內有 OPENROUTER_API_KEY，' +
            '並用 npm run dev:web 重新啟動（腳本會載入 .env）。' +
            '開啟 /api/app-config 檢查 llmConfigured。'
          );
        }
        return (
          'OpenRouter 回傳 API key 無效。請到 openrouter.ai 確認金鑰是否有效、' +
          '是否有餘額，且變數名稱為 OPENROUTER_API_KEY（不是 OPENAI_API_KEY）。'
        );
      }
      return message;
    },
  });
}
