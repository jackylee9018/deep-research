import type { BoxRect, SlideBoxKey } from '../schemas/slide-boxes';
import type { PptLayoutId } from '../schemas/layout-catalog';
import { findComposition, getCompositionBoxes } from './load-catalog';

/** Allowed box keys per layout (aligned with preview / export). */
const LAYOUT_BOX_KEYS: Record<PptLayoutId, SlideBoxKey[]> = {
  title: ['title', 'subtitle'],
  section: ['title', 'subtitle'],
  bullets: ['title', 'body', 'image'],
  two_column: ['title', 'leftTitle', 'leftBody', 'rightTitle', 'rightBody'],
  quote: ['title', 'body', 'subtitle'],
  stat: ['title', 'subtitle', 'body'],
  closing: ['title', 'subtitle', 'body'],
};

export function clampBoxRect(rect: BoxRect): BoxRect {
  const w = Math.min(Math.max(rect.w, 8), 100);
  const h = Math.min(Math.max(rect.h, 6), 100);
  const x = Math.min(Math.max(rect.x, 0), 100 - w);
  const y = Math.min(Math.max(rect.y, 0), 100 - h);
  return { x, y, w, h };
}

function allowedKeys(layoutId: PptLayoutId): Set<SlideBoxKey> {
  return new Set(LAYOUT_BOX_KEYS[layoutId] ?? ['title', 'body']);
}

/**
 * Merge catalog preset boxes with optional LLM tweaks (whitelist + clamp).
 */
export function mergeCompositionBoxes(
  compositionId: string,
  llmBoxes: Partial<Record<SlideBoxKey, BoxRect>> | undefined,
  layoutId: PptLayoutId,
): Partial<Record<SlideBoxKey, BoxRect>> {
  const base = { ...getCompositionBoxes(compositionId) };
  const entry = findComposition(compositionId);
  const keys = allowedKeys(entry?.layoutId ?? layoutId);

  if (!llmBoxes) {
    return base;
  }

  for (const [key, rect] of Object.entries(llmBoxes)) {
    if (!rect || !keys.has(key as SlideBoxKey)) {
      continue;
    }
    const preset = base[key as SlideBoxKey];
    if (!preset) {
      continue;
    }
    base[key as SlideBoxKey] = clampBoxRect({
      x: rect.x ?? preset.x,
      y: rect.y ?? preset.y,
      w: rect.w ?? preset.w,
      h: rect.h ?? preset.h,
    });
  }

  return base;
}

export const BOX_TWEAK_RULES_FOR_LLM = `Box layout rules (optional "boxes" on each slide):
- Default positions are provided in the composition detail below; omit "boxes" to use defaults.
- Only include "boxes" when content volume clearly needs a small adjustment (e.g. many bullets → slightly taller body.h; short title → smaller title.h).
- Tweaks must be small: move/size deltas within about ±8% on x/y and ±12% on w/h relative to defaults.
- Only use box keys that exist in the composition detail (e.g. title, body, subtitle, leftTitle, leftBody, image).
- Do not add or remove box keys. Do not change compositionId or layoutId.`;
