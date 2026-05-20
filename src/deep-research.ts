import { generateObject } from './ai/generate-object';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';

import { getModel, trimPrompt } from './ai/providers';
import { normalizeReportMarkdown } from './normalize-report-markdown';
import { systemPrompt } from './prompt';
import { search, type SearchResponse } from './search';

function log(...args: any[]) {
  console.log(...args);
}

export type ResearchProgress = {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
};

export type ResearchStep =
  | 'query-analysis'
  | 'web-search'
  | 'evaluation-cross-check'
  | 'synthesis'
  | 'report-generation';

export type ResearchActivity =
  | {
      type: 'step';
      step: ResearchStep;
      status: 'active' | 'done';
      detail?: string;
    }
  | {
      type: 'log';
      icon: 'search' | 'brain' | 'link' | 'check';
      message: string;
    }
  | {
      type: 'query-plan';
      queries: string[];
    }
  | {
      type: 'search-result';
      query: string;
      urls: string[];
      resultCount: number;
    }
  | {
      type: 'learning-result';
      query: string;
      learningsCount: number;
      followUpCount: number;
    };

type ResearchResult = {
  learnings: string[];
  visitedUrls: string[];
};

// increase this if you have higher API rate limits
const ConcurrencyLimit =
  Number(process.env.SEARCH_CONCURRENCY ?? process.env.TAVILY_CONCURRENCY) || 2;

// take en user query, return a list of SERP queries
async function generateSerpQueries({
  query,
  numQueries = 3,
  learnings,
}: {
  query: string;
  numQueries?: number;

  // optional, if provided, the research will continue from the last learning
  learnings?: string[];
}) {
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${
      learnings
        ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
            '\n',
          )}`
        : ''
    }`,
    schema: z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query'),
            researchGoal: z
              .string()
              .describe(
                'First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.',
              ),
          }),
        )
        .describe(`List of SERP queries, max of ${numQueries}`),
    }),
  });
  log(`Created ${res.object.queries.length} queries`, res.object.queries);

  return res.object.queries.slice(0, numQueries);
}

async function processSerpResult({
  query,
  result,
  numLearnings = 3,
  numFollowUpQuestions = 3,
}: {
  query: string;
  result: SearchResponse;
  numLearnings?: number;
  numFollowUpQuestions?: number;
}) {
  const contents = compact(result.data.map(item => item.markdown)).map(content =>
    trimPrompt(content, 25_000),
  );
  log(`Ran ${query}, found ${contents.length} contents`);

  const res = await generateObject({
    model: getModel(),
    abortSignal: AbortSignal.timeout(60_000),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.\n\n<contents>${contents
        .map(content => `<content>\n${content}\n</content>`)
        .join('\n')}</contents>`,
    ),
    schema: z.object({
      learnings: z.array(z.string()).describe(`List of learnings, max of ${numLearnings}`),
      followUpQuestions: z
        .array(z.string())
        .describe(
          `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
        ),
    }),
  });
  log(`Created ${res.object.learnings.length} learnings`, res.object.learnings);

  return res.object;
}

export type FinalReportResult = {
  title: string;
  markdown: string;
};

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
}: {
  prompt: string;
  learnings: string[];
  visitedUrls: string[];
}): Promise<FinalReportResult> {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as as detailed as possible, aim for 3 or more pages, include ALL the learnings from research. Use GitHub-Flavored Markdown only: ##/### headings, lists, blockquotes, and pipe tables with header row and |---|---| separator for comparisons and numeric data. Never use HTML tags (no <a>, <div>, etc.). Section titles must use ## or ###, not numbered plain text or HTML anchors.\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
    schema: z.object({
      reportTitle: z
        .string()
        .describe(
          'A short, descriptive title for this report (3–12 words). Use the same language as the user prompt. Suitable as a document name — no slashes or file extensions.',
        ),
      reportMarkdown: z
        .string()
        .describe(
          'Final report in GitHub-Flavored Markdown with pipe tables (header + |---|---| row) for data',
        ),
    }),
  });

  const urlsSection = `\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`;
  return {
    title: res.object.reportTitle.trim(),
    markdown: normalizeReportMarkdown(res.object.reportMarkdown) + urlsSection,
  };
}

export async function writeFinalAnswer({
  prompt,
  learnings,
}: {
  prompt: string;
  learnings: string[];
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final answer on the topic using the learnings from research. Follow the format specified in the prompt. Do not yap or babble or include any other text than the answer besides the format specified in the prompt. Keep the answer as concise as possible - usually it should be just a few words or maximum a sentence. Try to follow the format specified in the prompt (for example, if the prompt is using Latex, the answer should be in Latex. If the prompt gives multiple answer choices, the answer should be one of the choices).\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from research on the topic that you can use to help answer the prompt:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
    schema: z.object({
      exactAnswer: z
        .string()
        .describe('The final answer, make it short and concise, just the answer, no other text'),
    }),
  });

  return res.object.exactAnswer;
}

export async function deepResearch({
  query,
  breadth,
  depth,
  learnings = [],
  visitedUrls = [],
  onProgress,
  onActivity,
}: {
  query: string;
  breadth: number;
  depth: number;
  learnings?: string[];
  visitedUrls?: string[];
  onProgress?: (progress: ResearchProgress) => void;
  onActivity?: (activity: ResearchActivity) => void;
}): Promise<ResearchResult> {
  const progress: ResearchProgress = {
    currentDepth: depth,
    totalDepth: depth,
    currentBreadth: breadth,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
  };

  const reportProgress = (update: Partial<ResearchProgress>) => {
    Object.assign(progress, update);
    onProgress?.(progress);
  };

  const reportActivity = (activity: ResearchActivity) => {
    onActivity?.(activity);
  };

  reportActivity({
    type: 'step',
    step: 'query-analysis',
    status: 'active',
    detail: '正在分析查詢意圖',
  });
  reportActivity({
    type: 'log',
    icon: 'brain',
    message: '正在分析查詢意圖與研究範圍...',
  });

  const serpQueries = await generateSerpQueries({
    query,
    learnings,
    numQueries: breadth,
  });

  reportActivity({
    type: 'query-plan',
    queries: serpQueries.map(item => item.query),
  });
  reportActivity({
    type: 'step',
    step: 'query-analysis',
    status: 'done',
    detail: `完成查詢規劃，共 ${serpQueries.length} 個子查詢`,
  });
  reportActivity({
    type: 'step',
    step: 'web-search',
    status: 'active',
    detail: `已啟動 ${serpQueries.length} 個搜尋任務`,
  });
  reportActivity({
    type: 'log',
    icon: 'search',
    message: `發起 ${serpQueries.length} 個平行搜索任務...`,
  });

  reportProgress({
    totalQueries: serpQueries.length,
    currentQuery: serpQueries[0]?.query,
  });

  const limit = pLimit(ConcurrencyLimit);

  const results = await Promise.all(
    serpQueries.map(serpQuery =>
      limit(async () => {
        try {
          reportActivity({
            type: 'log',
            icon: 'search',
            message: `搜尋中：${serpQuery.query}`,
          });
          const result = await search(serpQuery.query, {
            timeoutMs: 15_000,
            limit: 5,
          });

          // Collect URLs from this search
          const newUrls = compact(result.data.map(item => item.url));
          reportActivity({
            type: 'search-result',
            query: serpQuery.query,
            urls: newUrls,
            resultCount: newUrls.length,
          });
          reportActivity({
            type: 'log',
            icon: 'link',
            message: `「${serpQuery.query}」取得 ${newUrls.length} 個來源`,
          });
          const newBreadth = Math.ceil(breadth / 2);
          const newDepth = depth - 1;

          reportActivity({
            type: 'step',
            step: 'evaluation-cross-check',
            status: 'active',
            detail: '正在提取關鍵事實並交叉比對',
          });
          const newLearnings = await processSerpResult({
            query: serpQuery.query,
            result,
            numFollowUpQuestions: newBreadth,
          });
          reportActivity({
            type: 'learning-result',
            query: serpQuery.query,
            learningsCount: newLearnings.learnings.length,
            followUpCount: newLearnings.followUpQuestions.length,
          });
          reportActivity({
            type: 'log',
            icon: 'check',
            message: `已提取 ${newLearnings.learnings.length} 條關鍵事實，並產生 ${newLearnings.followUpQuestions.length} 個延伸方向`,
          });
          const allLearnings = [...learnings, ...newLearnings.learnings];
          const allUrls = [...visitedUrls, ...newUrls];

          if (newDepth > 0) {
            log(`Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`);
            reportActivity({
              type: 'step',
              step: 'synthesis',
              status: 'active',
              detail: `進入更深層研究（剩餘深度 ${newDepth}）`,
            });
            reportActivity({
              type: 'log',
              icon: 'brain',
              message: `發現可深入方向，正在展開第 ${newDepth} 層研究...`,
            });

            reportProgress({
              currentDepth: newDepth,
              currentBreadth: newBreadth,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });

            const nextQuery = `
            Previous research goal: ${serpQuery.researchGoal}
            Follow-up research directions: ${newLearnings.followUpQuestions.map(q => `\n${q}`).join('')}
          `.trim();

            return deepResearch({
              query: nextQuery,
              breadth: newBreadth,
              depth: newDepth,
              learnings: allLearnings,
              visitedUrls: allUrls,
              onProgress,
              onActivity,
            });
          } else {
            reportProgress({
              currentDepth: 0,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });
            reportActivity({
              type: 'step',
              step: 'evaluation-cross-check',
              status: 'done',
              detail: '本輪來源評估完成',
            });
            return {
              learnings: allLearnings,
              visitedUrls: allUrls,
            };
          }
        } catch (e: any) {
          if (e.message && e.message.includes('Timeout')) {
            log(`Timeout error running query: ${serpQuery.query}: `, e);
          } else {
            log(`Error running query: ${serpQuery.query}: `, e);
          }
          reportActivity({
            type: 'log',
            icon: 'link',
            message: `「${serpQuery.query}」搜尋失敗，已自動跳過`,
          });
          return {
            learnings: [],
            visitedUrls: [],
          };
        }
      }),
    ),
  );

  return {
    learnings: [...new Set(results.flatMap(r => r.learnings))],
    visitedUrls: [...new Set(results.flatMap(r => r.visitedUrls))],
  };
}
