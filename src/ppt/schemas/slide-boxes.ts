import { z } from 'zod';

export const SLIDE_BOX_KEYS = [
  'title',
  'subtitle',
  'body',
  'leftTitle',
  'leftBody',
  'rightTitle',
  'rightBody',
  'image',
] as const;

export const slideBoxKeySchema = z.enum(SLIDE_BOX_KEYS);

export type SlideBoxKey = z.infer<typeof slideBoxKeySchema>;

export const boxRectSchema = z.object({
  /** Percent of slide width (0–100). */
  x: z.number().min(0).max(92),
  /** Percent of slide height (0–100). */
  y: z.number().min(0).max(92),
  w: z.number().min(8).max(100),
  h: z.number().min(6).max(100),
});

export type BoxRect = z.infer<typeof boxRectSchema>;

export const slideBoxesSchema = z
  .record(slideBoxKeySchema, boxRectSchema)
  .optional();

export type SlideBoxes = z.infer<typeof slideBoxesSchema>;
