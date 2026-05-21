import { compact, uniq } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';

import { generateObject } from '@/ai/generate-object';
import { serpQueriesResponseSchema } from '@/serp-queries-schema';
import { getModel, trimPrompt } from '@/ai/providers';
import { systemPrompt } from '@/prompt';
import { search, type SearchResponse } from '@/search';

const MAX_OUTLINE_QUERIES = 2;
const MAX_LEARNINGS_PER_QUERY = 3;
const ConcurrencyLimit =
  Number(process.env.SEARCH_CONCURRENCY ?? process.env.TAVILY_CONCURRENCY) || 2;

export class OutlineWebSearchUnavailableError extends Error {
  constructor(message = 'Web search is not configured (TAVILY_API_KEY missing)') {
    super(message);
    this.name = 'OutlineWebSearchUnavailableError';
  }
}

export function isOutlineWebSearchAvailable(): boolean {
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}

async function generateOutlineSerpQueries(prompt: string) {
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `使用者要製作一份簡報，主題如下。請產生最多 ${MAX_OUTLINE_QUERIES} 條網路搜尋查詢，用於蒐集製作「簡報大綱」所需的事實與脈絡。查詢請用繁體中文或常見的繁中/英文關鍵字，彼此不重複、盡量具體。

<prompt>${prompt}</prompt>`,
    schema: serpQueriesResponseSchema({
      max: MAX_OUTLINE_QUERIES,
      listDescription: `List of SERP queries, max of ${MAX_OUTLINE_QUERIES}`,
      queryFieldDescription: 'SERP search query',
      researchGoalFieldDescription:
        'What this query should uncover for the deck outline',
    }),
  });

  return res.object.queries.slice(0, MAX_OUTLINE_QUERIES);
}

async function extractOutlineLearnings(query: string, result: SearchResponse) {
  const contents = compact(result.data.map(item => item.markdown)).map(
    content => trimPrompt(content, 25_000),
  );

  if (!contents.length) {
    return { learnings: [] as string[], urls: [] as string[] };
  }

  const res = await generateObject({
    model: getModel(),
    abortSignal: AbortSignal.timeout(60_000),
    system: systemPrompt(),
    prompt: trimPrompt(
      `以下是針對查詢 <query>${query}</query> 的搜尋結果。請萃取最多 ${MAX_LEARNINGS_PER_QUERY} 條「可用於簡報大綱」的關鍵事實（繁體中文、精簡、資訊密度高）。包含實體、數字、日期（若有）。不要產生 follow-up 問題。

<contents>${contents
        .map(content => `<content>\n${content}\n</content>`)
        .join('\n')}</contents>`,
    ),
    schema: z.object({
      learnings: z
        .array(z.string())
        .describe(`List of learnings, max of ${MAX_LEARNINGS_PER_QUERY}`),
    }),
  });

  const urls = compact(result.data.map(item => item.url));

  return {
    learnings: res.object.learnings.slice(0, MAX_LEARNINGS_PER_QUERY),
    urls,
  };
}

function formatWebContext(
  prompt: string,
  items: { query: string; learnings: string[]; urls: string[] }[],
): string {
  const sections = items
    .filter(item => item.learnings.length > 0)
    .map((item, index) => {
      const bullets = item.learnings.map(l => `- ${l}`).join('\n');
      const sources = item.urls.length
        ? `\n來源：${item.urls.slice(0, 5).join(', ')}`
        : '';
      return `### 查詢 ${index + 1}：${item.query}\n${bullets}${sources}`;
    });

  if (!sections.length) {
    return '（聯網搜尋未找到可用內容，請依使用者需求與附件自行規劃大綱。）';
  }

  return [
    '以下為聯網搜尋整理的研究筆記，僅供規劃簡報大綱：',
    `主題：${prompt.trim()}`,
    '',
    ...sections,
  ].join('\n');
}

export async function gatherOutlineWebContext(
  prompt: string,
): Promise<{ context: string; visitedUrls: string[] }> {
  if (!isOutlineWebSearchAvailable()) {
    throw new OutlineWebSearchUnavailableError();
  }

  const serpQueries = await generateOutlineSerpQueries(prompt);
  const limit = pLimit(ConcurrencyLimit);

  const results = await Promise.all(
    serpQueries.map(({ query }) =>
      limit(async () => {
        const result = await search(query, { timeoutMs: 15_000, limit: 5 });
        const { learnings, urls } = await extractOutlineLearnings(
          query,
          result,
        );
        return { query, learnings, urls };
      }),
    ),
  );

  const visitedUrls = uniq(results.flatMap(item => item.urls));

  return {
    context: formatWebContext(prompt, results),
    visitedUrls,
  };
}
