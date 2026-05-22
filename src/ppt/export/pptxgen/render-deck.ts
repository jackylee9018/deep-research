import { mkdir } from 'fs/promises';
import path from 'path';
import PptxGenJS from 'pptxgenjs';

import type { DeckPlan, DeckSlide } from '../../schemas/deck-plan';
import {
  renderSlideWithBoxes,
  shouldRenderWithBoxes,
} from './render-positioned';
import {
  applyPresentationDefaults,
  bodyTextOpts,
  columnTitleTextOpts,
  PPTX_THEME,
  subtitleTextOpts,
  themeFromExportPalette,
  titleTextOpts,
  type PptxThemeColors,
} from './theme';
import type { PptExportTheme } from '../../templates/registry';

const SLIDE_W = 10;
const SLIDE_H = 5.625;
const MARGIN_X = 0.75;
const CONTENT_W = SLIDE_W - MARGIN_X * 2;

function resolveRenderTheme(exportTheme?: PptExportTheme): PptxThemeColors {
  if (!exportTheme) {
    return PPTX_THEME;
  }
  return themeFromExportPalette(exportTheme);
}

function addAccentBar(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  theme: PptxThemeColors,
): void {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.14,
    fill: { color: theme.accent },
    line: { color: theme.accent, width: 0 },
  });
}

function bulletTextRuns(
  lines: string[],
  theme: PptxThemeColors,
): PptxGenJS.TextProps[] {
  return lines.map((line, index) => ({
    text: line,
    options: {
      bullet: true,
      breakLine: index < lines.length - 1,
      ...bodyTextOpts(undefined, theme),
    },
  }));
}

function renderTitleSlide(
  slide: PptxGenJS.Slide,
  data: Extract<DeckSlide, { layoutId: 'title' }>,
  theme: PptxThemeColors,
) {
  slide.addText(data.title, {
    x: 0.9,
    y: 1.35,
    w: 8.2,
    h: 0.9,
    align: 'center',
    ...titleTextOpts({ fontSize: 38 }, theme),
  });
  if (data.subtitle?.trim()) {
    slide.addText(data.subtitle, {
      x: 0.9,
      y: 2.45,
      w: 8.2,
      h: 1,
      align: 'center',
      ...subtitleTextOpts({ fontSize: 22 }, theme),
    });
  }
}

function renderSectionSlide(
  slide: PptxGenJS.Slide,
  data: Extract<DeckSlide, { layoutId: 'section' }>,
  theme: PptxThemeColors,
) {
  slide.addText(data.title, {
    x: 0.9,
    y: 1.75,
    w: 8.2,
    h: 0.85,
    align: 'center',
    ...titleTextOpts({ fontSize: 34 }, theme),
  });
  if (data.subtitle?.trim()) {
    slide.addText(data.subtitle, {
      x: 0.9,
      y: 2.8,
      w: 8.2,
      h: 1,
      align: 'center',
      ...subtitleTextOpts(undefined, theme),
    });
  }
}

function renderBulletsSlide(
  slide: PptxGenJS.Slide,
  data: Extract<DeckSlide, { layoutId: 'bullets' }>,
  theme: PptxThemeColors,
) {
  slide.addText(data.title, {
    x: MARGIN_X,
    y: 0.55,
    w: CONTENT_W,
    h: 0.75,
    ...titleTextOpts(undefined, theme),
  });
  slide.addText(bulletTextRuns(data.bullets, theme), {
    x: 1,
    y: 1.65,
    w: 8,
    h: 3.4,
    valign: 'top',
  });
}

function renderTwoColumnSlide(
  slide: PptxGenJS.Slide,
  data: Extract<DeckSlide, { layoutId: 'two_column' }>,
  theme: PptxThemeColors,
) {
  slide.addText(data.title, {
    x: MARGIN_X,
    y: 0.55,
    w: CONTENT_W,
    h: 0.75,
    ...titleTextOpts(undefined, theme),
  });
  slide.addText(data.leftTitle, {
    x: 0.75,
    y: 1.55,
    w: 4.1,
    h: 0.45,
    ...columnTitleTextOpts(undefined, theme),
  });
  slide.addText(data.rightTitle, {
    x: 5.1,
    y: 1.55,
    w: 4.1,
    h: 0.45,
    ...columnTitleTextOpts(undefined, theme),
  });
  slide.addText(bulletTextRuns(data.leftBullets, theme), {
    x: 0.8,
    y: 2.15,
    w: 4,
    h: 3,
    valign: 'top',
  });
  slide.addText(bulletTextRuns(data.rightBullets, theme), {
    x: 5.15,
    y: 2.15,
    w: 4,
    h: 3,
    valign: 'top',
  });
}

function renderQuoteSlide(
  slide: PptxGenJS.Slide,
  data: Extract<DeckSlide, { layoutId: 'quote' }>,
  theme: PptxThemeColors,
) {
  if (data.title?.trim()) {
    slide.addText(data.title, {
      x: 0.75,
      y: 0.55,
      w: 4,
      h: 0.45,
      ...titleTextOpts({ fontSize: 16 }, theme),
    });
  }
  slide.addText(data.quote, {
    x: 0.75,
    y: 1.2,
    w: 8.5,
    h: 3.2,
    ...bodyTextOpts({ fontSize: 22 }, theme),
  });
  if (data.attribution?.trim()) {
    slide.addText(data.attribution, {
      x: 0.9,
      y: 4.6,
      w: 5,
      h: 0.5,
      ...subtitleTextOpts({ fontSize: 14 }, theme),
    });
  }
}

function renderStatSlide(
  slide: PptxGenJS.Slide,
  data: Extract<DeckSlide, { layoutId: 'stat' }>,
  theme: PptxThemeColors,
) {
  slide.addText(data.title, {
    x: 0.75,
    y: 0.55,
    w: 5.5,
    h: 0.65,
    ...titleTextOpts({ fontSize: 20 }, theme),
  });
  slide.addText(data.value, {
    x: 0.75,
    y: 1.35,
    w: 6,
    h: 1.4,
    ...titleTextOpts({ fontSize: 44 }, theme),
  });
  if (data.context?.trim()) {
    slide.addText(data.context, {
      x: 0.85,
      y: 3.1,
      w: 8.2,
      h: 0.75,
      ...subtitleTextOpts({ fontSize: 16 }, theme),
    });
  } else if (data.bullets?.length) {
    slide.addText(bulletTextRuns(data.bullets, theme), {
      x: 0.85,
      y: 3.1,
      w: 8.2,
      h: 1.8,
      valign: 'top',
    });
  }
}

function renderClosingSlide(
  slide: PptxGenJS.Slide,
  data: Extract<DeckSlide, { layoutId: 'closing' }>,
  theme: PptxThemeColors,
) {
  slide.addText(data.title, {
    x: 0.8,
    y: 0.9,
    w: 8.4,
    h: 0.75,
    ...titleTextOpts({ fontSize: 32 }, theme),
  });
  if (data.subtitle?.trim()) {
    slide.addText(data.subtitle, {
      x: 0.9,
      y: 1.85,
      w: 8.1,
      h: 0.8,
      ...subtitleTextOpts({ fontSize: 19 }, theme),
    });
  }
  slide.addText(bulletTextRuns(data.bullets, theme), {
    x: 1.45,
    y: 3,
    w: 7.1,
    h: 1.7,
    valign: 'top',
  });
}

function renderSlide(
  pptx: PptxGenJS,
  deckSlide: DeckSlide,
  theme: PptxThemeColors,
): void {
  const slide = pptx.addSlide();
  addAccentBar(slide, pptx, theme);

  if (shouldRenderWithBoxes(deckSlide)) {
    renderSlideWithBoxes(slide, deckSlide, theme);
    return;
  }

  switch (deckSlide.layoutId) {
    case 'title':
      renderTitleSlide(slide, deckSlide, theme);
      break;
    case 'section':
      renderSectionSlide(slide, deckSlide, theme);
      break;
    case 'bullets':
      renderBulletsSlide(slide, deckSlide, theme);
      break;
    case 'two_column':
      renderTwoColumnSlide(slide, deckSlide, theme);
      break;
    case 'quote':
      renderQuoteSlide(slide, deckSlide, theme);
      break;
    case 'stat':
      renderStatSlide(slide, deckSlide, theme);
      break;
    case 'closing':
      renderClosingSlide(slide, deckSlide, theme);
      break;
    default: {
      const _exhaustive: never = deckSlide;
      throw new Error(`Unsupported layout: ${(_exhaustive as DeckSlide).layoutId}`);
    }
  }
}

export async function renderDeckToPptx(
  plan: DeckPlan,
  outputPath: string,
  exportTheme?: PptExportTheme,
): Promise<{ slideCount: number }> {
  await mkdir(path.dirname(outputPath), { recursive: true });

  const theme = resolveRenderTheme(exportTheme);
  const pptx = new PptxGenJS();
  applyPresentationDefaults(pptx);
  pptx.author = 'Deep Research';
  pptx.title = plan.title;

  for (const deckSlide of plan.slides) {
    renderSlide(pptx, deckSlide, theme);
  }

  await pptx.writeFile({ fileName: outputPath });

  return { slideCount: plan.slides.length };
}
