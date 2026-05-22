import { existsSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';

import { PPT_LAYOUT_CATALOG, PPT_LAYOUT_IDS, type PptLayoutId } from '../schemas/layout-catalog';
import { runPptTemplateAnalysis, type PptTemplateAnalysis } from './analyze-template';
import {
  invalidatePptTemplateRegistryCache,
  loadPptTemplateRegistryRaw,
  type PptExportTheme,
  type PptTemplateEntry,
} from './registry';

const REPO_ROOT = process.cwd();
const TEMPLATES_DIR = path.join(REPO_ROOT, 'templates');
const REGISTRY_PATH = path.join(TEMPLATES_DIR, 'registry.json');

const PROTECTED_TEMPLATE_IDS = new Set(['default']);
const MAX_PPTX_BYTES = 25 * 1024 * 1024;

export type ImportPptTemplateInput = {
  buffer: Buffer;
  originalName: string;
  id?: string;
  label?: string;
  description?: string;
};

export type ImportPptTemplateResult = {
  template: Omit<PptTemplateEntry, 'absolutePath'> & { fileExists: true };
  created: boolean;
  overwritten: boolean;
  analysis: {
    layoutCount: number;
    slideLayouts: PptTemplateAnalysis['slideLayouts'];
    warnings: string[];
  };
  warnings: string[];
};

function slugifyId(raw: string): string {
  const base = raw
    .replace(/\.pptx$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || 'imported_template';
}

function uniqueTemplateId(baseId: string, existing: Set<string>): string {
  if (!existing.has(baseId) && !PROTECTED_TEMPLATE_IDS.has(baseId)) {
    return baseId;
  }
  let n = 2;
  while (existing.has(`${baseId}_${n}`) || PROTECTED_TEMPLATE_IDS.has(`${baseId}_${n}`)) {
    n += 1;
  }
  return `${baseId}_${n}`;
}

function parseLayouts(
  raw: Record<string, number>,
): Record<PptLayoutId, number> {
  const layouts = {} as Record<PptLayoutId, number>;
  for (const layoutId of PPT_LAYOUT_IDS) {
    const index = raw[layoutId];
    layouts[layoutId] =
      typeof index === 'number' && Number.isFinite(index)
        ? Math.max(0, Math.floor(index))
        : PPT_LAYOUT_CATALOG[layoutId].templateLayoutIndex;
  }
  return layouts;
}

const FALLBACK_EXPORT_THEME: PptExportTheme = {
  accent: '2563EB',
  title: '0F172A',
  body: '334155',
  muted: '475569',
  slideBackground: 'F8FAFC',
  slideBackgroundEnd: 'EEF2FF',
};

function defaultExportTheme(): PptExportTheme {
  const registry = loadPptTemplateRegistryRaw();
  const fallback =
    registry.templates.find(t => t.id === 'default') ?? registry.templates[0];
  return fallback ? { ...fallback.exportTheme } : { ...FALLBACK_EXPORT_THEME };
}

function writeRegistryEntry(
  entry: Omit<PptTemplateEntry, 'absolutePath'>,
  overwrite: boolean,
): void {
  const registry = loadPptTemplateRegistryRaw();
  const index = registry.templates.findIndex(t => t.id === entry.id);

  if (index >= 0) {
    if (!overwrite) {
      throw new Error(`模板 id「${entry.id}」已存在`);
    }
    registry.templates[index] = entry;
  } else {
    registry.templates.push(entry);
  }

  writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  invalidatePptTemplateRegistryCache();
}

export function importPptTemplateFromBuffer(
  input: ImportPptTemplateInput,
): ImportPptTemplateResult {
  if (input.buffer.byteLength > MAX_PPTX_BYTES) {
    throw new Error(
      `PPTX 不得超過 ${MAX_PPTX_BYTES / (1024 * 1024)} MB（目前 ${(input.buffer.byteLength / (1024 * 1024)).toFixed(1)} MB）`,
    );
  }

  const registry = loadPptTemplateRegistryRaw();
  const existingIds = new Set(registry.templates.map(t => t.id));

  const requestedId = input.id?.trim();
  if (requestedId) {
    if (!/^[a-z][a-z0-9_-]{0,47}$/.test(requestedId)) {
      throw new Error('id 須以小寫英文字母開頭，僅能包含 a-z、0-9、_、-');
    }
    if (PROTECTED_TEMPLATE_IDS.has(requestedId)) {
      throw new Error(`不得覆寫受保護的模板 id：${requestedId}`);
    }
  }

  const baseId = slugifyId(requestedId || input.originalName);
  const templateId = requestedId ?? uniqueTemplateId(baseId, existingIds);

  const destFile = `${templateId}.pptx`;
  const destPath = path.join(TEMPLATES_DIR, destFile);
  const existed = existsSync(destPath);
  const overwritingRegistry = existingIds.has(templateId);

  const tmpPath = path.join(
    TEMPLATES_DIR,
    `.import-${templateId}-${Date.now()}.pptx`,
  );
  writeFileSync(tmpPath, input.buffer);

  const analysisRun = runPptTemplateAnalysis(tmpPath);
  const warnings: string[] = [];

  let layouts: Record<PptLayoutId, number>;
  let layoutCount = 0;
  let slideLayouts: ImportPptTemplateResult['analysis']['slideLayouts'] = [];

  let exportTheme = defaultExportTheme();

  if (analysisRun.ok) {
    layouts = parseLayouts(analysisRun.data.layouts);
    layoutCount = analysisRun.data.layoutCount;
    slideLayouts = analysisRun.data.slideLayouts;
    warnings.push(...analysisRun.data.warnings);
    if (analysisRun.data.exportTheme) {
      exportTheme = { ...analysisRun.data.exportTheme };
    }
  } else {
    warnings.push(
      `無法執行 Python 母片分析（${analysisRun.error}），已套用 layout_catalog 預設索引`,
    );
    const fallback = loadPptTemplateRegistryRaw().templates.find(
      t => t.id === 'default',
    );
    layouts = parseLayouts(
      fallback
        ? (fallback.layouts as Record<string, number>)
        : {
            title: 0,
            section: 2,
            bullets: 1,
            two_column: 4,
            quote: 1,
            stat: 1,
            closing: 1,
          },
    );
    layoutCount = 0;
  }

  try {
    writeFileSync(destPath, input.buffer);
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup errors
    }
  }

  const label =
    input.label?.trim() ||
    input.originalName.replace(/\.pptx$/i, '').trim() ||
    templateId;
  const description =
    input.description?.trim() ||
    `由 ${input.originalName} 匯入（${layoutCount || '?'} 種母片版式）`;

  const entry: Omit<PptTemplateEntry, 'absolutePath'> = {
    id: templateId,
    label,
    description,
    file: destFile,
    previewTheme: templateId,
    layouts,
    exportTheme,
  };

  writeRegistryEntry(entry, overwritingRegistry || existed);

  return {
    template: { ...entry, fileExists: true },
    created: !overwritingRegistry,
    overwritten: overwritingRegistry || existed,
    analysis: {
      layoutCount,
      slideLayouts,
      warnings,
    },
    warnings,
  };
}
