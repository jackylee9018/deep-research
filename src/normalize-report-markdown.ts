const EMPTY_NAME_ANCHOR =
  /<a\s+(?=[^>]*\bname\s*=\s*["']([^"']+)["'])[^>]*>\s*<\/a>/gi;

const EMPTY_ID_ANCHOR =
  /<a\s+(?=[^>]*\bid\s*=\s*["']([^"']+)["'])(?![^>]*\bname\s*=)[^>]*>\s*<\/a>/gi;

const NAMED_ANCHOR_WITH_TEXT =
  /<a\s+(?=[^>]*\bname\s*=\s*["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/gi;

function stripEmptyAnchors(text: string): string {
  return text.replace(EMPTY_NAME_ANCHOR, '').replace(EMPTY_ID_ANCHOR, '');
}

/** Convert model HTML anchors and pseudo-headings into GFM markdown. */
export function normalizeReportMarkdown(markdown: string): string {
  if (!markdown.includes('<')) {
    return markdown;
  }

  let result = markdown;

  // <a name="id"></a>1. Section title (same line)
  result = result.replace(
    /<a\s+(?=[^>]*\bname\s*=\s*["'][^"']+["'])[^>]*>\s*<\/a>\s*(\d+\.\s+[^\n]+)/gi,
    '## $1',
  );

  // <a name="id"></a>\n1. Section title (next line)
  result = result.replace(
    /<a\s+(?=[^>]*\bname\s*=\s*["'][^"']+["'])[^>]*>\s*<\/a>[ \t]*\r?\n+(\d+\.\s+[^\n]+)/gi,
    '## $1',
  );

  // <a name="id"></a>## Existing heading
  result = result.replace(
    /<a\s+(?=[^>]*\bname\s*=\s*["'][^"']+["'])[^>]*>\s*<\/a>\s*(#{1,6}\s+[^\n]+)/gi,
    '$1',
  );

  // <a name="id"></a>\n## Existing heading
  result = result.replace(
    /<a\s+(?=[^>]*\bname\s*=\s*["'][^"']+["'])[^>]*>\s*<\/a>[ \t]*\r?\n+(#{1,6}\s+[^\n]+)/gi,
    '$1',
  );

  // <a name="id">visible text</a> → plain text
  result = result.replace(NAMED_ANCHOR_WITH_TEXT, '$2');

  result = stripEmptyAnchors(result);

  return result.replace(/\n{3,}/g, '\n\n');
}
