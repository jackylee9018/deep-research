import { PDFParse } from 'pdf-parse';

const MAX_EXTRACTED_CHARS = 48_000;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = (result.text ?? '').replace(/\s+\n/g, '\n').trim();

    if (!text) {
      throw new Error('無法從 PDF 擷取文字（可能是掃描檔或空白文件）');
    }

    if (text.length > MAX_EXTRACTED_CHARS) {
      return `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[內容已截斷，僅保留前 ${MAX_EXTRACTED_CHARS} 字]`;
    }

    return text;
  } finally {
    await parser.destroy();
  }
}
