import { z } from 'zod';

/** Outline-level: whether this slide should include a supporting image. */
export const outlineMediaPlanSchema = z.object({
  enabled: z.boolean(),
  /** Short English or Chinese keywords for image search (e.g. "team collaboration office"). */
  brief: z.string().min(1).max(120).optional(),
  role: z.enum(['illustration', 'diagram', 'photo', 'product']).optional(),
});

export type OutlineMedia = z.infer<typeof outlineMediaPlanSchema>;

/** Resolved image asset on a deck slide (path is absolute on disk). */
export const slideImageSchema = z.object({
  path: z.string().min(1),
  alt: z.string().max(120).optional(),
  source: z.enum(['placeholder', 'pexels', 'attachment']).default('placeholder'),
});

export type SlideImage = z.infer<typeof slideImageSchema>;

export const slideImageField = {
  image: slideImageSchema.optional(),
} as const;
