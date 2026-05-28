import { z } from 'zod';

import { generateObject } from '@/ai/generate-object';
import { trimPrompt } from '@/ai/providers';

import { getMeetingPunctuateTimeoutMs } from './config';
import type { MeetingTranscript, MeetingUtterance } from './schemas/transcript';

const MAX_BATCH_CHARS = 1_200;
const MAX_UTTERANCES_PER_BATCH = 5;

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
    const wouldExceedChars =
      current.length > 0 && chars + len > MAX_BATCH_CHARS;
    const wouldExceedCount = current.length >= MAX_UTTERANCES_PER_BATCH;

    if (wouldExceedChars || wouldExceedCount) {
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
    abortSignal: AbortSignal.timeout(getMeetingPunctuateTimeoutMs()),
  });

  const map = new Map<string, string>();
  for (const item of res.object.utterances) {
    if (item.id && item.text.trim()) {
      map.set(item.id, item.text.trim());
    }
  }
  return map;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function punctuateBatchWithRetry(
  batch: MeetingUtterance[],
  language?: string,
): Promise<Map<string, string>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await punctuateBatch(batch, language);
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await sleep(1_500);
      }
    }
  }
  throw lastError;
}

export type PunctuateProgress = {
  batchIndex: number;
  batchCount: number;
};

export type PunctuateResult = {
  transcript: MeetingTranscript;
  punctuatedCount: number;
  failedBatchCount: number;
};

export async function punctuateMeetingTranscript(
  transcript: MeetingTranscript,
  options?: {
    language?: string;
    onProgress?: (progress: PunctuateProgress) => void;
  },
): Promise<PunctuateResult> {
  const { utterances } = transcript;
  if (!utterances.length) {
    return { transcript, punctuatedCount: 0, failedBatchCount: 0 };
  }

  const batches = chunkUtterances(utterances);
  const textById = new Map<string, string>();
  let failedBatchCount = 0;

  for (let i = 0; i < batches.length; i += 1) {
    try {
      const batchMap = await punctuateBatchWithRetry(batches[i]!, options?.language);
      for (const [id, text] of batchMap) {
        textById.set(id, text);
      }
    } catch (error) {
      failedBatchCount += 1;
      console.warn(
        `Punctuation batch ${i + 1}/${batches.length} failed:`,
        error,
      );
    }
    options?.onProgress?.({ batchIndex: i + 1, batchCount: batches.length });
  }

  let punctuatedCount = 0;
  const nextUtterances = utterances.map(utterance => {
    const punctuated = textById.get(utterance.id);
    if (!punctuated || punctuated === utterance.text) {
      return utterance;
    }
    punctuatedCount += 1;
    return {
      ...utterance,
      textRaw: utterance.textRaw ?? utterance.text,
      text: punctuated,
    };
  });

  return {
    transcript: { ...transcript, utterances: nextUtterances },
    punctuatedCount,
    failedBatchCount,
  };
}
