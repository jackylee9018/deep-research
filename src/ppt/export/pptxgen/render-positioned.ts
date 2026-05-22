import { existsSync } from 'fs';

import type PptxGenJS from 'pptxgenjs';

import type { DeckSlide } from '../../schemas/deck-plan';
import type { SlideBoxKey } from '../../schemas/slide-boxes';
import {
  boxRectToInches,
  getEffectiveSlideBoxes,
  hasCustomSlideBoxes,
} from '../../slide-layout-presets';
import {
  bodyTextOpts,
  columnTitleTextOpts,
  subtitleTextOpts,
  titleTextOpts,
  type PptxThemeColors,
} from './theme';

function addBulletBox(
  slide: PptxGenJS.Slide,
  rect: { x: number; y: number; w: number; h: number },
  bullets: string[],
  theme: PptxThemeColors,
) {
  slide.addText(
    bullets.map((line, index) => ({
      text: line,
      options: {
        bullet: true,
        breakLine: index < bullets.length - 1,
        ...bodyTextOpts(undefined, theme),
      },
    })),
    {
      ...rect,
      valign: 'top',
    },
  );
}

function addImageBox(
  slide: PptxGenJS.Slide,
  imagePath: string,
  rect: { x: number; y: number; w: number; h: number },
) {
  if (!existsSync(imagePath)) {
    return;
  }
  slide.addImage({
    path: imagePath,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
  });
}

function addPlainBox(
  slide: PptxGenJS.Slide,
  text: string,
  rect: { x: number; y: number; w: number; h: number },
  opts: ReturnType<typeof titleTextOpts>,
  bullets?: string[],
  theme?: PptxThemeColors,
) {
  if (bullets?.length && theme) {
    addBulletBox(slide, rect, bullets, theme);
    return;
  }
  slide.addText(text, {
    ...rect,
    valign: 'top',
    ...opts,
  });
}

export function renderSlideWithBoxes(
  slide: PptxGenJS.Slide,
  deckSlide: DeckSlide,
  theme: PptxThemeColors,
): void {
  const boxes = getEffectiveSlideBoxes(deckSlide);

  const place = (
    key: SlideBoxKey,
    text: string,
    style: ReturnType<typeof titleTextOpts>,
    bullets?: string[],
  ) => {
    const rectPct = boxes[key];
    if (!rectPct) {
      return;
    }
    addPlainBox(
      slide,
      text,
      boxRectToInches(rectPct),
      style,
      bullets,
      bullets?.length ? theme : undefined,
    );
  };

  if (deckSlide.layoutId === 'title' || deckSlide.layoutId === 'section') {
    place('title', deckSlide.title, titleTextOpts({ fontSize: 34 }, theme));
    if (deckSlide.subtitle) {
      place(
        'subtitle',
        deckSlide.subtitle,
        subtitleTextOpts(undefined, theme),
      );
    }
    return;
  }

  if (deckSlide.layoutId === 'bullets') {
    place('title', deckSlide.title, titleTextOpts(undefined, theme));
    place(
      'body',
      '',
      bodyTextOpts(undefined, theme),
      deckSlide.bullets,
    );
    const imageRect = boxes.image;
    if (imageRect && deckSlide.image?.path) {
      addImageBox(slide, deckSlide.image.path, boxRectToInches(imageRect));
    }
    return;
  }

  if (deckSlide.layoutId === 'two_column') {
    place('title', deckSlide.title, titleTextOpts(undefined, theme));
    place(
      'leftTitle',
      deckSlide.leftTitle,
      columnTitleTextOpts(undefined, theme),
    );
    place(
      'leftBody',
      '',
      bodyTextOpts(undefined, theme),
      deckSlide.leftBullets,
    );
    place(
      'rightTitle',
      deckSlide.rightTitle,
      columnTitleTextOpts(undefined, theme),
    );
    place(
      'rightBody',
      '',
      bodyTextOpts(undefined, theme),
      deckSlide.rightBullets,
    );
    return;
  }

  if (deckSlide.layoutId === 'quote') {
    if (deckSlide.title) {
      place('title', deckSlide.title, titleTextOpts({ fontSize: 16 }, theme));
    }
    place(
      'body',
      deckSlide.quote,
      bodyTextOpts({ fontSize: 22 }, theme),
    );
    if (deckSlide.attribution) {
      place(
        'subtitle',
        deckSlide.attribution,
        subtitleTextOpts({ fontSize: 14 }, theme),
      );
    }
    return;
  }

  if (deckSlide.layoutId === 'stat') {
    place('title', deckSlide.title, titleTextOpts({ fontSize: 20 }, theme));
    place(
      'subtitle',
      deckSlide.value,
      titleTextOpts({ fontSize: 40 }, theme),
    );
    if (deckSlide.context) {
      place(
        'body',
        deckSlide.context,
        bodyTextOpts({ fontSize: 16 }, theme),
      );
    } else if (deckSlide.bullets?.length) {
      place('body', '', bodyTextOpts(undefined, theme), deckSlide.bullets);
    }
    return;
  }

  if (deckSlide.layoutId === 'closing') {
    place('title', deckSlide.title, titleTextOpts({ fontSize: 32 }, theme));
    if (deckSlide.subtitle) {
      place(
        'subtitle',
        deckSlide.subtitle,
        subtitleTextOpts(undefined, theme),
      );
    }
    place(
      'body',
      '',
      bodyTextOpts(undefined, theme),
      deckSlide.bullets,
    );
  }
}

export function shouldRenderWithBoxes(deckSlide: DeckSlide): boolean {
  return hasCustomSlideBoxes(deckSlide);
}
