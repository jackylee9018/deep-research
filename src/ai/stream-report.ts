import { streamText } from 'ai';

import { systemPrompt } from '../prompt';
import {
  buildFinalReportPromptParts,
  REPORT_MARKDOWN_GUIDELINES,
} from '../report-writing-guidelines';
import { getModel, trimPrompt } from './providers';

export function streamFinalReport({
  prompt,
  learnings,
}: {
  prompt: string;
  learnings: string[];
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');
  const { promptSection, learningsSection } = buildFinalReportPromptParts(
    learningsString,
    prompt,
  );

  return streamText({
    model: getModel(),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as detailed as possible, aim for 3 or more pages, and include ALL the learnings from research. Do not include a Sources section — sources will be appended separately.\n\n${REPORT_MARKDOWN_GUIDELINES}\n\n${promptSection}\n\nHere are all the learnings from previous research:\n\n${learningsSection}`,
    ),
  });
}
