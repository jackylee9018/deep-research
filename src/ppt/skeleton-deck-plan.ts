import { buildDeckPlan } from './normalize';
import type { DeckPlan, OutlineDeck } from './schemas';
import { DECK_SLIDE_PLACEHOLDER } from './deck-plan-progress';

/** Placeholder deck for preview while LLM fills slides one by one. */
export function buildSkeletonDeckPlan(
  outline: OutlineDeck,
  templateId = 'default',
): DeckPlan {
  return buildDeckPlan(outline, {
    slides: outline.slides.map(slide => {
      const base = {
        index: slide.index,
        title: slide.headline,
      };

      switch (slide.layoutId) {
        case 'title':
        case 'section':
          return { ...base, subtitle: DECK_SLIDE_PLACEHOLDER };
        case 'bullets':
          return { ...base, bullets: [DECK_SLIDE_PLACEHOLDER, DECK_SLIDE_PLACEHOLDER] };
        case 'two_column':
          return {
            ...base,
            leftTitle: slide.bulletSummary[0] ?? DECK_SLIDE_PLACEHOLDER,
            rightTitle: slide.bulletSummary[1] ?? DECK_SLIDE_PLACEHOLDER,
            leftBullets: [DECK_SLIDE_PLACEHOLDER],
            rightBullets: [DECK_SLIDE_PLACEHOLDER],
          };
        case 'quote':
          return {
            ...base,
            quote: slide.bulletSummary[0] ?? DECK_SLIDE_PLACEHOLDER,
            attribution: slide.bulletSummary[1],
          };
        case 'stat':
          return {
            ...base,
            value: slide.bulletSummary[0] ?? DECK_SLIDE_PLACEHOLDER,
            context: slide.bulletSummary[1],
            bullets: slide.bulletSummary.slice(2).length
              ? slide.bulletSummary.slice(2)
              : undefined,
          };
        case 'closing':
          return { ...base, bullets: [DECK_SLIDE_PLACEHOLDER] };
        default:
          return base;
      }
    }),
  }, templateId);
}
