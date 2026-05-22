import { findComposition } from './composition/load-catalog';
import type { OutlineDeck, OutlineSlide } from './schemas';
import type { OutlineMedia } from './schemas/slide-media';

const TITLE_COMPOSITIONS = ['title_hero', 'title_center', 'title_minimal'] as const;
const CLOSING_COMPOSITIONS = ['closing_cta', 'closing_minimal'] as const;
const SECTION_COMPOSITIONS = [
  'section_divider',
  'section_statement',
  'section_minimal',
] as const;

/** Rotated across body slides so streaming preview is not all bullets_standard. */
const BODY_PLACEHOLDER_ROTATION = [
  'bullets_standard',
  'two_column_balance',
  'stat_metric',
  'bullets_photo_right',
  'quote_highlight',
  'agenda_timeline',
  'bullets_wide',
  'two_column_stagger',
  'stat_comparison',
  'bullets_photo_left',
  'bullets_dense',
] as const;

const PHOTO_COMPOSITIONS = new Set<string>([
  'bullets_photo_right',
  'bullets_photo_left',
]);

function isSectionSlot(index: number, total: number): boolean {
  return index === 1 && total > 4;
}

function isStructuralSlot(index: number, total: number): boolean {
  return index === 0 || index === total - 1 || isSectionSlot(index, total);
}

function pickFromPool<T extends string>(
  pool: readonly T[],
  slot: number,
  used: Set<string>,
): T {
  const start = slot % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const id = pool[(start + i) % pool.length]!;
    if (!used.has(id)) {
      return id;
    }
  }
  return pool[start]!;
}

function defaultPhotoBrief(prompt: string): string {
  const topic = prompt.trim().slice(0, 60) || 'business presentation';
  return `${topic} professional`;
}

function mediaForComposition(
  compositionId: string,
  prompt: string,
): OutlineMedia | undefined {
  if (!PHOTO_COMPOSITIONS.has(compositionId)) {
    return undefined;
  }
  return {
    enabled: true,
    brief: defaultPhotoBrief(prompt),
    role: 'photo',
  };
}

function buildPlaceholderSlide(
  index: number,
  total: number,
  compositionId: string,
  headline: string,
  prompt: string,
): OutlineSlide {
  const entry = findComposition(compositionId);
  const resolvedId = entry?.id ?? compositionId;
  const layoutId = entry?.layoutId ?? 'bullets';

  return {
    index,
    layoutId,
    compositionId: resolvedId,
    media: mediaForComposition(resolvedId, prompt),
    headline,
    bulletSummary: ['…'],
  };
}

export function createPlaceholderOutline(
  prompt: string,
  slideCount: number,
): OutlineDeck {
  const title = prompt.trim().slice(0, 80) || '簡報大綱';
  const count = Math.min(Math.max(slideCount, 3), 15);
  const used = new Set<string>();
  let bodySlot = 0;

  const slides = Array.from({ length: count }, (_, index) => {
    const slideIndex = index + 1;
    let compositionId: string;

    if (index === 0) {
      compositionId = pickFromPool(TITLE_COMPOSITIONS, count, used);
    } else if (index === count - 1) {
      compositionId = pickFromPool(CLOSING_COMPOSITIONS, count + 1, used);
    } else if (isSectionSlot(index, count)) {
      compositionId = pickFromPool(SECTION_COMPOSITIONS, index, used);
    } else {
      compositionId = pickFromPool(
        BODY_PLACEHOLDER_ROTATION,
        bodySlot + (count % BODY_PLACEHOLDER_ROTATION.length),
        used,
      );
      bodySlot += 1;
    }

    used.add(compositionId);

    const headline =
      index === 0
        ? title
        : isSectionSlot(index, count)
          ? '章節預覽'
          : `第 ${slideIndex} 頁`;

    return buildPlaceholderSlide(
      slideIndex,
      count,
      compositionId,
      headline,
      prompt,
    );
  });

  return { title, slides };
}

/** Re-apply placeholder variety after free-text merge (keeps LLM headlines, refreshes missing ids). */
export function refreshPlaceholderCompositions(
  outline: OutlineDeck,
  prompt: string,
): OutlineDeck {
  const count = outline.slides.length;
  const used = new Set<string>();
  let bodySlot = 0;

  const slides = outline.slides.map((slide, index) => {
    const hasValidComposition =
      slide.compositionId?.trim() &&
      Boolean(findComposition(slide.compositionId));

    if (hasValidComposition && !isStructuralSlot(index, count)) {
      used.add(slide.compositionId!);
      const entry = findComposition(slide.compositionId);
      return {
        ...slide,
        layoutId: entry?.layoutId ?? slide.layoutId,
        media:
          slide.media ??
          mediaForComposition(slide.compositionId!, prompt),
      };
    }

    let compositionId: string;
    if (index === 0) {
      compositionId =
        slide.compositionId?.startsWith('title')
          ? slide.compositionId
          : pickFromPool(TITLE_COMPOSITIONS, count, used);
    } else if (index === count - 1) {
      compositionId =
        slide.compositionId?.startsWith('closing')
          ? slide.compositionId
          : pickFromPool(CLOSING_COMPOSITIONS, count + 1, used);
    } else if (isSectionSlot(index, count)) {
      compositionId =
        slide.compositionId?.startsWith('section')
          ? slide.compositionId
          : pickFromPool(SECTION_COMPOSITIONS, index, used);
    } else {
      compositionId = pickFromPool(
        BODY_PLACEHOLDER_ROTATION,
        bodySlot + (count % BODY_PLACEHOLDER_ROTATION.length),
        used,
      );
      bodySlot += 1;
    }

    used.add(compositionId);
    const entry = findComposition(compositionId);

    return {
      ...slide,
      layoutId: entry?.layoutId ?? slide.layoutId,
      compositionId: entry?.id ?? compositionId,
      media:
        slide.media ?? mediaForComposition(entry?.id ?? compositionId, prompt),
    };
  });

  return { ...outline, slides };
}
