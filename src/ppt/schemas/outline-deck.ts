import { z } from 'zod';

import { pptLayoutIdSchema } from './layout-catalog';

export const outlineSlideSchema = z.object({
  index: z.number().int().min(1),
  layoutId: pptLayoutIdSchema,
  headline: z.string().min(1).max(90),
  bulletSummary: z.array(z.string().min(1).max(90)).min(1).max(5),
});

export const outlineDeckSchema = z.object({
  title: z.string().min(1).max(80),
  audience: z.string().max(120).optional(),
  tone: z.string().max(80).optional(),
  slides: z.array(outlineSlideSchema).min(3).max(15),
});

export type OutlineSlide = z.infer<typeof outlineSlideSchema>;
export type OutlineDeck = z.infer<typeof outlineDeckSchema>;
