import { resolvePptTemplate } from './templates/registry';

/** Anthropic pptx skill 參考配色（6 位 hex，不含 #） */
export const PPT_INSPIRATION_PALETTES = [
  {
    name: 'Midnight Executive 午夜主管',
    primary: '1E2761',
    secondary: 'CADCFC',
    accent: 'FFFFFF',
  },
  {
    name: 'Forest & Moss 森林苔綠',
    primary: '2C5F2D',
    secondary: '97BC62',
    accent: 'F5F5F5',
  },
  {
    name: 'Coral Energy 珊瑚活力',
    primary: 'F96167',
    secondary: 'F9E795',
    accent: '2F3C7E',
  },
  {
    name: 'Warm Terracotta 暖陶土',
    primary: 'B85042',
    secondary: 'E7E8D1',
    accent: 'A7BEAE',
  },
  {
    name: 'Ocean Gradient 海洋漸層',
    primary: '065A82',
    secondary: '1C7293',
    accent: '21295C',
  },
  {
    name: 'Charcoal Minimal 炭灰極簡',
    primary: '36454F',
    secondary: 'F2F2F2',
    accent: '212121',
  },
  {
    name: 'Teal Trust 青綠信任',
    primary: '028090',
    secondary: '00A896',
    accent: '02C39A',
  },
  {
    name: 'Berry & Cream 莓果奶油',
    primary: '6D2E46',
    secondary: 'A26769',
    accent: 'ECE2D0',
  },
  {
    name: 'Sage Calm 鼠尾草靜謐',
    primary: '84B59F',
    secondary: '69A297',
    accent: '50808E',
  },
  {
    name: 'Cherry Bold 櫻桃醒目',
    primary: '990011',
    secondary: 'FCF6F5',
    accent: '2F3C7E',
  },
] as const;

function inspirationPalettePrompt(): string {
  const rows = PPT_INSPIRATION_PALETTES.map(
    p =>
      `  - ${p.name}：主 ${p.primary}｜次 ${p.secondary}｜強調 ${p.accent}`,
  ).join('\n');
  return [
    '配色靈感表（依簡報主題擇一或混搭，勿預設通用藍；若與使用者模板色衝突，以模板為準）：',
    rows,
  ].join('\n');
}

function templateThemePrompt(templateId?: string): string {
  const entry = resolvePptTemplate(templateId);
  if (!entry) {
    return '- 未指定模板時：依主題從配色靈感表選色，並在 bulletSummary 註明建議氛圍（如「深色開場」「淺色正文」）。';
  }
  const t = entry.exportTheme;
  return [
    `- 已選模板「${entry.label}」（${entry.id}）：匯出色 accent=${t.accent}、title=${t.title}、body=${t.body}、muted=${t.muted}、背景 ${t.slideBackground}→${t.slideBackgroundEnd}。`,
    '- 文案與構圖語氣須符合此模板（商務/極簡/編輯等），勿寫與色調衝突的「繽紛卡通」或「另一套藍白企業風」除非使用者要求。',
  ].join('\n');
}

/**
 * 大綱階段：構圖多樣性、敘事、視覺元素規劃（JSON 大綱與純文字大綱共用）。
 */
export function pptOutlineDesignRules(templateId?: string): string {
  return [
    '## 視覺與敘事（大綱階段）',
    inspirationPalettePrompt(),
    templateThemePrompt(templateId),
    '- 開場與結尾：優先 title / section / closing 構圖；正文頁交替雙欄、圖文、數據 stat、引言 quote、圖示列等。',
    '- 禁止連續 3 頁相同 compositionId；bullets_standard 不得超過總頁數 40%。',
    '- 除純引言或單一超大數字 stat 外，正文應規劃視覺：media.enabled + 英文 brief，或明確 stat/quote/雙欄對照。',
    '- 同一 deck 至少使用 3 種不同 compositionId；關鍵論點頁避免純文字牆。',
    '- 敘事弧線：開場（問題/目標）→ 正文（分析/方案/證據）→ 結尾（行動/結論）。',
    '- 開場/結尾可規劃「深色氛圍」或「淺色正文」三明治結構（在 bulletSummary 簡述即可）。',
    '- 為每頁選擇與內容型態匹配的構圖：要點列表→bullets 或圖文；比較→two_column；金句→quote；單一指標→stat。',
  ].join('\n');
}

/**
 * 填字階段：具體文案、排版禁忌、字級語感（逐頁與整份重寫共用）。
 */
export function pptContentDesignRules(templateId?: string): string {
  return [
    '## 視覺與排版（內容階段）',
    templateThemePrompt(templateId),
    '- 標題：簡短有力（約 8–20 字），口語可掃描；勿寫論文式長標。',
    '- 正文與條列：左對齊語意；僅封面/章節/結尾標題可置中。勿整段置中。',
    '- 每頁至少一個視覺焦點：大數字 value、引用 quote、圖片 media.brief、或強對比小標/雙欄對照。',
    '- 數據頁：短標籤 + 醒目數字（value）；比較用 left/right 欄；流程用編號或步驟式 bullets。',
    '- 字級語感：標題層 36–44pt 氣勢、小標 20–24pt、正文 14–16pt、註解 10–12pt（以字數上限為硬約束）。',
    '- 留白：條列之間語意分明；寧可刪字勿塞滿；遵守 layout catalog 字數上限。',
    '- 禁止：lorem、xxxx、佔位符、「此頁版式」等模板殘留文案；禁止標題下方裝飾線式文案（如「——」分隔線當主視覺）。',
    '- 禁止：連續多頁僅 title + bullets 無圖無數據；禁止每頁相同句式開頭。',
    '- 對比度：淺底用深字、深底用淺字；避免淺灰字配奶油底或深 icon 配深底（需在構圖/媒體規劃上避開）。',
    '- 字體配對概念：標題有個性、內文清晰（如 標題粗黑 + 內文黑體/微軟正黑）；勿全 deck 同一平淡語氣。',
    '- 圖片 brief 用英文關鍵字，具體可搜尋（主體+場景+風格），勿寫「圖片」二字敷衍。',
    '- 若 validation issues 指出字數問題：優先縮短標題/條目，勿刪減 slide 數或改 compositionId。',
  ].join('\n');
}
