import { writeFile } from 'fs/promises';

import { resolvePptJobDeckPlan } from './jobs';
import { deckPlanSchema, type DeckPlan } from './schemas';

export async function persistDeckPlan(jobId: string, deckPlan: unknown): Promise<DeckPlan> {
  const parsed = deckPlanSchema.parse(deckPlan);
  await writeFile(
    resolvePptJobDeckPlan(jobId),
    JSON.stringify(parsed),
    'utf8',
  );
  return parsed;
}
