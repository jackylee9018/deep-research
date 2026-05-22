import {
  DEFAULT_TEMPLATE_THEME,
  type PptTemplateThemeColors,
} from './ppt-template-theme';

export type PptTemplateId = string;

export type ClientPptTemplateOption = {
  id: string;
  label: string;
  description: string;
  previewTheme: string;
  fileExists?: boolean;
} & PptTemplateThemeColors;

/** Fallback when /api/ppt/templates is unavailable. */
export const FALLBACK_PPT_TEMPLATE_OPTIONS: ClientPptTemplateOption[] = [
  {
    id: 'default',
    label: '經典藍',
    description: 'Office 標準版式，頂部藍色強調條',
    previewTheme: 'default',
    ...DEFAULT_TEMPLATE_THEME,
  },
  {
    id: 'corporate',
    label: '商務深綠',
    description: '深色頂欄、保守字級，適合報告與董事會',
    previewTheme: 'corporate',
    accent: '047857',
    title: '064E3B',
    body: '1E293B',
    muted: '475569',
    slideBackground: 'F0FDF4',
    slideBackgroundEnd: 'ECFDF5',
  },
  {
    id: 'minimal',
    label: '極簡灰',
    description: '低對比、細線條，適合技術與產品簡報',
    previewTheme: 'minimal',
    accent: '18181B',
    title: '18181B',
    body: '3F3F46',
    muted: '71717A',
    slideBackground: 'FAFAFA',
    slideBackgroundEnd: 'F4F4F5',
  },
];

export function resolvePptTemplateOption(
  id: string | undefined,
  options: ClientPptTemplateOption[] = FALLBACK_PPT_TEMPLATE_OPTIONS,
): ClientPptTemplateOption {
  return options.find(t => t.id === id) ?? options[0]!;
}

export async function fetchPptTemplateOptions(): Promise<ClientPptTemplateOption[]> {
  const res = await fetch('/api/ppt/templates', { cache: 'no-store' });
  if (!res.ok) {
    return FALLBACK_PPT_TEMPLATE_OPTIONS;
  }
  const data = (await res.json()) as { templates?: ClientPptTemplateOption[] };
  if (!data.templates?.length) {
    return FALLBACK_PPT_TEMPLATE_OPTIONS;
  }
  return data.templates;
}
