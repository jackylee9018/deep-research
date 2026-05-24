import { z } from 'zod';

import { generateObject } from '@/ai/generate-object';
import { trimPrompt } from '@/ai/providers';

import type { MeetingTranscript, MeetingUtterance } from './schemas/transcript';

const BATCH_CHARS = 6_000;

const punctuatedBatchSchema = z.object({
  utterances: z.array(
    z.object({
      id: z.string(),
      text: z.string().describe('僅加標點，不可改字'),
    }),
  ),
});

function punctuationLanguageGuidance(language?: string): string {
  if (language === 'yue') {
    return '逐字稿為粵語，僅加標點，保留粵語用字，勿改寫成國語。';
  }
  return '使用繁體中文標點。';
}

function chunkUtterances(utterances: MeetingUtterance[]): MeetingUtterance[][] {
  const chunks: MeetingUtterance[][] = [];
  let current: MeetingUtterance[] = [];
  let chars = 0;

  for (const utterance of utterances) {
    const len = utterance.text.length + utterance.id.length + 20;
    if (current.length > 0 && chars + len > BATCH_CHARS) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(utterance);
    chars += len;
  }

  if (current.length) {
    chunks.push(current);
  }

  return chunks;
}

async function punctuateBatch(
  batch: MeetingUtterance[],
  language?: string,
): Promise<Map<string, string>> {
  const payload = batch.map(u => ({ id: u.id, text: u.text }));
  const res = await generateObject({
    system: `你是逐字稿標點還原助手。為每句補上適當標點與斷句，不可增刪改字詞、不可合併或拆分句子、不可變更 id。${punctuationLanguageGuidance(language)}`,
    prompt: trimPrompt(
      `以下逐字稿句子僅缺標點，請還原標點後依 id 回傳：\n<utterances>\n${JSON.stringify(payload, null, 2)}\n</utterances>`,
    ),
    schema: punctuatedBatchSchema,
    temperature: 0,
    abortSignal: AbortSignal.timeout(120_000),
  });

  const map = new Map<string, string>();
  for (const item of res.object.utterances) {
    if (item.id && item.text.trim()) {
      map.set(item.id, item.text.trim());
    }
  }
  return map;
}

export type PunctuateProgress = {
  batchIndex: number;
  batchCount: number;
};

export async function punctuateMeetingTranscript(
  transcript: MeetingTranscript,
  options?: {
    language?: string;
    onProgress?: (progress: PunctuateProgress) => void;
  },
): Promise<MeetingTranscript> {
  const { utterances } = transcript;
  if (!utterances.length) {
    return transcript;
  }

  const batches = chunkUtterances(utterances);
  const textById = new Map<string, string>();

  for (let i = 0; i < batches.length; i += 1) {
    const batchMap = await punctuateBatch(batches[i]!, options?.language);
    for (const [id, text] of batchMap) {
      textById.set(id, text);
    }
    options?.onProgress?.({ batchIndex: i + 1, batchCount: batches.length });
  }

  return {
    ...transcript,
    utterances: utterances.map(utterance => {
      const punctuated = textById.get(utterance.id);
      if (!punctuated || punctuated === utterance.text) {
        return utterance;
      }
      return {
        ...utterance,
        textRaw: utterance.textRaw ?? utterance.text,
        text: punctuated,
      };
    }),
  };
}
