export type PptPageTextPreset = 'concise' | 'standard' | 'rich';

/** Default slide count when generating an outline (independent of text amount). */
export const DEFAULT_PPT_OUTLINE_SLIDE_COUNT = 8;

export const PPT_PAGE_TEXT_OPTIONS: Array<{
  id: PptPageTextPreset;
  label: string;
  shortHint: string;
  description: string;
  maxBulletsPerSlide: number;
  bulletLength: 'short' | 'medium' | 'long';
}> = [
  {
    id: 'concise',
    label: '精簡',
    shortHint: '少字',
    description: '每頁 2–3 個短句重點，適合口頭報告或投影閱讀',
    maxBulletsPerSlide: 3,
    bulletLength: 'short',
  },
  {
    id: 'standard',
    label: '標準',
    shortHint: '適中',
    description: '每頁約 4 個要點，句長適中，兼顧閱讀與口說',
    maxBulletsPerSlide: 4,
    bulletLength: 'medium',
  },
  {
    id: 'rich',
    label: '豐富',
    shortHint: '詳盡',
    description: '每頁最多 5 個要點，可含較完整說明，適合書面閱讀',
    maxBulletsPerSlide: 5,
    bulletLength: 'long',
  },
];

export const DEFAULT_PPT_PAGE_TEXT_PRESET: PptPageTextPreset = 'standard';

const PRESET_BY_ID = Object.fromEntries(
  PPT_PAGE_TEXT_OPTIONS.map(option => [option.id, option]),
) as Record<PptPageTextPreset, (typeof PPT_PAGE_TEXT_OPTIONS)[number]>;

export function pptPageTextParams(preset: PptPageTextPreset): {
  maxBulletsPerSlide: number;
  minBulletsPerSlide: number;
  bulletLength: 'short' | 'medium' | 'long';
} {
  const option = PRESET_BY_ID[preset];
  const minBulletsPerSlide = option.id === 'concise' ? 2 : 3;
  return {
    maxBulletsPerSlide: option.maxBulletsPerSlide,
    minBulletsPerSlide,
    bulletLength: option.bulletLength,
  };
}

const BULLET_LENGTH_GUIDANCE: Record<
  'short' | 'medium' | 'long',
  string
> = {
  short:
    'Each bullet: one short phrase (~15–35 Chinese characters). Avoid long clauses.',
  medium:
    'Each bullet: one clear sentence (~35–60 Chinese characters).',
  long: 'Each bullet: up to one full sentence (~60–90 Chinese characters); include specifics when useful.',
};

export function pptPageTextPromptRules(preset: PptPageTextPreset): string {
  const { maxBulletsPerSlide, minBulletsPerSlide, bulletLength } =
    pptPageTextParams(preset);
  return [
    `- Per slide: ${minBulletsPerSlide}–${maxBulletsPerSlide} bullet points (• prefix).`,
    `- ${BULLET_LENGTH_GUIDANCE[bulletLength]}`,
  ].join('\n');
}

export function resolvePptPageTextPreset(
  value: string | undefined,
): PptPageTextPreset {
  if (value && value in PRESET_BY_ID) {
    return value as PptPageTextPreset;
  }
  return DEFAULT_PPT_PAGE_TEXT_PRESET;
}
