import catalogJson from './catalog.json';
import type { BoxRect, SlideBoxKey } from '../schemas/slide-boxes';
import type { PptLayoutId } from '../schemas/layout-catalog';

export type CompositionEntry = {
  id: string;
  layoutId: PptLayoutId;
  label: string;
  description: string;
  whenToUse: string;
  fields: string[];
  boxes: Partial<Record<SlideBoxKey, BoxRect>>;
};

export type CompositionCatalog = {
  version: number;
  compositions: CompositionEntry[];
};

const catalog = catalogJson as CompositionCatalog;

export function loadCompositionCatalog(): CompositionCatalog {
  return catalog;
}

export function listCompositions(): CompositionEntry[] {
  return catalog.compositions;
}

export function findComposition(
  idOrLayout: string | undefined,
): CompositionEntry | undefined {
  if (!idOrLayout?.trim()) {
    return undefined;
  }
  const key = idOrLayout.trim().toLowerCase();
  return (
    catalog.compositions.find(c => c.id === key) ??
    catalog.compositions.find(c => c.layoutId === key)
  );
}

export function defaultCompositionForPosition(
  index: number,
  total: number,
): CompositionEntry {
  if (index === 0) {
    return findComposition('title_hero')!;
  }
  if (index === total - 1) {
    return findComposition('closing_cta')!;
  }
  if (index === 1 && total > 4) {
    return findComposition('section_divider')!;
  }
  return findComposition('bullets_standard')!;
}

export function resolveOutlineComposition(
  rawId: string | undefined,
  index: number,
  total: number,
): { layoutId: PptLayoutId; compositionId: string; boxes: CompositionEntry['boxes'] } {
  const found = findComposition(rawId);
  const entry = found ?? defaultCompositionForPosition(index, total);
  return {
    layoutId: entry.layoutId,
    compositionId: entry.id,
    boxes: entry.boxes,
  };
}

export function getCompositionBoxes(
  compositionId: string,
): Partial<Record<SlideBoxKey, BoxRect>> {
  return findComposition(compositionId)?.boxes ?? {};
}

export function compositionCatalogXml(): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<compositionCatalog version="1">',
  ];

  for (const c of catalog.compositions) {
    lines.push(`  <composition id="${c.id}" layoutId="${c.layoutId}">`);
    lines.push(`    <label>${escapeXml(c.label)}</label>`);
    lines.push(`    <description>${escapeXml(c.description)}</description>`);
    lines.push(`    <whenToUse>${escapeXml(c.whenToUse)}</whenToUse>`);
    lines.push(`    <fields>${c.fields.join(',')}</fields>`);
    lines.push('    <boxes>');
    for (const [key, rect] of Object.entries(c.boxes)) {
      if (!rect) {
        continue;
      }
      lines.push(
        `      <box key="${key}" x="${rect.x}" y="${rect.y}" w="${rect.w}" h="${rect.h}"/>`,
      );
    }
    lines.push('    </boxes>');
    lines.push('  </composition>');
  }

  lines.push('</compositionCatalog>');
  return lines.join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function compositionCatalogPromptForOutline(): string {
  return `${compositionCatalogXml()}

Selection rules:
- For EACH slide, set "compositionId" to exactly one id from the catalog above.
- Pick the composition whose whenToUse best matches that slide's narrative role and content shape.
- Slide 1: prefer title_hero or title_center.
- Last slide: prefer closing_cta.
- Comparisons: two_column_balance or two_column_stagger.
- Single powerful quote: quote_highlight.
- One big metric: stat_metric.
- Agenda or outline preview: agenda_timeline.
- When a slide needs a supporting photo or diagram, set media.enabled to true and media.brief (English keywords for image search). Pick bullets_photo_right or bullets_photo_left.
- Do not set media.enabled on title, section, quote, stat, or closing unless the user explicitly asks for a hero image (prefer bullets_photo_* on body slides).
- Do not invent new composition ids.`;
}
