import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DEFAULT_OPENWEBUI_URL = 'https://ai.spit.hk';

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function GET() {
  const openWebUIUrl = normalizeOrigin(
    process.env.OPENWEBUI_URL ??
      process.env.NEXT_PUBLIC_OPENWEBUI_URL ??
      DEFAULT_OPENWEBUI_URL,
  );

  return NextResponse.json({
    openWebUIUrl,
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Open Deep Research',
  });
}
