import { contentDispositionAttachment, httpHeaderValue } from './http-headers';
import { filenameFromTitle, slugifyAsciiForFilename } from './slugify';

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

export function resolveExportBasename(
  markdown: string,
  fallbackQuery: string,
): string {
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

export function markdownExportFilename(
  markdown: string,
  fallbackQuery: string,
): string {
  return filenameFromTitle(extractReportTitle(markdown, fallbackQuery), '.md');
}

export function docxExportFilename(
  markdown: string,
  fallbackQuery: string,
): string {
  return filenameFromTitle(
    extractReportTitle(markdown, fallbackQuery),
    '.docx',
  );
}

export function pdfExportFilename(
  markdown: string,
  fallbackQuery: string,
): string {
  return filenameFromTitle(extractReportTitle(markdown, fallbackQuery), '.pdf');
}
