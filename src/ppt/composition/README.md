# 構圖目錄（Composition Catalog）

宣告式定義每一種投影片構圖：版式類型、元素位置（百分比）、LLM 選版提示。

## 檔案

| 檔案 | 用途 |
|------|------|
| `catalog.json` | **單一真相來源**（執行時載入） |
| `catalog.xml` | 給人類閱讀 / 與 JSON 同步的 XML 副本 |
| `load-catalog.ts` | 解析、預設構圖、`compositionCatalogXml()` 給大綱 LLM |

## 流程

```mermaid
flowchart LR
  A[大綱 LLM] -->|compositionId per slide| B[OutlineDeck]
  B --> C[內容 LLM]
  C --> D[DeckPlan + boxes]
  D --> E[預覽 / 匯出]
```

1. **大綱階段**：prompt 內嵌 XML 構圖目錄，LLM 為每頁選 `compositionId`（如 `quote_highlight`、`two_column_stagger`）。
2. **內容階段**：鎖定 `compositionId` / `layoutId`，填入各版式欄位。
3. **buildDeckPlan**：依 `compositionId` 寫入 `slide.boxes` 座標。
4. **預覽**：依 boxes 渲染；**匯出**：PptxGenJS 或 Python 絕對定位。

## 新增構圖

1. 在 `catalog.json` 的 `compositions` 新增一筆（含 `boxes` 百分比）。
2. 若為新版式族，在 `schemas/layout-catalog.ts` 與 `deck-plan.ts` 加入 `layoutId`。
3. 執行 `npm run ppt:composition:sync` 同步 `catalog.xml`。
4. 大綱編輯器會透過 `GET /api/ppt/compositions` 自動列出。

## 維護指令

```bash
npm run ppt:composition:sync   # catalog.json → catalog.xml
npm run ppt:templates:verify   # 檢查 registry layout 索引與 .pptx
```

## 欄位說明

- `id`：構圖 ID（LLM 與大綱 JSON 使用）
- `layoutId`：內容 schema 族（title / bullets / quote / stat …）
- `whenToUse`：給 LLM 的選版理由
- `boxes`：預覽與匯出的元素座標（`title`、`body`、`subtitle`、`image` 等）
- `media`（大綱）：`enabled` + `brief` 觸發 `resolveSlideImages` 下載配圖至 job `media/`
