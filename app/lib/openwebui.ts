'use client';

export type OpenWebUIChatParams = {
  q?: string;
  model?: string;
  models?: string[];
  webSearch?: boolean;
  temporaryChat?: boolean;
  codeInterpreter?: boolean;
  imageGeneration?: boolean;
  call?: boolean;
};

const DEFAULT_ORIGIN = 'https://ai.spit.hk';

let cachedOrigin: string | null = null;

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Sync fallback (build-time NEXT_PUBLIC or default). */
export function getOpenWebUIOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_OPENWEBUI_URL?.trim() || DEFAULT_ORIGIN;
  return normalizeOrigin(raw);
}

/** Runtime URL from server env (works after Docker build without rebuild). */
export async function resolveOpenWebUIOrigin(): Promise<string> {
  if (cachedOrigin) {
    return cachedOrigin;
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/app-config', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { openWebUIUrl?: string };
        if (data.openWebUIUrl) {
          cachedOrigin = normalizeOrigin(data.openWebUIUrl);
          return cachedOrigin;
        }
      }
    } catch {
      // use fallback below
    }
  }

  cachedOrigin = getOpenWebUIOrigin();
  return cachedOrigin;
}

export function preloadOpenWebUIOrigin(): void {
  void resolveOpenWebUIOrigin();
}

/**
 * Build an Open WebUI chat URL.
 * @see https://docs.openwebui.com/features/chat-conversations/chat-features/url-params
 */
export function buildOpenWebUIChatUrl(
  params: OpenWebUIChatParams = {},
  origin: string = getOpenWebUIOrigin(),
): string {
  const base = normalizeOrigin(origin);
  const url = new URL('/', base);

  const q = params.q?.trim();
  if (q) {
    url.searchParams.set('q', q);
  }

  if (params.model?.trim()) {
    url.searchParams.set('model', params.model.trim());
  } else if (params.models?.length) {
    url.searchParams.set(
      'models',
      params.models
        .map(m => m.trim())
        .filter(Boolean)
        .join(','),
    );
  } else {
    const envModel = process.env.NEXT_PUBLIC_OPENWEBUI_MODEL?.trim();
    if (envModel) {
      url.searchParams.set('model', envModel);
    }
  }

  if (params.webSearch) {
    url.searchParams.set('web-search', 'true');
  }
  if (params.temporaryChat) {
    url.searchParams.set('temporary-chat', 'true');
  }
  if (params.codeInterpreter) {
    url.searchParams.set('code-interpreter', 'true');
  }
  if (params.imageGeneration) {
    url.searchParams.set('image-generation', 'true');
  }
  if (params.call) {
    url.searchParams.set('call', 'true');
  }

  return url.toString();
}

function isSameAppRedirect(targetUrl: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const target = new URL(targetUrl);
    const current = window.location;
    return (
      target.origin === current.origin &&
      (target.pathname === '/' || target.pathname === current.pathname)
    );
  } catch {
    return false;
  }
}

export async function navigateToOpenWebUI(
  params: OpenWebUIChatParams = {},
): Promise<void> {
  const origin = await resolveOpenWebUIOrigin();
  const url = buildOpenWebUIChatUrl(params, origin);

  if (isSameAppRedirect(url)) {
    console.error(
      '[openwebui] OPENWEBUI_URL points to this app. Set OPENWEBUI_URL to your Open WebUI instance (e.g. https://ai.spit.hk).',
    );
    window.alert(
      'Open WebUI 網址設定不正確：目前會跳回本站。請在環境變數設定 OPENWEBUI_URL 為 Open WebUI 的完整網址。',
    );
    return;
  }

  window.location.replace(url);
}
