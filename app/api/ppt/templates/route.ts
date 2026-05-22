import { existsSync } from 'fs';
import { NextResponse } from 'next/server';

import { listPptTemplates } from '@/ppt/templates/registry';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const templates = listPptTemplates().map(entry => ({
      id: entry.id,
      label: entry.label,
      description: entry.description,
      previewTheme: entry.previewTheme,
      file: entry.file,
      fileExists: existsSync(entry.absolutePath),
      accent: entry.exportTheme.accent,
      title: entry.exportTheme.title,
      body: entry.exportTheme.body,
      muted: entry.exportTheme.muted,
      slideBackground: entry.exportTheme.slideBackground,
      slideBackgroundEnd: entry.exportTheme.slideBackgroundEnd,
    }));

    return NextResponse.json({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message, templates: [] },
      { status: 500 },
    );
  }
}
