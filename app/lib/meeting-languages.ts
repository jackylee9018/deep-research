export const MEETING_LANGUAGE_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
] as const;

export type MeetingLanguageCode =
  (typeof MEETING_LANGUAGE_OPTIONS)[number]['value'];

export const DEFAULT_MEETING_LANGUAGE: MeetingLanguageCode = 'zh';

export function meetingLanguageLabel(code: string): string {
  return (
    MEETING_LANGUAGE_OPTIONS.find(item => item.value === code)?.label ?? code
  );
}
