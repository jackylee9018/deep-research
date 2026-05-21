/** Shared instructions for final research report markdown (stream + structured). */
export const REPORT_MARKDOWN_GUIDELINES = `
Use GitHub-Flavored Markdown only: ##/### headings, bullet lists, blockquotes, and pipe tables.
Never use HTML tags (no <a>, <div>, <span>, etc.). Section titles must use ## or ###, not numbered plain text or HTML anchors.

Report structure:
- Open with ## Executive summary: 3–6 bullets covering conclusion, the most important numbers, and the main risk or opportunity.
- Organize the body into 4–8 ## sections for major themes; use ### for subtopics within each section.
- Put comparisons, metrics, timelines, and numeric data in pipe tables (header row + |---|---| separator). Prefer one focused table per comparison; add one interpretive sentence immediately below each table.
- For processes or architecture, describe them in prose or bullet lists; do not use diagram code blocks.
`.trim();

export const REPORT_MARKDOWN_SCHEMA_HINT =
  'Final report in GitHub-Flavored Markdown with pipe tables for data';

export function buildFinalReportPromptParts(learningsString: string, prompt: string) {
  return {
    learningsSection: `<learnings>\n${learningsString}\n</learnings>`,
    promptSection: `<prompt>${prompt}</prompt>`,
  };
}
