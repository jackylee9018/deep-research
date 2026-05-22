export type PresentationAiUrlParams = {
  prompt?: string;
  language?: string;
  noOfSlides?: number;
  webSearch?: boolean;
  returnUrl?: string;
};

export const PRESENTATION_AI_ENTRY_PATH = '/presentation';

const DEFAULT_PRESENTATION_AI_ORIGIN = 'http://localhost:9081';

export function normalizePresentationAiOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Server and client sync fallback (NEXT_PUBLIC or default). */
export function getPresentationAiOriginFromEnv(): string {
  const raw =
    process.env.PRESENTATION_AI_URL?.trim() ||
    process.env.NEXT_PUBLIC_PRESENTATION_AI_URL?.trim() ||
    DEFAULT_PRESENTATION_AI_ORIGIN;
  return normalizePresentationAiOrigin(raw);
}

export function buildPresentationAiEntryUrl(
  params: PresentationAiUrlParams = {},
  origin: string = getPresentationAiOriginFromEnv(),
): string {
  const base = normalizePresentationAiOrigin(origin);
  const url = new URL(PRESENTATION_AI_ENTRY_PATH, base);

  const prompt = params.prompt?.trim();
  if (prompt) {
    url.searchParams.set('prompt', prompt);
  }

  url.searchParams.set('language', params.language?.trim() || 'zh');

  const slides = params.noOfSlides;
  if (slides != null && Number.isFinite(slides)) {
    url.searchParams.set(
      'noOfSlides',
      String(Math.min(12, Math.max(1, Math.floor(slides)))),
    );
  } else if (prompt) {
    url.searchParams.set('noOfSlides', '10');
  }

  if (params.webSearch) {
    url.searchParams.set('webSearch', 'true');
  }

  const returnUrl = params.returnUrl?.trim();
  if (returnUrl) {
    url.searchParams.set('returnUrl', returnUrl);
  }

  return url.toString();
}
