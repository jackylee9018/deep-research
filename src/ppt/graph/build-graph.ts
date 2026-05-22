import { END, START, StateGraph } from '@langchain/langgraph';

import { pptLog } from '../log';
import { planPptContent } from '../planner';
import { runPptExport } from '../export/run-ppt-export';
import { PptGraphAnnotation } from './state';

type PptGraphRuntimeState = typeof PptGraphAnnotation.State;

async function contentPlanner(state: PptGraphRuntimeState) {
  pptLog(`→ contentPlanner（嘗試 ${state.attempt + 1}/${state.maxAttempts}）`);
  const deckPlan = await planPptContent({
    prompt: state.userPrompt,
    outline: state.confirmedOutline,
    issues: state.issues,
    attachments: state.attachments,
    templateId: state.templateId ?? 'default',
  });

  return {
    deckPlan,
    attempt: state.attempt + 1,
    success: false,
    error: undefined,
  };
}

async function validateDeckPlan(state: PptGraphRuntimeState) {
  pptLog('→ validateDeckPlan（檢查簡報內容）');
  if (!state.deckPlan) {
    return {
      success: false,
      error: 'Deck plan is missing.',
      issues: [
        {
          code: 'missing_deck_plan',
          message: 'Deck plan is missing before validation.',
        },
      ],
    };
  }

  const result = await runPptExport({
    action: 'validate',
    plan: state.deckPlan,
  });

  return {
    issues: result.issues,
    slideCount: state.deckPlan.slides.length,
    success: result.success,
    error: result.success ? undefined : result.issues[0]?.message,
  };
}

function routeAfterValidation(state: PptGraphRuntimeState) {
  if (state.success) {
    return END;
  }

  if (state.attempt < state.maxAttempts) {
    return 'contentPlanner';
  }

  return END;
}

export function buildPptGraph() {
  return new StateGraph(PptGraphAnnotation)
    .addNode('contentPlanner', contentPlanner)
    .addNode('validateDeckPlan', validateDeckPlan)
    .addEdge(START, 'contentPlanner')
    .addEdge('contentPlanner', 'validateDeckPlan')
    .addConditionalEdges('validateDeckPlan', routeAfterValidation, [
      'contentPlanner',
      END,
    ])
    .compile();
}
