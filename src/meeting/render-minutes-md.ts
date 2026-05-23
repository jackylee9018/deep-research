import type { MeetingMinutes, PartialMeetingMinutes } from './schemas/minutes';
import type { MeetingTranscript } from './schemas/transcript';

import { formatTranscriptAppendix } from './format-transcript';

export function renderPartialMeetingMinutesMarkdown(
  partial: PartialMeetingMinutes,
  options?: { chunkIndex?: number; chunkCount?: number },
): string {
  const title =
    partial.title?.trim() ||
    (options?.chunkCount && options.chunkCount > 1
      ? `會議紀要（整理中 ${options.chunkIndex ?? '?'}/${options.chunkCount}）`
      : '會議紀要（整理中…）');

  const lines: string[] = [`# ${title}`];

  if (partial.summary?.trim()) {
    lines.push('', '## 摘要', '', partial.summary);
  }

  if (partial.participants?.length) {
    lines.push('', '## 與會者', '');
    for (const p of partial.participants) {
      lines.push(`- ${p}`);
    }
  }

  if (partial.agenda?.length) {
    lines.push('', '## 討論議題', '');
    partial.agenda.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  }

  if (partial.speakerHighlights?.length) {
    lines.push('', '## 各發言人重點', '');
    for (const block of partial.speakerHighlights) {
      lines.push(`### ${block.speaker}`, '');
      for (const point of block.points) {
        lines.push(`- ${point}`);
      }
      lines.push('');
    }
  }

  if (partial.keyDecisions?.length) {
    lines.push('## 決策', '');
    for (const d of partial.keyDecisions) {
      lines.push(`- ${d}`);
    }
  }

  if (partial.actionItems?.length) {
    lines.push('', '## 待辦事項', '');
    lines.push('| 負責人 | 事項 | 期限 |');
    lines.push('| --- | --- | --- |');
    for (const item of partial.actionItems) {
      lines.push(
        `| ${item.owner} | ${item.task} | ${item.deadline ?? '—'} |`,
      );
    }
  }

  if (partial.openQuestions?.length) {
    lines.push('', '## 未決事項', '');
    for (const q of partial.openQuestions) {
      lines.push(`- ${q}`);
    }
  }

  if (lines.length === 1) {
    lines.push('', '_正在分析逐字稿…_');
  }

  return lines.join('\n').trim() + '\n';
}

export function renderMeetingMinutesMarkdown(
  minutes: MeetingMinutes,
  transcript?: MeetingTranscript,
  options?: { includeAppendix?: boolean },
): string {
  const lines: string[] = [`# ${minutes.title}`, '', '## 摘要', '', minutes.summary];

  if (minutes.participants.length) {
    lines.push('', '## 與會者', '');
    for (const p of minutes.participants) {
      lines.push(`- ${p}`);
    }
  }

  if (minutes.agenda.length) {
    lines.push('', '## 討論議題', '');
    minutes.agenda.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  }

  if (minutes.speakerHighlights.length) {
    lines.push('', '## 各發言人重點', '');
    for (const block of minutes.speakerHighlights) {
      lines.push(`### ${block.speaker}`, '');
      for (const point of block.points) {
        lines.push(`- ${point}`);
      }
      lines.push('');
    }
  }

  if (minutes.keyDecisions.length) {
    lines.push('## 決策', '');
    for (const d of minutes.keyDecisions) {
      lines.push(`- ${d}`);
    }
  }

  if (minutes.actionItems.length) {
    lines.push('', '## 待辦事項', '');
    lines.push('| 負責人 | 事項 | 期限 |');
    lines.push('| --- | --- | --- |');
    for (const item of minutes.actionItems) {
      lines.push(
        `| ${item.owner} | ${item.task} | ${item.deadline ?? '—'} |`,
      );
    }
  }

  if (minutes.openQuestions.length) {
    lines.push('', '## 未決事項', '');
    for (const q of minutes.openQuestions) {
      lines.push(`- ${q}`);
    }
  }

  if (options?.includeAppendix !== false && transcript?.utterances.length) {
    lines.push('', '## 附錄：逐字稿', '', formatTranscriptAppendix(transcript));
  }

  return lines.join('\n').trim() + '\n';
}
