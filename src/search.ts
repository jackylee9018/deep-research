import { tavily } from '@tavily/core';

export class SearchAuthError extends Error {
  constructor(
    message = 'Tavily API key is missing or invalid (TAVILY_API_KEY)',
  ) {
    super(message);
    this.name = 'SearchAuthError';
  }
}

function isTavilyAuthFailure(message: string): boolean {
  return /unauthorized|invalid api key|missing.*api key|forbidden/i.test(
    message,
  );
}

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

  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isTavilyAuthFailure(message)) {
      throw new SearchAuthError(message);
    }
    throw error;
  }
}
