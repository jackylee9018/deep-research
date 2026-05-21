import { z } from 'zod';

import { outlineDeckSchema } from './outline-deck';

const bulletSchema = z.string().min(1).max(95);

const titleSlideSchema = z.object({
  index: z.number().int().min(1),
  layoutId: z.literal('title'),
  title: z.string().min(1).max(60),
  subtitle: z.string().min(1).max(120).optional(),
});

const sectionSlideSchema = z.object({
  index: z.number().int().min(1),
  layoutId: z.literal('section'),
  title: z.string().min(1).max(80),
  subtitle: z.string().min(1).max(140).optional(),
});

const bulletsSlideSchema = z.object({
  index: z.number().int().min(1),
  layoutId: z.literal('bullets'),
  title: z.string().min(1).max(70),
  bullets: z.array(bulletSchema).min(1).max(5),
});

const twoColumnSlideSchema = z.object({
  index: z.number().int().min(1),
  layoutId: z.literal('two_column'),
  title: z.string().min(1).max(70),
  leftTitle: z.string().min(1).max(45),
  rightTitle: z.string().min(1).max(45),
  leftBullets: z.array(z.string().min(1).max(80)).min(1).max(4),
  rightBullets: z.array(z.string().min(1).max(80)).min(1).max(4),
});

const closingSlideSchema = z.object({
  index: z.number().int().min(1),
  layoutId: z.literal('closing'),
  title: z.string().min(1).max(70),
  subtitle: z.string().min(1).max(140).optional(),
  bullets: z.array(z.string().min(1).max(90)).min(1).max(3),
});

export const deckSlideSchema = z.discriminatedUnion('layoutId', [
  titleSlideSchema,
  sectionSlideSchema,
  bulletsSlideSchema,
  twoColumnSlideSchema,
  closingSlideSchema,
]);

export const deckPlanSchema = z.object({
  title: z.string().min(1).max(80),
  audience: z.string().max(120).optional(),
  tone: z.string().max(80).optional(),
  outline: outlineDeckSchema,
  slides: z.array(deckSlideSchema).min(3).max(15),
});

export type DeckSlide = z.infer<typeof deckSlideSchema>;
export type DeckPlan = z.infer<typeof deckPlanSchema>;
