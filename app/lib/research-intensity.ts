export type ResearchIntensity = 'light' | 'standard' | 'deep';

export const RESEARCH_INTENSITY_OPTIONS: Array<{
  id: ResearchIntensity;
  label: string;
  description: string;
  breadth: number;
  depth: number;
}> = [
  {
    id: 'light',
    label: '輕量',
    description: '較少搜尋方向，淺層收斂，適合快速試探',
    breadth: 2,
    depth: 1,
  },
  {
    id: 'standard',
    label: '標準',
    description: '平衡覆蓋面與追蹤深度',
    breadth: 4,
    depth: 2,
  },
  {
    id: 'deep',
    label: '深入',
    description: '較多平行方向與多層追蹤，研究更完整',
    breadth: 7,
    depth: 4,
  },
];

export const DEFAULT_RESEARCH_INTENSITY: ResearchIntensity = 'deep';

const PRESET_BY_ID = Object.fromEntries(
  RESEARCH_INTENSITY_OPTIONS.map(option => [option.id, option]),
) as Record<ResearchIntensity, (typeof RESEARCH_INTENSITY_OPTIONS)[number]>;

export function researchIntensityParams(intensity: ResearchIntensity): {
  breadth: number;
  depth: number;
} {
  const preset = PRESET_BY_ID[intensity];
  return { breadth: preset.breadth, depth: preset.depth };
}

export function inferResearchIntensity(
  breadth: number,
  depth: number,
): ResearchIntensity {
  const exact = RESEARCH_INTENSITY_OPTIONS.find(
    option => option.breadth === breadth && option.depth === depth,
  );
  if (exact) {
    return exact.id;
  }

  let closest = RESEARCH_INTENSITY_OPTIONS[0]!;
  let bestScore = Infinity;
  for (const option of RESEARCH_INTENSITY_OPTIONS) {
    const score =
      Math.abs(option.breadth - breadth) + Math.abs(option.depth - depth);
    if (score < bestScore) {
      bestScore = score;
      closest = option;
    }
  }
  return closest.id;
}

export function defaultResearchParams(): { breadth: number; depth: number } {
  return researchIntensityParams(DEFAULT_RESEARCH_INTENSITY);
}
