import type { FetchFunction } from '@ai-sdk/provider-utils';

export type OpenRouterProviderRouting = {
  order?: string[];
  only?: string[];
  ignore?: string[];
  quantizations?: string[];
  allow_fallbacks?: boolean;
};

function parseCsvEnv(name: string): string[] | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return undefined;
  }

  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length ? values : undefined;
}

function parseBooleanEnv(name: string): boolean | undefined {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === 'false' || raw === '0') {
    return false;
  }
  return undefined;
}

/** Build OpenRouter `provider` routing from env (see README). */
export function getOpenRouterProviderRouting(): OpenRouterProviderRouting | undefined {
  const order =
    parseCsvEnv('OPENROUTER_PROVIDER') ?? parseCsvEnv('OPENROUTER_PROVIDERS');
  const only = parseCsvEnv('OPENROUTER_PROVIDER_ONLY');
  const ignore = parseCsvEnv('OPENROUTER_PROVIDER_IGNORE');
  const quantizations = parseCsvEnv('OPENROUTER_QUANTIZATIONS');
  const allow_fallbacks = parseBooleanEnv('OPENROUTER_ALLOW_FALLBACKS');

  const routing: OpenRouterProviderRouting = {};
  if (order?.length) {
    routing.order = order;
  }
  if (only?.length) {
    routing.only = only;
  }
  if (ignore?.length) {
    routing.ignore = ignore;
  }
  if (quantizations?.length) {
    routing.quantizations = quantizations;
  }
  if (allow_fallbacks !== undefined) {
    routing.allow_fallbacks = allow_fallbacks;
  }

  return Object.keys(routing).length ? routing : undefined;
}

export function createOpenRouterFetch(
  providerRouting: OpenRouterProviderRouting,
  baseFetch: typeof fetch = fetch,
): FetchFunction {
  return async (input, init) => {
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body) as {
          provider?: OpenRouterProviderRouting;
        };
        body.provider = { ...body.provider, ...providerRouting };
        return baseFetch(input, {
          ...init,
          body: JSON.stringify(body),
        });
      } catch {
        // non-JSON body; pass through
      }
    }

    return baseFetch(input, init);
  };
}
