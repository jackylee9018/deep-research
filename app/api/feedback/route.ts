import { runWithResearchModel } from '@/ai/model-context';
import { resolveResearchModelId } from '@/ai/research-models';
import { generateFeedback } from '@/feedback';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      query,
      numQuestions = 3,
      model,
    } = body as {
      query?: string;
      numQuestions?: number;
      model?: string;
    };

    if (!query?.trim()) {
      return Response.json({ error: 'Query is required' }, { status: 400 });
    }

    const modelId = resolveResearchModelId(model);
    const questions = await runWithResearchModel(modelId, () =>
      generateFeedback({ query: query.trim(), numQuestions }),
    );

    return Response.json({ questions });
  } catch (error: unknown) {
    console.error('Error in feedback API:', error);
    return Response.json(
      {
        error: 'Failed to generate follow-up questions',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
