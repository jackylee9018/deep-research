import { z } from 'zod';

function normalizeSerpQueryItem(item: unknown): unknown {
  if (typeof item === 'string') {
    return { query: item.trim(), researchGoal: '' };
  }

  if (!item || typeof item !== 'object') {
    return item;
  }

  const record = item as Record<string, unknown>;
  const query =
    typeof record.query === 'string'
      ? record.query
      : typeof record.q === 'string'
        ? record.q
        : typeof record.text === 'string'
          ? record.text
          : '';
  const researchGoal =
    typeof record.researchGoal === 'string'
      ? record.researchGoal
      : typeof record.research_goal === 'string'
        ? record.research_goal
        : '';

  return { query: query.trim(), researchGoal: researchGoal.trim() };
}

/** Accepts `queries` as strings or `{ query, researchGoal }` objects from the model. */
export function serpQueriesResponseSchema(options: {
  max: number;
  listDescription: string;
  queryFieldDescription?: string;
  researchGoalFieldDescription?: string;
}) {
  return z.object({
    queries: z.preprocess(
      value => (Array.isArray(value) ? value.map(normalizeSerpQueryItem) : value),
      z
        .array(
          z.object({
            query: z
              .string()
              .min(1)
              .describe(
                options.queryFieldDescription ?? 'The SERP query',
              ),
            researchGoal: z
              .string()
              .describe(
                options.researchGoalFieldDescription ??
                  'Research goal for this query and how to advance after results.',
              ),
          }),
        )
        .max(options.max)
        .describe(options.listDescription),
    ),
  });
}
