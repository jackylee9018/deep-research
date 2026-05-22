import {
  findComposition,
  loadCompositionCatalog,
} from './composition/load-catalog';
import type { BoxRect, SlideBoxKey } from './schemas/slide-boxes';
import type { DeckSlide } from './schemas/deck-plan';
import type { PptLayoutId } from './schemas/layout-catalog';

export type SlideBoxPreset = Partial<Record<SlideBoxKey, BoxRect>>;

export function getLayoutPreset(layoutId: PptLayoutId): SlideBoxPreset {
  const entry = loadCompositionCatalog().compositions.find(
    c => c.layoutId === layoutId,
  );
  return entry?.boxes ?? {};
}

export const SLIDE_LAYOUT_PRESETS: Record<PptLayoutId, SlideBoxPreset> =
  Object.fromEntries(
    (['title', 'section', 'bullets', 'two_column', 'quote', 'stat', 'closing'] as const).map(
      id => [id, getLayoutPreset(id)],
    ),
  ) as Record<PptLayoutId, SlideBoxPreset>;

export function getEffectiveSlideBoxes(slide: DeckSlide): SlideBoxPreset {
  if (slide.boxes && Object.keys(slide.boxes).length > 0) {
    return { ...getLayoutPreset(slide.layoutId), ...slide.boxes };
  }
  return getLayoutPreset(slide.layoutId);
}

export function hasCustomSlideBoxes(slide: DeckSlide): boolean {
  return Boolean(slide.boxes && Object.keys(slide.boxes).length > 0);
}

/** Convert percent box to PPTX inches (16:9 slide 10 × 5.625 in). */
export function boxRectToInches(rect: BoxRect): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const SLIDE_W = 10;
  const SLIDE_H = 5.625;
  return {
    x: (rect.x / 100) * SLIDE_W,
    y: (rect.y / 100) * SLIDE_H,
    w: (rect.w / 100) * SLIDE_W,
    h: (rect.h / 100) * SLIDE_H,
  };
}

export function getPresetForComposition(compositionId: string): SlideBoxPreset {
  return findComposition(compositionId)?.boxes ?? {};
}
