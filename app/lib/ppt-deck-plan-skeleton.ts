import { buildDeckPlan } from '@/ppt/normalize';

import type { DeckPlan, OutlineDeck } from './ppt-types';

const PLACEHOLDER = '…';

/** Placeholder deck for preview while LangGraph / LLM is still running. */
export function outlineToSkeletonDeckPlan(outline: OutlineDeck): DeckPlan {
  return buildDeckPlan(outline, {
    slides: outline.slides.map(slide => {
      const base = {
        index: slide.index,
        title: slide.headline,
      };

      switch (slide.layoutId) {
        case 'title':
        case 'section':
          return {
            ...base,
            subtitle: PLACEHOLDER,
          };
        case 'bullets':
          return {
            ...base,
            bullets: [PLACEHOLDER, PLACEHOLDER],
          };
        case 'two_column':
          return {
            ...base,
            leftTitle: slide.bulletSummary[0] ?? PLACEHOLDER,
            rightTitle: slide.bulletSummary[1] ?? PLACEHOLDER,
            leftBullets: [PLACEHOLDER],
            rightBullets: [PLACEHOLDER],
          };
        case 'quote':
          return {
            ...base,
            quote: slide.bulletSummary[0] ?? PLACEHOLDER,
            attribution: slide.bulletSummary[1],
          };
        case 'stat':
          return {
            ...base,
            value: slide.bulletSummary[0] ?? PLACEHOLDER,
            context: slide.bulletSummary[1],
            bullets: slide.bulletSummary.slice(2).length
              ? slide.bulletSummary.slice(2)
              : undefined,
          };
        case 'closing':
          return {
            ...base,
            bullets: [PLACEHOLDER],
          };
        default:
          return base;
      }
    }),
  });
}
