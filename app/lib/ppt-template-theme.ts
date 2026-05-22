import type { CSSProperties } from 'react';

export type PptTemplateThemeColors = {
  accent: string;
  title: string;
  body: string;
  muted: string;
  slideBackground: string;
  slideBackgroundEnd: string;
};

export function hexColor(hex: string, fallback = '#2563EB'): string {
  const normalized = hex.replace(/^#/, '').trim();
  return /^[0-9A-Fa-f]{6}$/i.test(normalized) ? `#${normalized}` : fallback;
}

/** Slide canvas / card preview gradient (matches export theme). */
export function templateSlideGradient(
  theme: Pick<PptTemplateThemeColors, 'slideBackground' | 'slideBackgroundEnd'>,
  angle = 165,
): string {
  const start = hexColor(theme.slideBackground, '#FFFFFF');
  const end = hexColor(theme.slideBackgroundEnd, '#EEF2FF');
  return `linear-gradient(${angle}deg, ${start} 0%, ${end} 55%, ${end} 100%)`;
}

export function templateAccentGradient(
  theme: Pick<PptTemplateThemeColors, 'accent'>,
): string {
  const accent = hexColor(theme.accent);
  return `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 72%, white))`;
}

/** CSS variables for preview studio + positioned canvas. */
export function templateThemeCssVars(
  theme: PptTemplateThemeColors,
): CSSProperties {
  return {
    ['--ppt-slide-bg' as string]: hexColor(theme.slideBackground, '#FFFFFF'),
    ['--ppt-slide-bg-end' as string]: hexColor(
      theme.slideBackgroundEnd,
      '#EEF2FF',
    ),
    ['--ppt-slide-gradient' as string]: templateSlideGradient(theme),
    ['--ppt-accent' as string]: hexColor(theme.accent),
    ['--ppt-accent-gradient' as string]: templateAccentGradient(theme),
    ['--ppt-title' as string]: hexColor(theme.title, '#0F172A'),
    ['--ppt-body' as string]: hexColor(theme.body, '#334155'),
    ['--ppt-muted' as string]: hexColor(theme.muted, '#64748B'),
  };
}

export function templateCardPreviewStyle(
  theme: PptTemplateThemeColors,
): CSSProperties {
  return {
    background: templateSlideGradient(theme, 155),
  };
}

export const DEFAULT_TEMPLATE_THEME: PptTemplateThemeColors = {
  accent: '2563EB',
  title: '0F172A',
  body: '334155',
  muted: '475569',
  slideBackground: 'F8FAFC',
  slideBackgroundEnd: 'EEF2FF',
};
