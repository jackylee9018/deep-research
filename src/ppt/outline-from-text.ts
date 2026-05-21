import type { OutlineDeck } from '@/ppt/schemas';

import { DEFAULT_PPT_OUTLINE_SLIDE_COUNT } from './page-text';
import { createPlaceholderOutline } from './placeholder-outline';
import { outlineDeckSchema } from './schemas';

export function freeFormatTextToOutline(
  outline: OutlineDeck,
  text: string,
): OutlineDeck {
  const blocks = text
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  const slides = outline.slides.map((slide, index) => {
    const block = blocks[index];
    if (!block) {
      return slide;
    }

    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const headline = lines[0]?.replace(/^#+\s*/, '') ?? slide.headline;
    const bullets = lines
      .slice(1)
      .map(line => line.replace(/^[•\-*]\s*/, '').trim())
      .filter(Boolean);

    return {
      ...slide,
      headline: headline || slide.headline,
      bulletSummary: bullets.length
        ? bullets.slice(0, 5)
        : slide.bulletSummary,
    };
  });

  return { ...outline, slides };
}

export function outlineFromFreeFormatText(
  prompt: string,
  text: string,
  slideCount = DEFAULT_PPT_OUTLINE_SLIDE_COUNT,
): OutlineDeck {
  const placeholder = createPlaceholderOutline(prompt, slideCount);
  const merged = freeFormatTextToOutline(placeholder, text);
  const title =
    merged.slides[0]?.headline?.trim() ||
    prompt.trim().slice(0, 80) ||
    '簡報大綱';

  return outlineDeckSchema.parse({
    ...merged,
    title,
    slides: merged.slides.map((slide, index) => ({
      ...slide,
      index: index + 1,
    })),
  });
}
