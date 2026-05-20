import { createDataStreamResponse } from 'ai';

import { streamFinalReport } from '@/ai/stream-report';
import {
  deepResearch,
  type ResearchActivity,
  writeFinalAnswer,
  type ResearchProgress,
} from '@/deep-research';
import { buildCombinedQuery, type FollowUpEntry } from '@/research-query';

export const runtime = 'nodejs';

type ResearchRequestBody = {
  query?: string;
  breadth?: number;
  depth?: number;
  mode?: 'report' | 'answer';
  followUp?: FollowUpEntry[];
  messages?: { role: string; content: string }[];
};

function progressPayload(p: ResearchProgress) {
  return {
    type: 'progress' as const,
    currentDepth: p.currentDepth,
    totalDepth: p.totalDepth,
    currentBreadth: p.currentBreadth,
    totalBreadth: p.totalBreadth,
    currentQuery: p.currentQuery ?? null,
    totalQueries: p.totalQueries,
    completedQueries: p.completedQueries,
  };
}

function activityPayload(activity: ResearchActivity) {
  return activity;
}

export async function POST(req: Request) {
  let body: ResearchRequestBody;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const query =
    body.query?.trim() ??
    [...(body.messages ?? [])].reverse().find(m => m.role === 'user')?.content?.trim();

  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 });
  }

  const breadth = body.breadth ?? 4;
  const depth = body.depth ?? 2;
  const mode = body.mode ?? 'report';
  const combinedQuery = buildCombinedQuery(query, body.followUp);

  return createDataStreamResponse({
    execute: async dataStream => {
      dataStream.writeData({ type: 'phase', phase: 'research' });

      const result = await deepResearch({
        query: combinedQuery,
        breadth,
        depth,
        onProgress: p => {
          dataStream.writeData(progressPayload(p));
        },
        onActivity: activity => {
          dataStream.writeData(activityPayload(activity));
        },
      });

      dataStream.writeData({
        type: 'step',
        step: 'synthesis',
        status: 'done',
        detail: '多輪資訊整合完成',
      });

      dataStream.writeData({
        type: 'learnings',
        count: result.learnings.length,
        urlsCount: result.visitedUrls.length,
      });

      if (mode === 'answer') {
        dataStream.writeData({ type: 'phase', phase: 'writing' });
        dataStream.writeData({
          type: 'step',
          step: 'report-generation',
          status: 'active',
          detail: '正在生成最終答案',
        });
        const answer = await writeFinalAnswer({
          prompt: combinedQuery,
          learnings: result.learnings,
        });
        dataStream.writeData({ type: 'answer', answer });
        dataStream.writeData({
          type: 'step',
          step: 'report-generation',
          status: 'done',
          detail: '答案生成完成',
        });
        dataStream.writeData({ type: 'sources', urls: result.visitedUrls });
        return;
      }

      dataStream.writeData({ type: 'phase', phase: 'writing' });
      dataStream.writeData({
        type: 'step',
        step: 'report-generation',
        status: 'active',
        detail: '正在撰寫報告',
      });
      const stream = streamFinalReport({
        prompt: combinedQuery,
        learnings: result.learnings,
      });
      stream.mergeIntoDataStream(dataStream);
      dataStream.writeData({
        type: 'step',
        step: 'report-generation',
        status: 'done',
        detail: '報告生成完成',
      });
      dataStream.writeData({ type: 'sources', urls: result.visitedUrls });
    },
    onError: error => {
      console.error('Error in research stream:', error);
      return error instanceof Error ? error.message : 'Research failed';
    },
  });
}
