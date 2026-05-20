import { streamText } from 'ai';

import { getModel, trimPrompt } from './providers';
import { systemPrompt } from '../prompt';

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

  return streamText({
    model: getModel(),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as detailed as possible, aim for 3 or more pages, include ALL the learnings from research. Output valid GitHub-Flavored Markdown only: use ##/### headings, bullet lists, blockquotes, and pipe tables with a header row and |---|---| separator row for comparisons and numeric data. Never use HTML tags (no <a>, <div>, <span>, etc.). Section titles must use ## or ###, not numbered plain text or HTML anchors. Do not include a Sources section — sources will be appended separately.\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
  });
}
