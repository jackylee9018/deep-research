import type { OutlineDeck } from './schemas';
import type { PptLayoutId } from './schemas/layout-catalog';

function layoutForIndex(index: number, total: number): PptLayoutId {
  if (index === 0) {
    return 'title';
  }
  if (index === total - 1) {
    return 'closing';
  }
  if (index === 1 && total > 4) {
    return 'section';
  }
  return 'bullets';
}

export function createPlaceholderOutline(
  prompt: string,
  slideCount: number,
): OutlineDeck {
  const title = prompt.trim().slice(0, 80) || '簡報大綱';
  const count = Math.min(Math.max(slideCount, 3), 15);

  return {
    title,
    slides: Array.from({ length: count }, (_, index) => ({
      index: index + 1,
      layoutId: layoutForIndex(index, count),
      headline: index === 0 ? title : `第 ${index + 1} 頁`,
      bulletSummary: ['…'],
    })),
  };
}
