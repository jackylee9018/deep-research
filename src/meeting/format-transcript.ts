import type { MeetingTranscript } from './schemas/transcript';

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTranscriptForLlm(transcript: MeetingTranscript): string {
  return transcript.utterances
    .map(
      u =>
        `[${formatTimestamp(u.startSec)}] ${u.speaker}: ${u.text.trim()}`,
    )
    .join('\n');
}

export function formatTranscriptAppendix(transcript: MeetingTranscript): string {
  return transcript.utterances
    .map(
      u =>
        `**[${formatTimestamp(u.startSec)}] ${u.speaker}**\n${u.text.trim()}`,
    )
    .join('\n\n');
}
