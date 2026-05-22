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

function presetForLayout(layoutId: DeckSlide['layoutId']): Partial<Record<SlideBoxKey, BoxRect>> {
  return compositions.find(c => c.layoutId === layoutId)?.boxes ?? {};
}

export function getEffectiveSlideBoxes(
  slide: DeckSlide,
): Partial<Record<SlideBoxKey, BoxRect>> {
  const preset = presetForLayout(slide.layoutId);
  return { ...preset, ...slide.boxes };
}

export function commitSlideBoxes(slide: DeckSlide): DeckSlide {
  if (slide.boxes && Object.keys(slide.boxes).length > 0) {
    return slide;
  }
  return {
    ...slide,
    boxes: getEffectiveSlideBoxes(slide) as DeckSlide['boxes'],
  };
}

export function patchSlideBox(
  slide: DeckSlide,
  key: SlideBoxKey,
  rect: BoxRect,
): DeckSlide {
  const base = commitSlideBoxes(slide);
  return {
    ...base,
    boxes: {
      ...base.boxes,
      [key]: rect,
    },
  };
}

export function clearSlideBoxes(slide: DeckSlide): DeckSlide {
  const { boxes: _boxes, ...rest } = slide;
  return rest as DeckSlide;
}

export function slideUsesPositionedLayout(slide: DeckSlide): boolean {
  return Boolean(slide.boxes && Object.keys(slide.boxes).length > 0);
}
