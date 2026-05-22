/** Extract job UUID from `/api/ppt/download?jobId=...`. */
export function extractPptJobIdFromDownloadUrl(
  downloadUrl: string | undefined,
): string | null {
  if (!downloadUrl?.trim()) {
    return null;
  }

  try {
    const url = downloadUrl.startsWith('http')
      ? new URL(downloadUrl)
      : new URL(downloadUrl, 'http://local');
    const jobId = url.searchParams.get('jobId')?.trim();
    return jobId && /^[0-9a-f-]{36}$/i.test(jobId) ? jobId : null;
  } catch {
    const match = downloadUrl.match(/jobId=([0-9a-f-]{36})/i);
    return match?.[1] ?? null;
  }
}

export function pptPreviewPath(jobId: string): string {
  return `/ppt/preview?jobId=${encodeURIComponent(jobId)}`;
}
