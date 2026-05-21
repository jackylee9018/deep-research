/** Site-wide product name (home, PPT, nav, document title). */
export const DEFAULT_APP_DISPLAY_NAME = 'SP Intelligence';

/** Feature name shown inside /research only. */
export const RESEARCH_FEATURE_DISPLAY_NAME = 'Deep Research';

/** Feature name shown inside /ppt only. */
export const PPT_FEATURE_DISPLAY_NAME = '生成 PPT';

export function resolveAppDisplayName(
  envName = process.env.NEXT_PUBLIC_APP_NAME,
): string {
  const trimmed = envName?.trim();
  return trimmed || DEFAULT_APP_DISPLAY_NAME;
}
