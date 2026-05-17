import { tavily } from '@tavily/core';

export type SearchResultItem = {
  url?: string;
  markdown?: string;
};

export type SearchResponse = {
  data: SearchResultItem[];
};

const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY ?? '',
});

export async function search(
  query: string,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<SearchResponse> {
  const { limit = 5, timeoutMs = 15_000 } = options;

  const response = await tavilyClient.search(query, {
    maxResults: limit,
    searchDepth: 'advanced',
    includeRawContent: 'markdown',
    timeout: Math.max(1, Math.ceil(timeoutMs / 1000)),
  });

  return {
    data: response.results.map(result => ({
      url: result.url,
      markdown: result.rawContent || result.content,
    })),
  };
}
