export function slugifyForFilename(text: string, maxLength = 80): string {
  const slug = text
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');

  return slug || `research-${Date.now()}`;
}

/** Latin-1-safe slug for HTTP headers and filesystem fallbacks. */
export function slugifyAsciiForFilename(text: string, maxLength = 80): string {
  const slug = text
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');

  return slug || `research-${Date.now()}`;
}

/** @param suffixOrExt file extension (`.md`) or legacy suffix segment (`answer` → `slug-answer.md`) */
export function filenameFromTitle(title: string, suffixOrExt = ''): string {
  const slug = slugifyForFilename(title);
  if (!suffixOrExt) {
    return `${slug}.md`;
  }
  if (suffixOrExt.startsWith('.')) {
    return `${slug}${suffixOrExt}`;
  }
  return `${slug}-${suffixOrExt}.md`;
}
