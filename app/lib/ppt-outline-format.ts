import {
  freeFormatTextToOutline as freeFormatTextToOutlineCore,
  outlineFromFreeFormatText as outlineFromFreeFormatTextCore,
} from '@/ppt/outline-from-text';
import { createPlaceholderOutline as createPlaceholderOutlineCore } from '@/ppt/placeholder-outline';

import type { OutlineDeck } from './ppt-types';

export { createPlaceholderOutlineCore as createPlaceholderOutline };
export { outlineFromFreeFormatTextCore as outlineFromFreeFormatText };

export function outlineToFreeFormatText(outline: OutlineDeck): string {
  return outline.slides
    .map(slide => {
      const bullets = slide.bulletSummary.map(line => `• ${line}`).join('\n');
      return `${slide.headline}\n${bullets}`;
    })
    .join('\n\n');
}

export function freeFormatTextToOutline(
  outline: OutlineDeck,
  text: string,
): OutlineDeck {
  return freeFormatTextToOutlineCore(outline, text);
}
