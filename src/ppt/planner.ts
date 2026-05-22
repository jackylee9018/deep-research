import { generateObject } from '@/ai/generate-object';
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
  resolvePptPageTextPreset,
  type PptPageTextPreset,
} from './page-text';
import { z } from 'zod';

import {
  buildDeckPlan,
  deckPlanGenerationSchema,
  deckSlideGenerationSchema,
  normalizeOutlineDeck,
  outlineDeckGenerationSchema,
} from './normalize';
import { compositionCatalogPromptForOutline } from './composition/load-catalog';
import { refineOutlineCompositions } from './composition/refine-outline';
import {
  pptLayoutCatalogPrompt,
  type DeckPlan,
  type OutlineDeck,
  type ValidationIssue,
} from './schemas';

function slideLockPrompt(outline: OutlineDeck) {
  return outline.slides
    .map(
      slide =>
        `${slide.index}. ${slide.compositionId ?? slide.layoutId} (${slide.layoutId}): ${slide.headline}`,
    )
    .join('\n');
}

export async function planPptOutline({
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
}): Promise<OutlineDeck> {
  const fullPrompt = buildPromptWithAttachments(prompt, attachments);
  const webSection = webContext?.trim()
    ? `\n\n## 網路研究筆記\n${webContext.trim()}\n`
    : '';

  const textPreset = resolvePptPageTextPreset(pageTextPreset);
  const pageTextRules = pptPageTextPromptRules(textPreset);
  pptLog(`LLM 產生大綱（約 ${slideCount} 頁｜文字量 ${textPreset}）…`);
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Create a presentation outline in Traditional Chinese.

User request:
${fullPrompt}
${webSection}
Composition catalog (XML). For EACH slide you MUST pick exactly one compositionId:
${compositionCatalogPromptForOutline()}

Content field limits (layoutId families):
${pptLayoutCatalogPrompt()}

Rules:
- Create ${Math.min(Math.max(slideCount, 3), 15)} slides unless the request clearly needs fewer or more.
- Return compositionId per slide (required). layoutId is optional (derived from catalog).
- Vary compositions across the deck — avoid using bullets_standard on every body slide.
- For slides that benefit from a photo or diagram, set media: { enabled: true, brief: "english search keywords" } and pick bullets_photo_right or bullets_photo_left.
- Omit media or set media.enabled false when text-only is clearer (dense lists, quotes, stats).
- Keep each slide headline concrete and concise.
- bulletSummary should describe what belongs on the slide, not final polished copy.
${pageTextRules}
- Narrative flow: opening (problem/goal) → body (analysis/solution/evidence) → closing (actions/conclusion).
${
  webContext?.trim()
    ? `- When web research notes are provided: prefer facts supported by sources; do not invent statistics, dates, or company figures. Generalize or mark as "待查證" when uncertain.
- If PDF attachments conflict with web notes, follow the attachments.
`
    : ''
}- Return JSON only.`,
    schema: outlineDeckGenerationSchema,
    temperature: 0.3,
  });

  const outline = refineOutlineCompositions(normalizeOutlineDeck(res.object));
  pptLog(
    `LLM 大綱就緒：${outline.slides.length} 頁｜構圖 ${outline.slides.map(s => s.compositionId).join(', ')}`,
  );
  return outline;
}

const singleSlideGenerationSchema = z.object({
  slide: deckSlideGenerationSchema,
});

export async function planPptContentBySlide({
  prompt,
  outline,
  issues = [],
  attachments,
  templateId = 'default',
  onSlideReady,
}: {
  prompt: string;
  outline: OutlineDeck;
  issues?: ValidationIssue[];
  attachments?: PromptAttachment[];
  templateId?: string;
  onSlideReady?: (
    deckPlan: DeckPlan,
    readyCount: number,
    total: number,
  ) => void | Promise<void>;
}): Promise<DeckPlan> {
  const fullPrompt = buildPromptWithAttachments(prompt, attachments);
  const total = outline.slides.length;
  const completed: z.infer<typeof deckSlideGenerationSchema>[] = [];

  pptLog(`LLM 逐頁產生內容（${total} 頁）…`);

  for (const outlineSlide of outline.slides) {
    const prior = completed
      .map((s, i) => `${i + 1}. ${s.title ?? outline.slides[i]?.headline}`)
      .join('\n');

    const res = await generateObject({
      model: getModel(),
      system: systemPrompt(),
      prompt: `Write ONE presentation slide in Traditional Chinese (slide ${outlineSlide.index} of ${total}).

User request:
${fullPrompt}

Outline slide (locked compositionId and layoutId):
${JSON.stringify(outlineSlide, null, 2)}

Prior slides already written:
${prior || '(none yet)'}

Layout limits:
${pptLayoutCatalogPrompt()}

Rules:
- Return exactly one slide object matching index ${outlineSlide.index}.
- Do not change layoutId.
- Fill layout-specific fields (quote, value, bullets, etc.).
- Keep within schema character limits.
- Validation issues to avoid: ${issues.length ? JSON.stringify(issues) : 'none'}`,
      schema: singleSlideGenerationSchema,
      temperature: 0.25,
    });

    completed.push({
      ...res.object.slide,
      index: outlineSlide.index,
      layoutId: outlineSlide.layoutId,
    });

    const deckPlan = buildDeckPlan(
      outline,
      {
        slides: outline.slides.map((os, idx) =>
          completed[idx] ?? {
            index: os.index,
            layoutId: os.layoutId,
            title: os.headline,
          },
        ),
      },
      templateId,
    );

    pptLog(`  頁 ${outlineSlide.index}/${total} 就緒`);
    await onSlideReady?.(deckPlan, completed.length, total);
  }

  pptLog(`LLM 逐頁內容完成｜模板 ${templateId}`);
  return buildDeckPlan(outline, { slides: completed }, templateId);
}

export async function planPptContent({
  prompt,
  outline,
  issues,
  attachments,
  templateId = 'default',
}: {
  prompt: string;
  outline: OutlineDeck;
  issues: ValidationIssue[];
  attachments?: PromptAttachment[];
  templateId?: string;
}): Promise<DeckPlan> {
  const fullPrompt = buildPromptWithAttachments(prompt, attachments);
  pptLog(
    `LLM 規劃簡報內容（${outline.slides.length} 頁）${
      issues.length ? `｜修正 ${issues.length} 個 issue` : ''
    }…`,
  );
  const issueText = issues.length
    ? issues
        .map(issue => {
          const target = [
            issue.slideIndex ? `slide ${issue.slideIndex}` : undefined,
            issue.field,
            issue.code,
          ]
            .filter(Boolean)
            .join(' / ');
          return `- ${target}: ${issue.message}${
            issue.suggestedAction
              ? ` Suggested action: ${issue.suggestedAction}`
              : ''
          }`;
        })
        .join('\n')
    : 'No previous validation issues.';

  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Turn the confirmed outline into final presentation content in Traditional Chinese.

Original user request:
${fullPrompt}

Confirmed outline. Keep slide count, slide index, compositionId, and layoutId unchanged:
${JSON.stringify(outline, null, 2)}

Slide lock summary:
${slideLockPrompt(outline)}

Layout limits:
${pptLayoutCatalogPrompt()}

Validation feedback from the previous attempt:
${issueText}

Rules:
- Return one slide object per outline slide, in the same order, with matching index values.
- Do not add, remove, reorder, or change layoutId / compositionId for any slide.
- Fill fields required by each layoutId (quote layout needs "quote"; stat needs "value"; etc.).
- Keep all text within the schema limits.
- If there are validation issues, fix only the affected slide content unless a nearby wording adjustment is necessary.
- Use clear business presentation language, not verbose report prose.
- Return JSON with a top-level "slides" array only. Do not include outline metadata.`,
    schema: deckPlanGenerationSchema,
    temperature: 0.25,
  });

  const deckPlan = buildDeckPlan(outline, res.object, templateId);
  pptLog(`LLM 內容就緒：${deckPlan.slides.length} 頁｜模板 ${deckPlan.templateId ?? templateId}`);
  return deckPlan;
}
