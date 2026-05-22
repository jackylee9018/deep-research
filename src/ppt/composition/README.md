# 構圖目錄（Composition Catalog）

宣告式定義每一種投影片構圖：版式類型、元素位置（百分比）、LLM 選版提示。

## 檔案

| 檔案 | 用途 |
|------|------|
| `catalog.json` | **單一真相來源**（執行時載入） |
| `catalog.xml` | 完整副本（含 boxes），由 sync 產生 |
| `load-catalog.ts` | 索引/詳情 XML、大綱與逐頁 prompt |
| `merge-boxes.ts` | catalog 預設 + LLM 微調合併與 clamp |

## 漸進披露（兩層）

| 層級 | 函式 | 誰用 | 內容 |
|------|------|------|------|
| 索引 | `compositionCatalogIndexXml()` | 大綱 LLM | id、layoutId、label、whenToUse、fields（**無 boxes**） |
| 詳情 | `compositionCatalogDetailXml(id)` | 逐頁內容 LLM | 單條完整定義 + 預設 `boxes` |

大綱階段只選 `compositionId`；逐頁階段才看座標，並可**選填** `boxes` 做小幅微調（合併回 catalog 預設）。

## 流程

```mermaid
flowchart LR
  A[大綱 LLM] -->|compositionId| B[OutlineDeck]
  B --> C[逐頁內容 LLM]
  C -->|文案 + optional boxes| D[mergeCompositionBoxes]
  D --> E[DeckPlan]
  E --> F[預覽 / 匯出]
```

## 新增構圖

1. 在 `catalog.json` 的 `compositions` 新增一筆（含 `boxes` 百分比）。
2. 若為新版式族，在 `schemas/layout-catalog.ts` 與 `deck-plan.ts` 加入 `layoutId`，並更新 `merge-boxes.ts` 的 `LAYOUT_BOX_KEYS`。
3. 執行 `npm run ppt:composition:sync` 同步 `catalog.xml`。
4. 大綱編輯器透過 `GET /api/ppt/compositions` 列出；詳情用 `GET /api/ppt/compositions?id=...`。

## 維護指令

```bash
npm run ppt:composition:sync   # catalog.json → catalog.xml（完整含 boxes）
npm run ppt:templates:verify   # 檢查 registry layout 索引與 .pptx
```

## API

- `GET /api/ppt/compositions` — 列表（無 boxes）
- `GET /api/ppt/compositions?id=stat_metric` — 單條詳情（含 boxes）
