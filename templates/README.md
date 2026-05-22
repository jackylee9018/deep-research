# PPT 模板（版式庫 B）

`registry.json` 定義可用模板：檔名、每種 `layoutId` 對應的 PowerPoint slide layout 索引、預覽主題色。

| 檔案 | 說明 |
|------|------|
| `default.pptx` | Office 標準母片（必備） |
| `corporate.pptx` | 商務深綠主題（可與 default 相同母片） |
| `minimal.pptx` | 極簡灰主題 |

## 匯出行為

- 預設 **`PPT_TEMPLATE_LAYOUTS` 未設為 `false`** 時，匯出會優先呼叫 Python `skills/pptx/generate.py`，依母片 **placeholder** 填入文字（原生可編輯）。
- 若 Python 失敗或模板檔缺失，會退回 Node **PptxGenJS**（程式排版 + `exportTheme` 色票）。
- 需本機：`python3 -m pip install -r skills/pptx/requirements.txt`

## 新增模板

### API 匯入（建議）

`POST /api/ppt/templates/import`（`multipart/form-data`）

| 欄位 | 必填 | 說明 |
|------|------|------|
| `file` | 是 | `.pptx`，單檔，最大 25MB |
| `id` | 否 | 模板 id（`a-z` 開頭，僅小寫英數與 `_-`）；省略則由檔名自動產生 |
| `label` | 否 | 顯示名稱 |
| `description` | 否 | 說明文字 |

會將檔案寫入 `templates/{id}.pptx`，並更新 `registry.json` 的 `layouts`（Python `analyze_template.py` 自動對應母片索引；失敗時退回 `default` 索引）。`exportTheme` 初值沿用 `default`，可再手動編輯 registry。

```bash
curl -X POST http://localhost:9080/api/ppt/templates/import \
  -F "file=@/path/to/deck.pptx" \
  -F "id=my_brand" \
  -F "label=品牌模板"
```

匯入後重新整理 `/ppt` 大綱頁，「簡報風格」會從 `GET /api/ppt/templates` 讀到新模板。

### 手動

1. 將 `.pptx` 放入此目錄，版式需含標準 placeholder（Title / Content / Comparison 等）。
2. 在 `registry.json` 新增一筆，設定 `layouts` 索引與 `exportTheme`（`slideBackground` + `slideBackgroundEnd` 為漸層背景，`accent` 為頂部強調條）。
3. 重新整理大綱頁：右側「簡報風格」會自動從 `GET /api/ppt/templates` 讀取清單（無需改前端程式碼）。

建立變體檔（可選）：

```bash
npm run ppt:templates:build
```

## 環境變數

```bash
# 設為 false 則匯出僅用 Node，不使用母片版式
PPT_TEMPLATE_LAYOUTS=false

# 覆寫單一模板路徑
PPTX_TEMPLATE_PATH=/path/to/custom.pptx
```
