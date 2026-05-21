import assert from 'node:assert';
import { describe, it } from 'node:test';

import { serpQueriesResponseSchema } from './serp-queries-schema';

const schema = serpQueriesResponseSchema({
  max: 3,
  listDescription: 'queries',
});

describe('serpQueriesResponseSchema', () => {
  it('accepts string query items from the model', () => {
    const parsed = schema.parse({
      queries: ['topic A', 'topic B'],
    });
    assert.deepEqual(parsed.queries, [
      { query: 'topic A', researchGoal: '' },
      { query: 'topic B', researchGoal: '' },
    ]);
  });

  it('accepts object query items', () => {
    const parsed = schema.parse({
      queries: [{ query: 'q1', researchGoal: 'goal 1' }],
    });
    assert.deepEqual(parsed.queries[0], {
      query: 'q1',
      researchGoal: 'goal 1',
    });
  });

  it('normalizes research_goal snake_case', () => {
    const parsed = schema.parse({
      queries: [{ query: 'q1', research_goal: 'goal' }],
    });
    assert.equal(parsed.queries[0]?.researchGoal, 'goal');
  });
});
