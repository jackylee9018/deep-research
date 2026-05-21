import HTMLtoDOCX from 'html-to-docx';

import {
  docxExportFilename,
  exportAttachmentHeaders,
  resolveExportBasename,
} from '@/export-report';
import { markdownToExportHtml } from '@/export-report-html';

export const runtime = 'nodejs';

async function toUint8Array(
  value: Buffer | ArrayBuffer | Blob | Uint8Array,
): Promise<Uint8Array> {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }
  if (value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer());
  }
  return new Uint8Array(value as ArrayBuffer);
}

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
  const filename = docxExportFilename(markdown, fallbackTitle);

  try {
    const html = await markdownToExportHtml(markdown);
    const buffer = await HTMLtoDOCX(html, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
    });

    const bytes = await toUint8Array(buffer);

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ...exportAttachmentHeaders(filename, basename),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: 'Export failed', message }, { status: 500 });
  }
}
