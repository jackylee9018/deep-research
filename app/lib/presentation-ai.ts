'use client';

import {
  buildPresentationAiEntryUrl,
  getPresentationAiOriginFromEnv,
  normalizePresentationAiOrigin,
  type PresentationAiUrlParams,
} from './presentation-ai-url';

export type PresentationAiParams = PresentationAiUrlParams;

let cachedOrigin: string | null = null;

/** Sync fallback (build-time NEXT_PUBLIC or default). */
export function getPresentationAiOrigin(): string {
  return getPresentationAiOriginFromEnv();
}

/** Runtime URL from server env (works after Docker build without rebuild). */
export async function resolvePresentationAiOrigin(): Promise<string> {
  if (cachedOrigin) {
    return cachedOrigin;
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/app-config', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { presentationAiUrl?: string };
        if (data.presentationAiUrl) {
          cachedOrigin = normalizePresentationAiOrigin(data.presentationAiUrl);
          return cachedOrigin;
        }
      }
    } catch {
      // use fallback below
    }
  }

  cachedOrigin = getPresentationAiOrigin();
  return cachedOrigin;
}

export function preloadPresentationAiOrigin(): void {
  void resolvePresentationAiOrigin();
}

export function getWorkspaceReturnUrl(path = '/'): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const base = window.location.origin;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/** Stable for SSR/hydration; pass `returnUrl` explicitly when known (e.g. after mount). */
export function buildPresentationAiCreateUrl(
  params: PresentationAiParams = {},
  origin: string = getPresentationAiOrigin(),
): string {
  return buildPresentationAiEntryUrl(params, origin);
}

function isSameAppRedirect(targetUrl: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const target = new URL(targetUrl);
    const current = window.location;
    return target.origin === current.origin;
  } catch {
    return false;
  }
}

export async function navigateToPresentationAi(
  params: PresentationAiParams = {},
): Promise<void> {
  const origin = await resolvePresentationAiOrigin();
  const url = buildPresentationAiCreateUrl(
    {
      ...params,
      returnUrl: params.returnUrl?.trim() || getWorkspaceReturnUrl('/'),
    },
    origin,
  );

  if (isSameAppRedirect(url)) {
    console.error(
      '[presentation-ai] PRESENTATION_AI_URL points to this app. Set PRESENTATION_AI_URL to your presentation-ai instance (e.g. http://localhost:9081).',
    );
    window.alert(
      '簡報服務網址設定不正確：目前會跳回本站。請在環境變數設定 PRESENTATION_AI_URL 為 presentation-ai 的完整網址。',
    );
    return;
  }

  window.location.replace(url);
}
