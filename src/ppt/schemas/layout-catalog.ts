import { z } from 'zod';

export const PPT_LAYOUT_IDS = [
  'title',
  'section',
  'bullets',
  'two_column',
  'closing',
] as const;

export const pptLayoutIdSchema = z.enum(PPT_LAYOUT_IDS);
export type PptLayoutId = z.infer<typeof pptLayoutIdSchema>;

export type PptLayoutCatalogEntry = {
  id: PptLayoutId;
  label: string;
  description: string;
  templateLayoutIndex: number;
  maxTitleChars: number;
  maxSubtitleChars?: number;
  maxBullets?: number;
  maxBulletChars?: number;
  placeholders: Record<string, string>;
};

export const PPT_LAYOUT_CATALOG: Record<PptLayoutId, PptLayoutCatalogEntry> = {
  title: {
    id: 'title',
    label: '封面',
    description: '簡報封面，包含標題與副標題。',
    templateLayoutIndex: 0,
    maxTitleChars: 60,
    maxSubtitleChars: 120,
    placeholders: {
      title: 'title',
      subtitle: 'subtitle',
    },
  },
  section: {
    id: 'section',
    label: '章節頁',
    description: '用於切換章節或強調一個核心觀點。',
    templateLayoutIndex: 2,
    maxTitleChars: 80,
    maxSubtitleChars: 140,
    placeholders: {
      title: 'title',
      subtitle: 'subtitle',
    },
  },
  bullets: {
    id: 'bullets',
    label: '重點列表',
    description: '標題加最多五個重點。',
    templateLayoutIndex: 1,
    maxTitleChars: 70,
    maxBullets: 5,
    maxBulletChars: 95,
    placeholders: {
      title: 'title',
      bullets: 'body',
    },
  },
  two_column: {
    id: 'two_column',
    label: '雙欄比較',
    description: '適合比較兩組觀點、方案或資料。',
    templateLayoutIndex: 3,
    maxTitleChars: 70,
    maxBullets: 4,
    maxBulletChars: 80,
    placeholders: {
      title: 'title',
      leftTitle: 'left_title',
      rightTitle: 'right_title',
      leftBullets: 'left_body',
      rightBullets: 'right_body',
    },
  },
  closing: {
    id: 'closing',
    label: '結尾',
    description: '總結、下一步或行動呼籲。',
    templateLayoutIndex: 4,
    maxTitleChars: 70,
    maxSubtitleChars: 140,
    maxBullets: 3,
    maxBulletChars: 90,
    placeholders: {
      title: 'title',
      subtitle: 'subtitle',
      bullets: 'body',
    },
  },
};

export function pptLayoutCatalogPrompt() {
  return Object.values(PPT_LAYOUT_CATALOG)
    .map(layout => {
      const limits = [
        `title<=${layout.maxTitleChars}`,
        layout.maxSubtitleChars
          ? `subtitle<=${layout.maxSubtitleChars}`
          : undefined,
        layout.maxBullets ? `bullets<=${layout.maxBullets}` : undefined,
        layout.maxBulletChars
          ? `bulletChars<=${layout.maxBulletChars}`
          : undefined,
      ]
        .filter(Boolean)
        .join(', ');

      return `- ${layout.id}: ${layout.description} (${limits})`;
    })
    .join('\n');
}
