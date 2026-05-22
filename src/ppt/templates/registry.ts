import { readFileSync } from 'fs';
import path from 'path';

import { z } from 'zod';

const REPO_ROOT = process.cwd();

const pptLayoutIdSchema = z.enum([
  'title',
  'section',
  'bullets',
  'two_column',
  'closing',
]);

const exportThemeSchema = z.object({
  accent: z.string(),
  title: z.string(),
  body: z.string(),
  muted: z.string(),
  slideBackground: z.string(),
  slideBackgroundEnd: z.string(),
});

const templateEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  file: z.string(),
  previewTheme: z.string(),
  layouts: z.record(pptLayoutIdSchema, z.number().int().min(0)),
  exportTheme: exportThemeSchema,
});

const registrySchema = z.object({
  version: z.number(),
  templates: z.array(templateEntrySchema).min(1),
});

export type PptTemplateId = z.infer<typeof templateEntrySchema>['id'];
export type PptExportTheme = z.infer<typeof exportThemeSchema>;
export type PptTemplateEntry = z.infer<typeof templateEntrySchema> & {
  absolutePath: string;
};

let cachedRegistry: z.infer<typeof registrySchema> | undefined;

function loadRegistryFile() {
  if (cachedRegistry) {
    return cachedRegistry;
  }
  const raw = readFileSync(
    path.join(REPO_ROOT, 'templates', 'registry.json'),
    'utf8',
  );
  cachedRegistry = registrySchema.parse(JSON.parse(raw));
  return cachedRegistry;
}

export function listPptTemplates(): PptTemplateEntry[] {
  const registry = loadRegistryFile();
  return registry.templates.map(entry => ({
    ...entry,
    absolutePath: path.join(REPO_ROOT, 'templates', entry.file),
  }));
}

export function resolvePptTemplate(
  templateId: string | undefined,
): PptTemplateEntry | undefined {
  const id = templateId?.trim() || 'default';
  return listPptTemplates().find(t => t.id === id);
}

export function resolvePptTemplatePath(templateId: string | undefined): string {
  const entry = resolvePptTemplate(templateId);
  return entry?.absolutePath ?? path.join(REPO_ROOT, 'templates', 'default.pptx');
}

export function getPptTemplateIds(): string[] {
  return listPptTemplates().map(t => t.id);
}

export function templateLayoutIndex(
  templateId: string | undefined,
  layoutId: z.infer<typeof pptLayoutIdSchema>,
): number {
  const entry = resolvePptTemplate(templateId);
  const fallback = resolvePptTemplate('default');
  return (
    entry?.layouts[layoutId] ??
    fallback!.layouts[layoutId] ??
    1
  );
}

export function useTemplateLayoutExport(): boolean {
  return process.env.PPT_TEMPLATE_LAYOUTS?.trim().toLowerCase() !== 'false';
}
