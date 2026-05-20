export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF', content], { type: mimeType });
  downloadBlob(blob, filename);
}

async function fetchExportBlob(
  path: string,
  markdown: string,
  title: string | undefined,
  failureLabel: string,
): Promise<Blob> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, title }),
  });

  if (!res.ok) {
    let message = failureLabel;
    try {
      const json = (await res.json()) as { message?: string; error?: string };
      message = json.message ?? json.error ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return res.blob();
}

export function fetchDocxExport(markdown: string, title?: string): Promise<Blob> {
  return fetchExportBlob('/api/export', markdown, title, '匯出 Word 失敗');
}

export function fetchPdfExport(markdown: string, title?: string): Promise<Blob> {
  return fetchExportBlob('/api/export/pdf', markdown, title, '匯出 PDF 失敗');
}
