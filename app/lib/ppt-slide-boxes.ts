import catalog from '@/ppt/composition/catalog.json';

import type { BoxRect, DeckSlide, SlideBoxKey } from './ppt-types';

type CompositionCatalog = {
  compositions: Array<{
    id: string;
    layoutId: DeckSlide['layoutId'];
    boxes: Partial<Record<SlideBoxKey, BoxRect>>;
  }>;
};

const compositions = (catalog as CompositionCatalog).compositions;

function presetForComposition(
  compositionId: string | undefined,
  layoutId: DeckSlide['layoutId'],
): Partial<Record<SlideBoxKey, BoxRect>> {
  const id = compositionId?.trim();
  if (id) {
    const byId = compositions.find(c => c.id === id);
    if (byId) {
      return byId.boxes;
    }
  }
  return compositions.find(c => c.layoutId === layoutId)?.boxes ?? {};
}

export function getEffectiveSlideBoxes(
  slide: DeckSlide,
  compositionId?: string,
): Partial<Record<SlideBoxKey, BoxRect>> {
  const preset = presetForComposition(compositionId, slide.layoutId);
  return { ...preset, ...slide.boxes };
}

export function commitSlideBoxes(
  slide: DeckSlide,
  compositionId?: string,
): DeckSlide {
  if (slide.boxes && Object.keys(slide.boxes).length > 0) {
    return slide;
  }
  return {
    ...slide,
    boxes: getEffectiveSlideBoxes(slide, compositionId) as DeckSlide['boxes'],
  };
}

export function patchSlideBox(
  slide: DeckSlide,
  key: SlideBoxKey,
  rect: BoxRect,
  compositionId?: string,
): DeckSlide {
  const base = commitSlideBoxes(slide, compositionId);
  return {
    ...base,
    boxes: {
      ...base.boxes,
      [key]: rect,
    },
  };
}

export function clearSlideBoxes(
  slide: DeckSlide,
  compositionId?: string,
): DeckSlide {
  const { boxes: _boxes, ...rest } = slide;
  return {
    ...rest,
    boxes: getEffectiveSlideBoxes(
      rest as DeckSlide,
      compositionId,
    ) as DeckSlide['boxes'],
  };
}

export function slideUsesPositionedLayout(slide: DeckSlide): boolean {
  return Boolean(slide.boxes && Object.keys(slide.boxes).length > 0);
}
