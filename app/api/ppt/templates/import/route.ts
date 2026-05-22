import { NextResponse } from 'next/server';

import { pptLog, pptLogError } from '@/ppt/log';
import { importPptTemplateFromBuffer } from '@/ppt/templates/import-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PPTX_BYTES = 25 * 1024 * 1024;

function isPptxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.pptx') ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.type === 'application/octet-stream'
  );
}

/**
 * POST /api/ppt/templates/import
 *
 * multipart/form-data:
 * - file (required): .pptx
 * - id (optional): template id slug [a-z][a-z0-9_-]*
 * - label (optional): display name
 * - description (optional)
 */
export async function POST(req: Request) {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '請上傳 .pptx 檔案（欄位名 file）' }, { status: 400 });
  }

  if (!isPptxFile(file)) {
    return NextResponse.json({ error: '僅支援 .pptx 檔案' }, { status: 400 });
  }

  if (file.size > MAX_PPTX_BYTES) {
    return NextResponse.json(
      {
        error: `PPTX 不得超過 ${MAX_PPTX_BYTES / (1024 * 1024)} MB`,
      },
      { status: 400 },
    );
  }

  const id = formData.get('id');
  const label = formData.get('label');
  const description = formData.get('description');

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = importPptTemplateFromBuffer({
      buffer,
      originalName: file.name,
      id: typeof id === 'string' ? id : undefined,
      label: typeof label === 'string' ? label : undefined,
      description: typeof description === 'string' ? description : undefined,
    });

    const analysisSummary =
      result.analysis.layoutCount > 0
        ? `母片解析成功：${result.analysis.layoutCount} 種版式`
        : '母片解析未執行（已套用預設版式索引）';

    pptLog(
      `模板匯入：${result.template.id}｜${result.created ? '新增' : '更新'}｜${file.name}｜${analysisSummary}`,
    );

    const t = result.template;
    return NextResponse.json({
      ok: true,
      ...result,
      analysisSummary,
      template: {
        id: t.id,
        label: t.label,
        description: t.description,
        previewTheme: t.previewTheme,
        file: t.file,
        fileExists: true,
        accent: t.exportTheme.accent,
        title: t.exportTheme.title,
        body: t.exportTheme.body,
        muted: t.exportTheme.muted,
        slideBackground: t.exportTheme.slideBackground,
        slideBackgroundEnd: t.exportTheme.slideBackgroundEnd,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pptLogError('模板匯入失敗：', message);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
