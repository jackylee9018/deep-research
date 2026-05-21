'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { normalizeReportMarkdown } from '@/normalize-report-markdown';

export const reportMarkdownComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="table-wrap">
      <table {...props}>{children}</table>
    </div>
  ),
};

export function ResearchMarkdownContent({
  content,
  mode,
}: {
  content: string;
  mode: 'report' | 'answer';
}) {
  if (mode === 'answer') {
    return <p className="answer-box">{content}</p>;
  }

  const markdown = normalizeReportMarkdown(content);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={reportMarkdownComponents}
    >
      {markdown}
    </ReactMarkdown>
  );
}
