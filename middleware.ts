import { NextResponse, type NextRequest } from 'next/server';

import {
  buildPresentationAiEntryUrl,
  getPresentationAiOriginFromEnv,
} from './app/lib/presentation-ai-url';

function workspaceReturnUrl(request: NextRequest): string {
  return `${request.nextUrl.origin}/`;
}

function paramsFromPptRequest(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const prompt =
    searchParams.get('prompt')?.trim() ||
    searchParams.get('q')?.trim() ||
    undefined;
  const webSearch =
    searchParams.get('webSearch') === 'true' || Boolean(prompt);

  return {
    prompt,
    webSearch: prompt ? webSearch : false,
    returnUrl: workspaceReturnUrl(request),
  };
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/ppt')) {
    return NextResponse.next();
  }

  const target = buildPresentationAiEntryUrl(
    paramsFromPptRequest(request),
    getPresentationAiOriginFromEnv(),
  );

  return NextResponse.redirect(target);
}

export const config = {
  matcher: ['/ppt', '/ppt/:path*'],
};
