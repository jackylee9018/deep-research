export type PptxExportBackend = 'nodejs' | 'python';

export function getPptxExportBackend(): PptxExportBackend {
  const value = process.env.PPTX_EXPORT_BACKEND?.trim().toLowerCase();
  if (value === 'python') {
    return 'python';
  }
  return 'nodejs';
}
