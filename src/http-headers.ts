/**
 * Fetch / undici require response header values to be ISO-8859-1 (ByteString).
 * User-facing titles and filenames often contain CJK and other non-Latin-1 text.
 */

const LATIN1_MAX_CODE_POINT = 255;
const UNSAFE_FILENAME_CHARS = /["\\\r\n]/g;

export function isLatin1HeaderSafe(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > LATIN1_MAX_CODE_POINT) {
      return false;
    }
  }
  return true;
}

/** Safe for any custom response header derived from user content. */
export function httpHeaderValue(value: string): string {
  return isLatin1HeaderSafe(value) ? value : encodeURIComponent(value);
}

/**
 * RFC 6266 attachment header: ASCII `filename` fallback plus UTF-8 `filename*`.
 */
export function contentDispositionAttachment(filename: string): string {
  const extMatch = /\.[^./\\]+$/.exec(filename);
  const ext = extMatch?.[0] ?? '';
  const base = filename.slice(0, filename.length - ext.length);

  const asciiBase =
    base
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(UNSAFE_FILENAME_CHARS, '_')
      .replace(/^_+|_+$/g, '') || 'download';

  const asciiFallback = `${asciiBase}${ext}`.replace(UNSAFE_FILENAME_CHARS, '_');
  const utf8Star = encodeURIComponent(filename);

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Star}`;
}
