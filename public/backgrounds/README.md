# 路由背景圖

將各路由的背景圖放在此目錄。Next.js 會以 `/backgrounds/<檔名>` 提供靜態檔。

## 路徑對照

| 路由 | 建議檔案（擇一，優先由上而下） | 瀏覽器 URL |
|------|-------------------------------|------------|
| `/research` | `research.png` → `research.webp` → `research.jpg` → `research.svg` | `/backgrounds/research.png` 等 |
| `/`（Home） | `home.webp` → `home.png` → `home.jpg` → `home.svg` | `/backgrounds/home.webp` 等 |
| `/ppt` | `ppt.webp` → `ppt.png` → `ppt.jpg` → `ppt.svg` | `/backgrounds/ppt.webp` 等 |

專案根目錄實體路徑範例：

- Research：`public/backgrounds/research.png`
- Home：`public/backgrounds/home.webp`
- PPT：`public/backgrounds/ppt.webp`

## 啟用方式

- **Research**：`app/research/layout.tsx` → `route-bg route-bg--research`
- **Home**：`app/page.tsx` → `light-route-shell route-bg route-bg--home`
- **PPT**：`app/ppt/layout.tsx` → `route-bg route-bg--ppt`

樣式定義見 `app/globals.css` 的 `Route background images` 區塊。

## 建議

- 橫向約 1920×1080 或更大，檔案 &lt; 500KB 較佳。
- 未放置 `png`/`webp`/`jpg` 時會 fallback 到同名的 `.svg`。
