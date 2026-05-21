import { streamText } from 'ai';

import { getModel } from '@/ai/providers';
import {
  buildPromptWithAttachments,
  type PromptAttachment,
} from '@/prompt-attachments';
import { systemPrompt } from '@/prompt';

import { pptLog } from './log';
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
}: {
  prompt: string;
  slideCount?: number;
  pageTextPreset?: PptPageTextPreset;
  attachments?: PromptAttachment[];
  webContext?: string;
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

export function streamPptOutlineText(options: {
  prompt: string;
  slideCount?: number;
  pageTextPreset?: PptPageTextPreset;
  attachments?: PromptAttachment[];
  webContext?: string;
}) {
  const { system, prompt, slideCount, pageTextPreset } =
    buildOutlineStreamPrompt(options);
  pptLog(
    `LLM 串流大綱（約 ${slideCount} 頁｜文字量 ${resolvePptPageTextPreset(pageTextPreset)}）…`,
  );

  return streamText({
    model: getModel(),
    system,
    prompt,
    temperature: 0.35,
  });
}
