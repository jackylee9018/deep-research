import { marked } from 'marked';

import {
  contentDispositionAttachment,
  httpHeaderValue,
} from './http-headers';
import { normalizeReportMarkdown } from './normalize-report-markdown';
import { filenameFromTitle, slugifyAsciiForFilename } from './slugify';

const DOC_STYLES = `
body { font-family: "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif; font-size: 11pt; line-height: 1.5; color: #111; }
h1 { font-size: 20pt; margin: 0 0 12pt; }
h2 { font-size: 16pt; margin: 18pt 0 8pt; border-bottom: 1px solid #ccc; padding-bottom: 4pt; }
h3 { font-size: 13pt; margin: 14pt 0 6pt; }
p { margin: 0 0 8pt; }
ul, ol { margin: 0 0 8pt; padding-left: 24pt; }
blockquote { margin: 8pt 0; padding: 6pt 12pt; border-left: 3pt solid #4a7fd4; background: #f5f8fc; color: #333; }
table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
th, td { border: 1px solid #666; padding: 5pt 8pt; vertical-align: top; }
th { background: #e8eef8; font-weight: bold; }
tr:nth-child(even) td { background: #f7f9fc; }
code { font-family: Consolas, monospace; font-size: 9.5pt; background: #f0f0f0; padding: 1pt 3pt; }
pre { background: #f0f0f0; padding: 8pt; border: 1px solid #ccc; overflow-x: auto; }
pre code { background: none; padding: 0; }
a { color: #1a5fb4; }
hr { border: none; border-top: 1px solid #ccc; margin: 16pt 0; }
@page { margin: 20mm 15mm; }
h2, h3 { page-break-after: avoid; }
table, blockquote, pre { page-break-inside: avoid; }
`;

export function extractReportTitle(markdown: string, fallback: string): string {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1?.[1]) {
    return h1[1].trim();
  }
  const firstLine = markdown
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0);
  if (firstLine && firstLine.length <= 120) {
    return firstLine.replace(/^#+\s*/, '');
  }
  return fallback.trim() || 'research-report';
}

export function resolveExportBasename(markdown: string, fallbackQuery: string): string {
  return slugifyAsciiForFilename(extractReportTitle(markdown, fallbackQuery));
}

export function exportAttachmentHeaders(
  filename: string,
  basename: string,
): Record<string, string> {
  return {
    'Content-Disposition': contentDispositionAttachment(filename),
    'X-Export-Basename': httpHeaderValue(basename),
  };
}

export function markdownExportFilename(markdown: string, fallbackQuery: string): string {
  return filenameFromTitle(extractReportTitle(markdown, fallbackQuery), '.md');
}

export function docxExportFilename(markdown: string, fallbackQuery: string): string {
  return filenameFromTitle(extractReportTitle(markdown, fallbackQuery), '.docx');
}

export function pdfExportFilename(markdown: string, fallbackQuery: string): string {
  return filenameFromTitle(extractReportTitle(markdown, fallbackQuery), '.pdf');
}

export async function markdownToExportHtml(markdown: string): Promise<string> {
  const normalized = normalizeReportMarkdown(markdown);
  const bodyHtml = await marked.parse(normalized, { gfm: true, breaks: false });
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <style>${DOC_STYLES}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
