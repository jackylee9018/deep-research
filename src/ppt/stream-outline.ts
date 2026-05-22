import { streamText, type StreamTextResult } from 'ai';

import { getModel } from '@/ai/providers';
import {
  buildPromptWithAttachments,
  type PromptAttachment,
} from '@/prompt-attachments';
import { systemPrompt } from '@/prompt';

import { pptOutlineDesignRules } from './design-guidelines';
import { pptLog, pptLogWarn } from './log';
import {
  DEFAULT_PPT_OUTLINE_SLIDE_COUNT,
  pptPageTextPromptRules,
  pptPageTextParams,
  resolvePptPageTextPreset,
  type PptPageTextPreset,
} from './page-text';
import { pptLayoutCatalogPrompt } from './schemas';

export function buildOutlineStreamPrompt({
  prompt,
  slideCount = DEFAULT_PPT_OUTLINE_SLIDE_COUNT,
  pageTextPreset,
  attachments,
  webContext,
  templateId = 'default',
}: {
  prompt: string;
  slideCount?: number;
  pageTextPreset?: PptPageTextPreset;
  attachments?: PromptAttachment[];
  webContext?: string;
  templateId?: string;
}) {
  const fullPrompt = buildPromptWithAttachments(prompt, attachments);
  const webSection = webContext?.trim()
    ? `\n\n## 網路研究筆記\n${webContext.trim()}\n`
    : '';
  const count = Math.min(Math.max(slideCount, 3), 15);
  const textPreset = resolvePptPageTextPreset(pageTextPreset);
  const { maxBulletsPerSlide } = pptPageTextParams(textPreset);
  const pageTextRules = pptPageTextPromptRules(textPreset);

  return {
    system: systemPrompt(),
    prompt: `Write a presentation outline in Traditional Chinese as plain text (NOT JSON).

User request:
${fullPrompt}
${webSection}

Available slide layout types (for your planning only — do not output layout ids):
${pptLayoutCatalogPrompt()}

Format rules:
- Write exactly ${count} slides unless the topic clearly needs fewer (minimum 3) or more (maximum 15).
- Separate each slide with one blank line.
- First line of each slide: concise headline (no bullet prefix, no numbering).
- Following lines: bullet points, each starting with "• ".
${pageTextRules}
${pptOutlineDesignRules(templateId)}
- First slide: cover/title for the presentation.
- Last slide: closing / summary / next steps.
- Narrative: opening → body → closing.
${
  webContext?.trim()
    ? `- Prefer facts from web notes; mark uncertain claims as「待查證」.
- If PDF attachments conflict with web notes, follow the attachments.
`
    : ''
}- Use clear business language. No markdown headings, no code fences, no JSON.`,
    slideCount: count,
    maxBulletsPerSlide,
    pageTextPreset: textPreset,
  };
}

/** Max wait before the first stream chunk (TTFT); slow OpenRouter models often need >5s. */
const DEFAULT_OUTLINE_STREAM_FIRST_BYTE_MS = 120_000;
/** Max gap between text chunks after output has started (stuck SSE without [DONE]). */
const DEFAULT_OUTLINE_STREAM_IDLE_MS = 30_000;

function parsePositiveMs(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw?.trim()) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function outlineStreamFirstByteMs(): number {
  return parsePositiveMs(
    process.env.PPT_OUTLINE_STREAM_FIRST_BYTE_MS?.trim(),
    DEFAULT_OUTLINE_STREAM_FIRST_BYTE_MS,
  );
}

function outlineStreamIdleMs(): number {
  return parsePositiveMs(
    process.env.PPT_OUTLINE_STREAM_IDLE_MS?.trim(),
    DEFAULT_OUTLINE_STREAM_IDLE_MS,
  );
}

export type PptOutlineTextStream = StreamTextResult<
  Record<string, never>,
  never
>;

/** Wraps streamText so a provider that never closes SSE still yields full text. */
export function streamPptOutlineText(options: {
  prompt: string;
  slideCount?: number;
  pageTextPreset?: PptPageTextPreset;
  attachments?: PromptAttachment[];
  webContext?: string;
  templateId?: string;
}): {
  stream: PptOutlineTextStream;
  resolveFullText: () => Promise<string>;
} {
  const { system, prompt, slideCount, pageTextPreset } =
    buildOutlineStreamPrompt(options);
  pptLog(
    `LLM 串流大綱（約 ${slideCount} 頁｜文字量 ${resolvePptPageTextPreset(pageTextPreset)}）…`,
  );

  const firstByteMs = outlineStreamFirstByteMs();
  const idleMs = outlineStreamIdleMs();
  const abortController = new AbortController();
  let bufferedText = '';
  let firstByteTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let hasReceivedChunk = false;
  let hasReceivedText = false;
  let abortReason: 'first-byte' | 'idle' | undefined;

  const clearFirstByteTimer = () => {
    if (firstByteTimer !== undefined) {
      clearTimeout(firstByteTimer);
      firstByteTimer = undefined;
    }
  };

  const clearIdleTimer = () => {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  };

  const clearAllTimers = () => {
    clearFirstByteTimer();
    clearIdleTimer();
  };

  const scheduleFirstByteAbort = () => {
    clearFirstByteTimer();
    firstByteTimer = setTimeout(() => {
      if (abortController.signal.aborted || hasReceivedChunk) {
        return;
      }
      abortReason = 'first-byte';
      pptLogWarn(
        `大綱串流已 ${firstByteMs}ms 仍無任何回應，結束等待（模型可能過慢或未回傳）`,
      );
      abortController.abort();
    }, firstByteMs);
  };

  const scheduleIdleAbort = () => {
    if (!hasReceivedText) {
      return;
    }
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      if (abortController.signal.aborted) {
        return;
      }
      abortReason = 'idle';
      pptLogWarn(
        `串流已 ${idleMs}ms 無新文字，結束等待（模型可能未送出結束訊號；已緩衝 ${bufferedText.length} 字元）`,
      );
      abortController.abort();
    }, idleMs);
  };

  const stream = streamText({
    model: getModel(),
    system,
    prompt,
    temperature: 0.35,
    abortSignal: abortController.signal,
    onChunk: ({ chunk }) => {
      if (!hasReceivedChunk) {
        hasReceivedChunk = true;
        clearFirstByteTimer();
      }
      if (chunk.type === 'text-delta') {
        hasReceivedText = true;
        bufferedText += chunk.textDelta;
        scheduleIdleAbort();
      }
    },
  });

  scheduleFirstByteAbort();

  const resolveFullText = async (): Promise<string> => {
    try {
      const text = await stream.text;
      clearAllTimers();
      return text.trim() ? text : bufferedText;
    } catch (error) {
      clearAllTimers();
      if (bufferedText.trim() && abortReason === 'idle') {
        return bufferedText;
      }
      if (abortReason === 'first-byte' && !bufferedText.trim()) {
        throw new Error(
          `大綱產生逾時：模型在 ${Math.round(firstByteMs / 1000)} 秒內未開始輸出。可改選較快模型、縮短需求，或於 .env 調高 PPT_OUTLINE_STREAM_FIRST_BYTE_MS。`,
        );
      }
      if (abortReason === 'idle' && !bufferedText.trim()) {
        throw new Error(
          `大綱產生逾時：串流在 ${Math.round(idleMs / 1000)} 秒內無新文字。可調高 PPT_OUTLINE_STREAM_IDLE_MS 後重試。`,
        );
      }
      throw error;
    }
  };

  return { stream, resolveFullText };
}
