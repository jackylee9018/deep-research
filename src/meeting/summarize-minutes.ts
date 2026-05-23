import { RecursiveCharacterTextSplitter } from '@/ai/text-splitter';
import { generateObject } from '@/ai/generate-object';
import { trimPrompt } from '@/ai/providers';

import { formatTranscriptForLlm } from './format-transcript';
import {
  meetingMinutesSchema,
  partialMeetingMinutesSchema,
  type MeetingMinutes,
  type PartialMeetingMinutes,
} from './schemas/minutes';
import type { MeetingTranscript } from './schemas/transcript';

const CHUNK_CHARS = 12_000;

function minutesLanguageGuidance(language?: string): string {
  if (language === 'yue') {
    return '逐字稿為粵語，紀要請用繁體中文撰寫，並保留粵語口語用字與專有名詞，勿改寫成國語。';
  }
  return '使用繁體中文。';
}

function mergePartialMinutes(
  partials: PartialMeetingMinutes[],
): PartialMeetingMinutes {
  const uniq = (items: string[]) =>
    [...new Set(items.map(s => s.trim()).filter(Boolean))];

  const actionKey = (a: { owner: string; task: string }) =>
    `${a.owner}::${a.task}`;

  const actionMap = new Map<
    string,
    { owner: string; task: string; deadline?: string }
  >();
  for (const p of partials) {
    for (const item of p.actionItems ?? []) {
      actionMap.set(actionKey(item), item);
    }
  }

  const highlightMap = new Map<string, Set<string>>();
  for (const p of partials) {
    for (const h of p.speakerHighlights ?? []) {
      const set = highlightMap.get(h.speaker) ?? new Set<string>();
      for (const point of h.points) {
        set.add(point);
      }
      highlightMap.set(h.speaker, set);
    }
  }

  return {
    title: partials.find(p => p.title)?.title,
    summary: partials
      .map(p => p.summary)
      .filter((s): s is string => Boolean(s?.trim()))
      .join('\n'),
    participants: uniq(partials.flatMap(p => p.participants ?? [])),
    agenda: uniq(partials.flatMap(p => p.agenda ?? [])),
    keyDecisions: uniq(partials.flatMap(p => p.keyDecisions ?? [])),
    actionItems: [...actionMap.values()],
    openQuestions: uniq(partials.flatMap(p => p.openQuestions ?? [])),
    speakerHighlights: [...highlightMap.entries()].map(
      ([speaker, points]) => ({
        speaker,
        points: [...points],
      }),
    ),
  };
}

async function extractPartialMinutes(
  chunk: string,
  fileName: string,
  language?: string,
): Promise<PartialMeetingMinutes> {
  const res = await generateObject({
    system: `你是專業會議紀錄助理。僅根據逐字稿片段整理資訊，不可推測未出現的決策或待辦。
待辦事項的 owner 必須使用逐字稿中的 SPEAKER 標籤（例如 SPEAKER_00），不可虛構姓名。${minutesLanguageGuidance(language)}`,
    prompt: trimPrompt(
      `會議音訊檔名：${fileName}\n\n以下為逐字稿片段：\n<transcript>\n${chunk}\n</transcript>\n\n抽取此片段中的：摘要句、議題、決策、待辦、未決事項、各 speaker 重點。`,
    ),
    schema: partialMeetingMinutesSchema,
    abortSignal: AbortSignal.timeout(120_000),
  });
  return res.object;
}

async function synthesizeMinutes(
  merged: PartialMeetingMinutes,
  fileName: string,
  language?: string,
): Promise<MeetingMinutes> {
  const res = await generateObject({
    system: `你是專業會議紀錄助理。根據已整理的片段摘要產出完整會議紀錄 JSON。
規則：僅使用提供內容；待辦 owner 保留 SPEAKER 標籤；${minutesLanguageGuidance(language)}；標題簡潔。`,
    prompt: trimPrompt(
      `會議音訊檔名：${fileName}\n\n<merged_notes>\n${JSON.stringify(merged, null, 2)}\n</merged_notes>\n\n產出完整會議紀錄。`,
    ),
    schema: meetingMinutesSchema,
    abortSignal: AbortSignal.timeout(180_000),
  });
  return res.object;
}

export type SummarizeProgress = {
  chunkIndex: number;
  chunkCount: number;
  merged: PartialMeetingMinutes;
};

export async function summarizeMeetingMinutes(
  transcript: MeetingTranscript,
  fileName: string,
  options?: {
    detailLevel?: 'brief' | 'full';
    language?: string;
    onProgress?: (progress: SummarizeProgress) => void;
  },
): Promise<MeetingMinutes> {
  const fullText = formatTranscriptForLlm(transcript);
  const language = options?.language;

  if (fullText.length <= CHUNK_CHARS) {
    const res = await generateObject({
      system: `你是專業會議紀錄助理。僅根據逐字稿整理會議紀錄，不可推測。
待辦 owner 必須使用逐字稿中的 SPEAKER 標籤。${minutesLanguageGuidance(language)}${
        options?.detailLevel === 'brief'
          ? '內容精簡，每段列表最多 5 項。'
          : ''
      }`,
      prompt: trimPrompt(
        `會議音訊檔名：${fileName}\n\n<transcript>\n${fullText}\n</transcript>`,
      ),
      schema: meetingMinutesSchema,
      abortSignal: AbortSignal.timeout(180_000),
    });
    return res.object;
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_CHARS,
    chunkOverlap: 400,
  });
  const chunks = splitter.splitText(fullText);
  const partials: PartialMeetingMinutes[] = [];

  for (let i = 0; i < chunks.length; i += 1) {
    partials.push(await extractPartialMinutes(chunks[i]!, fileName, language));
    options?.onProgress?.({
      chunkIndex: i + 1,
      chunkCount: chunks.length,
      merged: mergePartialMinutes(partials),
    });
  }

  const merged = mergePartialMinutes(partials);
  return synthesizeMinutes(merged, fileName, language);
}
