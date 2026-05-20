export type FollowUpEntry = { question: string; answer: string };

export function buildCombinedQuery(
  query: string,
  followUp?: FollowUpEntry[],
): string {
  if (!followUp?.length) {
    return query;
  }

  return `Initial Query: ${query}
Follow-up Questions and Answers:
${followUp.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n')}`;
}
