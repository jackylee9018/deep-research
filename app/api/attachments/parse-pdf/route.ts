import { extractPdfText } from '@/pdf-text-extract';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 12 * 1024 * 1024;

export async function POST(req: Request) {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'PDF file is required' }, { status: 400 });
  }

  if (
    file.type !== 'application/pdf' &&
    !file.name.toLowerCase().endsWith('.pdf')
  ) {
    return Response.json({ error: '僅支援 PDF 檔案' }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return Response.json(
      { error: `PDF 不得超過 ${MAX_FILE_BYTES / (1024 * 1024)} MB` },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfText(buffer);
    return Response.json({ name: file.name, text });
  } catch (error) {
    console.error('PDF parse error:', error);
    return Response.json(
      {
        error: 'Failed to parse PDF',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
