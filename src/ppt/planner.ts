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
import {
  buildDeckPlan,
  deckPlanGenerationSchema,
  normalizeOutlineDeck,
  outlineDeckGenerationSchema,
} from './normalize';
import {
  pptLayoutCatalogPrompt,
  type DeckPlan,
  type OutlineDeck,
  type ValidationIssue,
} from './schemas';

function slideLockPrompt(outline: OutlineDeck) {
  return outline.slides
    .map(slide => `${slide.index}. ${slide.layoutId}: ${slide.headline}`)
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
Use these layouts only:
${pptLayoutCatalogPrompt()}

Rules:
- Create ${Math.min(Math.max(slideCount, 3), 15)} slides unless the request clearly needs fewer or more.
- The first slide should usually use "title".
- The final slide should usually use "closing".
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

  const outline = normalizeOutlineDeck(res.object);
  pptLog(`LLM 大綱就緒：${outline.slides.length} 頁`);
  return outline;
}

export async function planPptContent({
  prompt,
  outline,
  issues,
  attachments,
}: {
  prompt: string;
  outline: OutlineDeck;
  issues: ValidationIssue[];
  attachments?: PromptAttachment[];
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

Confirmed outline. Keep slide count, slide index, and layoutId unchanged:
${JSON.stringify(outline, null, 2)}

Slide lock summary:
${slideLockPrompt(outline)}

Layout limits:
${pptLayoutCatalogPrompt()}

Validation feedback from the previous attempt:
${issueText}

Rules:
- Return one slide object per outline slide, in the same order, with matching index values.
- Do not add, remove, reorder, or change layoutId for any slide.
- Keep all text within the schema limits.
- If there are validation issues, fix only the affected slide content unless a nearby wording adjustment is necessary.
- Use clear business presentation language, not verbose report prose.
- Return JSON with a top-level "slides" array only. Do not include outline metadata.`,
    schema: deckPlanGenerationSchema,
    temperature: 0.25,
  });

  const deckPlan = buildDeckPlan(outline, res.object);
  pptLog(`LLM 內容就緒：${deckPlan.slides.length} 頁`);
  return deckPlan;
}
