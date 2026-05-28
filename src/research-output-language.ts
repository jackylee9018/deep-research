export const RESEARCH_OUTPUT_LANGUAGES = [
  'auto',
  'zh-TW',
  'zh-CN',
  'en',
  'ja',
] as const;

export type ResearchOutputLanguage = (typeof RESEARCH_OUTPUT_LANGUAGES)[number];

export const RESEARCH_OUTPUT_LANGUAGE_LABELS: Record<
  ResearchOutputLanguage,
  string
> = {
  auto: '跟隨提問語言',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  en: 'English',
  ja: '日本語',
};

export function resolveResearchOutputLanguage(
  value: unknown,
): ResearchOutputLanguage {
  if (typeof value !== 'string') {
    return 'auto';
  }
  return RESEARCH_OUTPUT_LANGUAGES.includes(value as ResearchOutputLanguage)
    ? (value as ResearchOutputLanguage)
    : 'auto';
}

export function outputLanguageInstruction(language: ResearchOutputLanguage) {
  if (language === 'auto') {
    return 'Use the same language as the user prompt.';
  }
  return `Write the output in ${RESEARCH_OUTPUT_LANGUAGE_LABELS[language]}.`;
}
