import { findComposition, listCompositions } from './load-catalog';
import type { OutlineDeck, OutlineSlide } from '../schemas';

const BODY_COMPOSITION_POOL = [
  'bullets_standard',
  'bullets_wide',
  'bullets_dense',
  'bullets_photo_right',
  'bullets_photo_left',
  'agenda_timeline',
  'two_column_balance',
  'two_column_stagger',
  'quote_highlight',
  'stat_metric',
  'stat_comparison',
  'section_statement',
  'section_minimal',
] as const;

function headlineHints(headline: string, bullets: string[]): string {
  return `${headline} ${bullets.join(' ')}`.toLowerCase();
}

function suggestCompositionForBodySlide(
  slide: OutlineSlide,
  used: Set<string>,
): string {
  const text = headlineHints(slide.headline, slide.bulletSummary);

  if (
    /[%％]|kpi|成長|營收|用戶數|市佔|同比|環比|\d+(\.\d+)?\s*(万|萬|亿|億|m|k)/i.test(
      text,
    )
  ) {
    return used.has('stat_metric') ? 'stat_comparison' : 'stat_metric';
  }
  if (/語錄|名言|引用|quote|「|」/.test(text)) {
    return 'quote_highlight';
  }
  if (/議程|大綱|章節一覽|流程|timeline|roadmap/i.test(text)) {
    return 'agenda_timeline';
  }
  if (slide.media?.enabled) {
    return used.has('bullets_photo_right')
      ? 'bullets_photo_left'
      : 'bullets_photo_right';
  }
  if (/圖|截圖|架構|示意|產品畫面|screenshot|配圖|插圖/i.test(text)) {
    return 'bullets_photo_right';
  }
  if (/對比|vs|相比|優缺|方案\s*[ab]|before|after/i.test(text)) {
    return used.has('two_column_balance')
      ? 'two_column_stagger'
      : 'two_column_balance';
  }
  if (/總結|結論|下一步|行動|cta/i.test(text)) {
    return 'section_statement';
  }

  for (const id of BODY_COMPOSITION_POOL) {
    if (!used.has(id)) {
      return id;
    }
  }
  return 'bullets_wide';
}

/** Heuristic pass: diversify compositionId when the model picks too many identical layouts. */
export function refineOutlineCompositions(outline: OutlineDeck): OutlineDeck {
  const catalogIds = new Set(listCompositions().map(c => c.id));
  const total = outline.slides.length;
  const bulletsStandardCount = outline.slides.filter(
    s => s.compositionId === 'bullets_standard',
  ).length;
  const tooUniform =
    bulletsStandardCount > Math.max(2, Math.floor(total * 0.4));

  const used = new Set<string>();

  const slides = outline.slides.map((slide, index) => {
    let compositionId = slide.compositionId?.trim();

    if (!compositionId || !catalogIds.has(compositionId)) {
      compositionId = findComposition(slide.layoutId)?.id;
    }

    if (index === 0) {
      compositionId = compositionId?.startsWith('title')
        ? compositionId
        : 'title_hero';
    } else if (index === total - 1) {
      compositionId = compositionId?.startsWith('closing')
        ? compositionId
        : 'closing_cta';
    } else if (index === 1 && total > 4 && !compositionId?.startsWith('section')) {
      compositionId = 'section_divider';
    } else if (
      tooUniform &&
      (compositionId === 'bullets_standard' || !compositionId)
    ) {
      compositionId = suggestCompositionForBodySlide(slide, used);
    }

    let entry = findComposition(compositionId ?? 'bullets_standard');
    let resolvedId = entry?.id ?? compositionId ?? 'bullets_standard';

    if (slide.media?.enabled && !resolvedId.includes('photo')) {
      resolvedId = suggestCompositionForBodySlide(slide, used);
      entry = findComposition(resolvedId);
    }

    used.add(resolvedId);

    return {
      ...slide,
      compositionId: resolvedId,
      layoutId: entry?.layoutId ?? slide.layoutId,
    };
  });

  return { ...outline, slides };
}
