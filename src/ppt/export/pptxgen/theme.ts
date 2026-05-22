import type PptxGenJS from 'pptxgenjs';

export const PPTX_LAYOUT = 'LAYOUT_16x9' as const;

export type PptxThemeColors = {
  accent: string;
  title: string;
  body: string;
  muted: string;
  fontFace: string;
  fontFaceFallback: string;
};

export const PPTX_THEME: PptxThemeColors = {
  accent: '2563EB',
  title: '0F172A',
  body: '334155',
  muted: '475569',
  fontFace: 'Microsoft JhengHei',
  fontFaceFallback: 'PingFang TC',
};

export function themeFromExportPalette(palette: {
  accent: string;
  title: string;
  body: string;
  muted: string;
}): PptxThemeColors {
  return {
    ...PPTX_THEME,
    accent: palette.accent,
    title: palette.title,
    body: palette.body,
    muted: palette.muted,
  };
}

export function themeFontFace(): string {
  return PPTX_THEME.fontFace;
}

export function applyPresentationDefaults(pptx: PptxGenJS): void {
  pptx.layout = PPTX_LAYOUT;
  pptx.theme = {
    headFontFace: themeFontFace(),
    bodyFontFace: themeFontFace(),
  };
}

export type TextBoxOpts = PptxGenJS.TextPropsOptions;

export function titleTextOpts(
  overrides?: TextBoxOpts,
  theme: PptxThemeColors = PPTX_THEME,
): TextBoxOpts {
  return {
    fontFace: themeFontFace(),
    fontSize: 30,
    bold: true,
    color: theme.title,
    ...overrides,
  };
}

export function subtitleTextOpts(
  overrides?: TextBoxOpts,
  theme: PptxThemeColors = PPTX_THEME,
): TextBoxOpts {
  return {
    fontFace: themeFontFace(),
    fontSize: 20,
    color: theme.muted,
    ...overrides,
  };
}

export function bodyTextOpts(
  overrides?: TextBoxOpts,
  theme: PptxThemeColors = PPTX_THEME,
): TextBoxOpts {
  return {
    fontFace: themeFontFace(),
    fontSize: 18,
    color: theme.body,
    ...overrides,
  };
}

export function columnTitleTextOpts(
  overrides?: TextBoxOpts,
  theme: PptxThemeColors = PPTX_THEME,
): TextBoxOpts {
  return {
    fontFace: themeFontFace(),
    fontSize: 16,
    bold: true,
    color: theme.title,
    ...overrides,
  };
}
