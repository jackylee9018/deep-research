import { z } from 'zod';

import {
  deckPlanSchema,
  outlineDeckSchema,
  pptLayoutIdSchema,
  type DeckPlan,
  type DeckSlide,
  type OutlineDeck,
  type PptLayoutId,
} from './schemas';
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
  const slides = raw.slides.map((slide, index) => {
    const layoutId = coerceLayoutId(
      slide.layoutId,
      index === 0 ? 'title' : index === raw.slides.length - 1 ? 'closing' : 'bullets',
    );
    const headline = clip(slide.headline ?? `投影片 ${index + 1}`, 90);
    let bulletSummary = clipBullets(slide.bulletSummary, 5, 90);
    if (bulletSummary.length === 1 && bulletSummary[0] === headline) {
      bulletSummary = [clip('重點一', 90), clip('重點二', 90)];
    }

    return {
      index: index + 1,
      layoutId,
      headline,
      bulletSummary,
    };
  });

  while (slides.length < 3) {
    slides.push({
      index: slides.length + 1,
      layoutId: 'bullets',
      headline: `補充投影片 ${slides.length + 1}`,
      bulletSummary: [clip('待補內容', 90)],
    });
  }

  const trimmedSlides = slides.slice(0, 15).map((slide, index) => ({
    ...slide,
    index: index + 1,
    layoutId: coerceLayoutId(
      slide.layoutId,
      index === 0 ? 'title' : index === slides.length - 1 ? 'closing' : slide.layoutId,
    ),
  }));

  if (!(PPT_LAYOUT_IDS as readonly string[]).includes(trimmedSlides[0]!.layoutId)) {
    trimmedSlides[0]!.layoutId = 'title';
  }
  trimmedSlides[trimmedSlides.length - 1]!.layoutId = 'closing';

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
): DeckPlan {
  const byIndex = new Map<number, DeckSlideGeneration>();
  for (const [index, slide] of generated.slides.entries()) {
    if (typeof slide.index === 'number') {
      byIndex.set(slide.index, slide);
      continue;
    }
    byIndex.set(index + 1, slide);
  }

  const slides = outline.slides.map((outlineSlide, index) =>
    buildDeckSlide(outlineSlide, byIndex.get(outlineSlide.index) ?? generated.slides[index]),
  );

  return deckPlanSchema.parse({
    title: outline.title,
    audience: outline.audience,
    tone: outline.tone,
    outline,
    slides,
  });
}
