import type { DeckPlan, DeckSlide } from './schemas';

export const DECK_SLIDE_PLACEHOLDER = '…';

export function isSkeletonSlide(slide: DeckSlide): boolean {
  if (slide.layoutId === 'quote') {
    return slide.quote === DECK_SLIDE_PLACEHOLDER || !slide.quote.trim();
  }
  if (slide.layoutId === 'stat') {
    return slide.value === DECK_SLIDE_PLACEHOLDER || slide.value === '—';
  }
  if (slide.layoutId === 'bullets') {
    return (
      slide.bullets.length === 0 ||
      (slide.bullets.length === 1 && slide.bullets[0] === DECK_SLIDE_PLACEHOLDER) ||
      slide.bullets.every(b => b === DECK_SLIDE_PLACEHOLDER)
    );
  }
  if (slide.layoutId === 'two_column') {
    return (
      slide.leftBullets.every(b => b === DECK_SLIDE_PLACEHOLDER) &&
      slide.rightBullets.every(b => b === DECK_SLIDE_PLACEHOLDER)
    );
  }
  if (slide.layoutId === 'closing') {
    return slide.bullets.every(b => b === DECK_SLIDE_PLACEHOLDER);
  }
  if (slide.subtitle === DECK_SLIDE_PLACEHOLDER) {
    return true;
  }
  return false;
}

export function countReadySlides(plan: DeckPlan): number {
  return plan.slides.filter(slide => !isSkeletonSlide(slide)).length;
}

export function isDeckContentReady(plan: DeckPlan): boolean {
  return countReadySlides(plan) >= plan.slides.length;
}
