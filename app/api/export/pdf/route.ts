import {
  exportAttachmentHeaders,
  markdownToExportHtml,
  pdfExportFilename,
  resolveExportBasename,
} from '@/export-report';
import { htmlToPdfBuffer } from '@/pdf-export';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ExportRequestBody = {
  markdown?: string;
  title?: string;
};

export async function POST(req: Request) {
  let body: ExportRequestBody;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const markdown = body.markdown?.trim();
  if (!markdown) {
    return Response.json({ error: 'markdown is required' }, { status: 400 });
  }

  const fallbackTitle = body.title?.trim() || 'research-report';
  const basename = resolveExportBasename(markdown, fallbackTitle);
  const filename = pdfExportFilename(markdown, fallbackTitle);

  try {
    const html = await markdownToExportHtml(markdown);
    const bytes = await htmlToPdfBuffer(html);

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        ...exportAttachmentHeaders(filename, basename),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: 'Export failed', message }, { status: 500 });
  }
}
