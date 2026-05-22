import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { pptLog, pptLogWarn } from '../log';
import type { DeckPlan, DeckSlide } from '../schemas/deck-plan';
import type { OutlineSlide } from '../schemas/outline-deck';
import type { SlideImage } from '../schemas/slide-media';

const IMAGE_COMPOSITIONS = new Set([
  'bullets_photo_right',
  'bullets_photo_left',
]);

function outlineSlideFor(
  plan: DeckPlan,
  slide: DeckSlide,
): OutlineSlide | undefined {
  return plan.outline.slides.find(s => s.index === slide.index);
}

export function slideWantsImage(
  slide: DeckSlide,
  outlineSlide?: OutlineSlide,
): boolean {
  if (slide.layoutId !== 'bullets') {
    return false;
  }
  if ('image' in slide && slide.image?.path) {
    return true;
  }
  if (outlineSlide?.media?.enabled) {
    return true;
  }
  const compositionId = outlineSlide?.compositionId ?? '';
  return IMAGE_COMPOSITIONS.has(compositionId);
}

function imageBrief(slide: DeckSlide, outlineSlide?: OutlineSlide): string {
  const fromMedia = outlineSlide?.media?.brief?.trim();
  if (fromMedia) {
    return fromMedia;
  }
  const title = 'title' in slide ? slide.title : '';
  const bullets =
    slide.layoutId === 'bullets' ? slide.bullets.join(' ') : '';
  return `${title} ${bullets}`.trim().slice(0, 120) || 'presentation';
}

function seedFromBrief(brief: string): string {
  return createHash('sha256').update(brief).digest('hex').slice(0, 16);
}

async function fetchPexelsPhoto(
  brief: string,
  apiKey: string,
): Promise<Buffer | null> {
  const query = encodeURIComponent(brief.slice(0, 80));
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`,
    {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as {
    photos?: { src?: { large?: string; medium?: string } }[];
  };
  const url = data.photos?.[0]?.src?.large ?? data.photos?.[0]?.src?.medium;
  if (!url) {
    return null;
  }
  const imgRes = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!imgRes.ok) {
    return null;
  }
  return Buffer.from(await imgRes.arrayBuffer());
}

async function fetchPlaceholderPhoto(brief: string): Promise<Buffer> {
  const seed = seedFromBrief(brief);
  const url = `https://picsum.photos/seed/${seed}/1280/720`;
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    throw new Error(`Placeholder image fetch failed: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function resolveOneSlideImage(
  slide: DeckSlide,
  outlineSlide: OutlineSlide | undefined,
  mediaDir: string,
): Promise<SlideImage | undefined> {
  if (!slideWantsImage(slide, outlineSlide)) {
    return undefined;
  }
  if ('image' in slide && slide.image?.path) {
    return slide.image;
  }

  const brief = imageBrief(slide, outlineSlide);
  const dest = path.join(mediaDir, `slide-${slide.index}.jpg`);
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();

  try {
    let buffer: Buffer | null = null;
    let source: SlideImage['source'] = 'placeholder';

    if (pexelsKey) {
      buffer = await fetchPexelsPhoto(brief, pexelsKey);
      if (buffer) {
        source = 'pexels';
      }
    }

    if (!buffer) {
      buffer = await fetchPlaceholderPhoto(brief);
      source = 'placeholder';
    }

    await writeFile(dest, buffer);
    pptLog(`  配圖 頁 ${slide.index}｜${source}｜${brief.slice(0, 40)}…`);

    return {
      path: dest,
      alt: brief.slice(0, 120),
      source,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pptLogWarn(`  配圖失敗 頁 ${slide.index}：${message}`);
    return undefined;
  }
}

/** Fetch images for slides that need media; returns an updated deck plan. */
export async function resolveSlideImages(
  plan: DeckPlan,
  jobDir: string,
): Promise<DeckPlan> {
  const mediaDir = path.join(jobDir, 'media');
  await mkdir(mediaDir, { recursive: true });

  const needsAny = plan.slides.some(s =>
    slideWantsImage(s, outlineSlideFor(plan, s)),
  );
  if (!needsAny) {
    return plan;
  }

  pptLog(`開始解析投影片配圖（${plan.slides.length} 頁）…`);

  const slides = await Promise.all(
    plan.slides.map(async slide => {
      if (slide.layoutId !== 'bullets') {
        return slide;
      }
      const outlineSlide = outlineSlideFor(plan, slide);
      const image = await resolveOneSlideImage(
        slide,
        outlineSlide,
        mediaDir,
      );
      if (!image) {
        return slide;
      }
      return { ...slide, image };
    }),
  );

  return { ...plan, slides };
}
