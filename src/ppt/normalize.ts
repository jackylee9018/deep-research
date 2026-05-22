import { z } from 'zod';

import {
  deckPlanSchema,
  outlineDeckSchema,
  outlineMediaPlanSchema,
  pptLayoutIdSchema,
  type DeckPlan,
  type DeckSlide,
  type OutlineDeck,
  type OutlineMedia,
  type PptLayoutId,
} from './schemas';
import {
  getCompositionBoxes,
  resolveOutlineComposition,
} from './composition/load-catalog';
import { PPT_LAYOUT_CATALOG, PPT_LAYOUT_IDS } from './schemas/layout-catalog';

function clip(text: string, max: number, fallback = '待補內容'): string {
  const trimmed = text.trim();
  const value = trimmed || fallback;
  return value.length <= max ? value : value.slice(0, max);
}

function clipOptional(text: string | undefined, max: number): string | undefined {
  if (!text?.trim()) {
    return undefined;
  }
  return clip(text, max);
}

function clipBullets(items: string[] | undefined, maxItems: number, maxChars: number) {
  const bullets = (items ?? [])
    .map(item => clip(item, maxChars))
    .filter(Boolean);
  if (!bullets.length) {
    return [clip('待補內容', maxChars)];
  }
  return bullets.slice(0, maxItems);
}

function normalizeOutlineMedia(
  raw: OutlineGeneration['slides'][number]['media'],
): OutlineMedia | undefined {
  if (!raw || raw.enabled !== true) {
    return undefined;
  }
  const parsed = outlineMediaPlanSchema.safeParse({
    enabled: true,
    brief: raw.brief?.trim() || undefined,
    role: raw.role,
  });
  return parsed.success ? parsed.data : { enabled: true };
}

function coerceLayoutId(raw: string | undefined, fallback: PptLayoutId): PptLayoutId {
  const normalized = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  const parsed = pptLayoutIdSchema.safeParse(normalized);
  if (parsed.success) {
    return parsed.data;
  }

  if (normalized.includes('title') || normalized.includes('cover')) {
    return 'title';
  }
  if (normalized.includes('section') || normalized.includes('chapter')) {
    return 'section';
  }
  if (normalized.includes('two') || normalized.includes('column') || normalized.includes('compare')) {
    return 'two_column';
  }
  if (normalized.includes('close') || normalized.includes('end') || normalized.includes('summary')) {
    return 'closing';
  }
  if (normalized.includes('quote') || normalized.includes('citation')) {
    return 'quote';
  }
  if (
    normalized.includes('stat') ||
    normalized.includes('metric') ||
    normalized.includes('kpi') ||
    normalized.includes('number')
  ) {
    return 'stat';
  }

  return fallback;
}

export const outlineDeckGenerationSchema = z.object({
  title: z.string(),
  audience: z.string().optional(),
  tone: z.string().optional(),
  slides: z.array(
    z.object({
      index: z.union([z.number(), z.string()]).optional(),
      layoutId: z.string().optional(),
      compositionId: z.string().optional(),
      media: z
        .object({
          enabled: z.boolean().optional(),
          brief: z.string().optional(),
          role: z.string().optional(),
        })
        .optional(),
      headline: z.string().optional(),
      bulletSummary: z.array(z.string()).optional(),
    }),
  ),
});

export const deckSlideGenerationSchema = z.object({
  index: z.number().optional(),
  layoutId: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  leftTitle: z.string().optional(),
  rightTitle: z.string().optional(),
  leftBullets: z.array(z.string()).optional(),
  rightBullets: z.array(z.string()).optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
  value: z.string().optional(),
  context: z.string().optional(),
  headline: z.string().optional(),
});

export const deckPlanGenerationSchema = z.object({
  slides: z.array(deckSlideGenerationSchema),
});

type OutlineGeneration = z.infer<typeof outlineDeckGenerationSchema>;
type DeckPlanGeneration = z.infer<typeof deckPlanGenerationSchema>;
type DeckSlideGeneration = z.infer<typeof deckSlideGenerationSchema>;

function buildDeckSlide(
  outlineSlide: OutlineDeck['slides'][number],
  generated?: DeckSlideGeneration,
): DeckSlide {
  const layout = PPT_LAYOUT_CATALOG[outlineSlide.layoutId];
  const fallbackTitle = clip(
    generated?.title ?? generated?.headline ?? outlineSlide.headline,
    layout.maxTitleChars,
  );
  const fallbackBullets = clipBullets(
    generated?.bullets ?? outlineSlide.bulletSummary,
    layout.maxBullets ?? 5,
    layout.maxBulletChars ?? 95,
  );

  switch (outlineSlide.layoutId) {
    case 'title':
      return {
        index: outlineSlide.index,
        layoutId: 'title',
        title: clip(generated?.title ?? outlineSlide.headline, 60),
        subtitle: clipOptional(
          generated?.subtitle ?? outlineSlide.bulletSummary[0],
          120,
        ),
      };
    case 'section':
      return {
        index: outlineSlide.index,
        layoutId: 'section',
        title: fallbackTitle,
        subtitle: clipOptional(
          generated?.subtitle ?? outlineSlide.bulletSummary[0],
          140,
        ),
      };
    case 'bullets':
      return {
        index: outlineSlide.index,
        layoutId: 'bullets',
        title: fallbackTitle,
        bullets: fallbackBullets,
      };
    case 'two_column':
      return {
        index: outlineSlide.index,
        layoutId: 'two_column',
        title: fallbackTitle,
        leftTitle: clip(
          generated?.leftTitle ?? outlineSlide.bulletSummary[0] ?? '左欄',
          45,
        ),
        rightTitle: clip(
          generated?.rightTitle ?? outlineSlide.bulletSummary[1] ?? '右欄',
          45,
        ),
        leftBullets: clipBullets(
          generated?.leftBullets ?? outlineSlide.bulletSummary.slice(0, 2),
          4,
          80,
        ),
        rightBullets: clipBullets(
          generated?.rightBullets ?? outlineSlide.bulletSummary.slice(2),
          4,
          80,
        ),
      };
    case 'quote':
      return {
        index: outlineSlide.index,
        layoutId: 'quote',
        title: clipOptional(generated?.title ?? outlineSlide.headline, 40),
        quote: clip(
          generated?.quote ??
            generated?.bullets?.[0] ??
            outlineSlide.bulletSummary[0] ??
            '待補引文',
          280,
        ),
        attribution: clipOptional(
          generated?.attribution ??
            generated?.subtitle ??
            outlineSlide.bulletSummary[1],
          80,
        ),
      };
    case 'stat': {
      const supporting = clipBullets(
        generated?.bullets ?? outlineSlide.bulletSummary.slice(2),
        3,
        90,
      );
      return {
        index: outlineSlide.index,
        layoutId: 'stat',
        title: fallbackTitle,
        value: clip(
          generated?.value ??
            generated?.subtitle ??
            outlineSlide.bulletSummary[0] ??
            '—',
          24,
        ),
        context: clipOptional(
          generated?.context ?? outlineSlide.bulletSummary[1],
          120,
        ),
        bullets: supporting.length ? supporting : undefined,
      };
    }
    case 'closing':
      return {
        index: outlineSlide.index,
        layoutId: 'closing',
        title: fallbackTitle,
        subtitle: clipOptional(generated?.subtitle, 140),
        bullets: clipBullets(
          generated?.bullets ?? outlineSlide.bulletSummary,
          3,
          90,
        ),
      };
    default: {
      const _exhaustive: never = outlineSlide.layoutId;
      throw new Error(`Unsupported layout: ${_exhaustive}`);
    }
  }
}

export function normalizeOutlineDeck(raw: OutlineGeneration): OutlineDeck {
  const slideCount = Math.min(Math.max(raw.slides.length, 3), 15);

  const slides = raw.slides.slice(0, slideCount).map((slide, index) => {
    const rawComposition =
      slide.compositionId?.trim() ||
      slide.layoutId?.trim() ||
      undefined;
    const resolved = resolveOutlineComposition(rawComposition, index, slideCount);
    const headline = clip(slide.headline ?? `投影片 ${index + 1}`, 90);
    let bulletSummary = clipBullets(slide.bulletSummary, 5, 90);
    if (bulletSummary.length === 1 && bulletSummary[0] === headline) {
      bulletSummary = [clip('重點一', 90), clip('重點二', 90)];
    }

    const media = normalizeOutlineMedia(slide.media);

    return {
      index: index + 1,
      layoutId: resolved.layoutId,
      compositionId: resolved.compositionId,
      media,
      headline,
      bulletSummary,
    };
  });

  while (slides.length < 3) {
    const index = slides.length;
    const resolved = resolveOutlineComposition(undefined, index, 3);
    slides.push({
      index: index + 1,
      layoutId: resolved.layoutId,
      compositionId: resolved.compositionId,
      media: undefined,
      headline: `補充投影片 ${index + 1}`,
      bulletSummary: [clip('待補內容', 90)],
    });
  }

  const trimmedSlides = slides.slice(0, 15).map((slide, index) => {
    const total = Math.min(slides.length, 15);
    const forcedId =
      index === 0
        ? slide.compositionId?.startsWith('title')
          ? slide.compositionId
          : 'title_hero'
        : index === total - 1
          ? 'closing_cta'
          : slide.compositionId;
    const resolved = resolveOutlineComposition(forcedId, index, total);
    return {
      ...slide,
      index: index + 1,
      layoutId: resolved.layoutId,
      compositionId: resolved.compositionId,
    };
  });

  return outlineDeckSchema.parse({
    title: clip(raw.title, 80),
    audience: clipOptional(raw.audience, 120),
    tone: clipOptional(raw.tone, 80),
    slides: trimmedSlides,
  });
}

export function buildDeckPlan(
  outline: OutlineDeck,
  generated: DeckPlanGeneration,
  templateId = 'default',
): DeckPlan {
  const byIndex = new Map<number, DeckSlideGeneration>();
  for (const [index, slide] of generated.slides.entries()) {
    if (typeof slide.index === 'number') {
      byIndex.set(slide.index, slide);
      continue;
    }
    byIndex.set(index + 1, slide);
  }

  const slides = outline.slides.map((outlineSlide, index) => {
    const generatedSlide =
      byIndex.get(outlineSlide.index) ?? generated.slides[index];
    const deckSlide = buildDeckSlide(outlineSlide, generatedSlide);
    const compositionId =
      outlineSlide.compositionId ?? outlineSlide.layoutId;
    const boxes = getCompositionBoxes(compositionId);
    if (!boxes || Object.keys(boxes).length === 0) {
      return deckSlide;
    }
    return { ...deckSlide, boxes };
  });

  return deckPlanSchema.parse({
    title: outline.title,
    audience: outline.audience,
    tone: outline.tone,
    templateId,
    outline,
    slides,
  });
}
