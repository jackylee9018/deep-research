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

function normalizeTemplateOption(raw: unknown): ClientPptTemplateOption | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  if (!id) {
    return null;
  }

  const exportTheme =
    row.exportTheme && typeof row.exportTheme === 'object'
      ? (row.exportTheme as Record<string, unknown>)
      : null;

  const pickColor = (key: keyof PptTemplateThemeColors): string => {
    const fromRow = row[key];
    if (typeof fromRow === 'string' && row[key]) {
      return fromRow;
    }
    const fromTheme = exportTheme?.[key];
    if (typeof fromTheme === 'string' && fromTheme) {
      return fromTheme;
    }
    return DEFAULT_TEMPLATE_THEME[key];
  };

  return {
    id,
    label: typeof row.label === 'string' && row.label.trim() ? row.label : id,
    description: typeof row.description === 'string' ? row.description : '',
    previewTheme:
      typeof row.previewTheme === 'string' && row.previewTheme.trim()
        ? row.previewTheme
        : id,
    fileExists: row.fileExists !== false,
    accent: pickColor('accent'),
    title: pickColor('title'),
    body: pickColor('body'),
    muted: pickColor('muted'),
    slideBackground: pickColor('slideBackground'),
    slideBackgroundEnd: pickColor('slideBackgroundEnd'),
  };
}

export async function fetchPptTemplateOptions(): Promise<{
  templates: ClientPptTemplateOption[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/ppt/templates', { cache: 'no-store' });
    if (!res.ok) {
      return {
        templates: FALLBACK_PPT_TEMPLATE_OPTIONS,
        error: `載入模板失敗（HTTP ${res.status}）`,
      };
    }
    const data = (await res.json()) as { templates?: unknown[]; error?: string };
    if (data.error) {
      return { templates: FALLBACK_PPT_TEMPLATE_OPTIONS, error: data.error };
    }
    const normalized = (data.templates ?? [])
      .map(normalizeTemplateOption)
      .filter((t): t is ClientPptTemplateOption => t !== null);
    if (!normalized.length) {
      return {
        templates: FALLBACK_PPT_TEMPLATE_OPTIONS,
        error: '模板列表為空',
      };
    }
    return { templates: normalized };
  } catch (error) {
    return {
      templates: FALLBACK_PPT_TEMPLATE_OPTIONS,
      error: error instanceof Error ? error.message : '載入模板失敗',
    };
  }
}

export type PptTemplateImportResponse = {
  ok: true;
  template: ClientPptTemplateOption & { file: string; fileExists: boolean };
  created: boolean;
  overwritten: boolean;
  warnings: string[];
  analysisSummary: string;
};

export async function importPptTemplateFile(
  file: File,
  options?: { id?: string; label?: string; description?: string },
): Promise<PptTemplateImportResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.id?.trim()) {
    formData.append('id', options.id.trim());
  }
  if (options?.label?.trim()) {
    formData.append('label', options.label.trim());
  }
  if (options?.description?.trim()) {
    formData.append('description', options.description.trim());
  }

  const res = await fetch('/api/ppt/templates/import', {
    method: 'POST',
    body: formData,
  });

  let data: PptTemplateImportResponse & { ok?: boolean; error?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(`匯入失敗（HTTP ${res.status}，回應非 JSON）`);
  }

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error ?? `匯入失敗（HTTP ${res.status}）`);
  }

  const normalized = normalizeTemplateOption({
    ...data.template,
    fileExists: true,
  });
  if (!normalized) {
    throw new Error('匯入成功但模板資料格式無效');
  }

  return {
    ...data,
    template: { ...normalized, file: data.template.file, fileExists: true },
  };
}
