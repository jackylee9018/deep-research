import { END, START, StateGraph } from '@langchain/langgraph';

import { pptLog } from '../log';
import { planPptContent } from '../planner';
import { runPptxSkill } from '../skill/run-pptx-skill';
import { PptGraphAnnotation } from './state';

type PptGraphRuntimeState = typeof PptGraphAnnotation.State;

async function contentPlanner(state: PptGraphRuntimeState) {
  pptLog(`→ contentPlanner（嘗試 ${state.attempt + 1}/${state.maxAttempts}）`);
  const deckPlan = await planPptContent({
    prompt: state.userPrompt,
    outline: state.confirmedOutline,
    issues: state.issues,
    attachments: state.attachments,
  });

  return {
    deckPlan,
    attempt: state.attempt + 1,
    success: false,
    error: undefined,
  };
}

async function generatePptx(state: PptGraphRuntimeState) {
  pptLog('→ generatePptx（Python 產生 .pptx）');
  if (!state.deckPlan) {
    return {
      success: false,
      error: 'Deck plan is missing.',
      issues: [
        {
          code: 'missing_deck_plan',
          message: 'Deck plan is missing before PPTX generation.',
        },
      ],
    };
  }

  const result = await runPptxSkill({
    action: 'generate',
    plan: state.deckPlan,
    outputPath: state.outputPath,
  });

  return {
    filePath: result.file_path,
    slideCount: result.slide_count,
    issues: result.issues,
    success: result.success,
    error: result.success ? undefined : result.issues[0]?.message,
  };
}

async function validate(state: PptGraphRuntimeState) {
  pptLog('→ validate（Python 驗證輸出）');
  if (!state.deckPlan) {
    return {
      success: false,
      error: 'Deck plan is missing.',
    };
  }

  if (state.issues.length) {
    return {
      success: false,
      error: state.issues[0]?.message,
    };
  }

  const result = await runPptxSkill({
    action: 'validate',
    plan: state.deckPlan,
  });

  return {
    issues: result.issues,
    slideCount: state.slideCount ?? result.slide_count,
    success: result.success && Boolean(state.filePath),
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
    .addNode('generatePptx', generatePptx)
    .addNode('validate', validate)
    .addEdge(START, 'contentPlanner')
    .addEdge('contentPlanner', 'generatePptx')
    .addEdge('generatePptx', 'validate')
    .addConditionalEdges('validate', routeAfterValidation, [
      'contentPlanner',
      END,
    ])
    .compile();
}
