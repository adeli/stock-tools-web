# Adeli 投資分析系統

個人投資分析工具，包含個股 SEMA 水位計、AI 分析報告、選股參考、ETF 股利殖利率。

**線上網址**：https://adeli.github.io/stock-tools-web/

---

## 專案架構

```
stock-tools-web/
├── src/                        # ← 所有原始碼都在這裡修改
│   ├── main.jsx                #   entry point，import 所有模組
│   ├── app.js                  #   Tab 切換、Header 時鐘、AI 報告頁邏輯
│   ├── utils.js                #   共用工具函數（時區日期判斷等）
│   ├── dashboard.jsx           #   個股儀表板（React component）
│   ├── sema.jsx                #   SEMA 水位計（React component）
│   ├── screener.jsx            #   選股參考（React component）
│   ├── etf-dividend.jsx        #   ETF 股利殖利率（React component）
│   ├── help.jsx                #   說明抽屜（React component）
│   └── tailwind.css            #   Tailwind CSS entry
├── index.html                  # HTML 結構（tab 骨架、DOM 掛載點）
├── styles.css                  # 自訂 CSS（glass card、顏色變數等）
├── vite.config.js              # Vite 設定（build、混淆、base path）
└── package.json
```

**後端 Cloudflare Worker**：位於 `../stock-tools/cloudflare-worker/worker.js`，需另外到 Cloudflare Dashboard 部署。

---

## 開發流程

### 首次 clone 後安裝依賴

```bash
npm install
```

### 本地開發

```bash
npm run dev
# → http://localhost:5173
```

熱重載（Hot Reload）已啟用，存檔後瀏覽器自動更新。

### 部署到 GitHub Pages

```bash
npm run deploy
```

這個指令會自動：
1. `vite build` — 打包 + 混淆 + 壓縮，輸出到 `dist/`
2. `gh-pages -d dist` — 推 `dist/` 到 `gh-pages` branch

**網站約 30 秒 ~ 1 分鐘後更新。**

### 儲存原始碼到 main branch

`npm run deploy` 只更新網站，不會 commit 原始碼。改完記得：

```bash
git add src/你修改的檔案
git commit -m "說明改了什麼"
git push origin main
```

---

## 各頁面對應檔案

| 功能頁面 | 修改檔案 |
|---------|---------|
| 個股儀表板（SEMA 水位計） | `src/dashboard.jsx`、`src/sema.jsx` |
| AI 分析報告 | `src/app.js` |
| 選股參考 | `src/screener.jsx` |
| ETF 股利殖利率 | `src/etf-dividend.jsx` |
| 說明抽屜 | `src/help.jsx` |
| 共用工具函數 | `src/utils.js` |
| HTML 結構 / DOM 掛載點 | `index.html` |
| 自訂樣式 | `styles.css` |

---

## 跨模組依賴注意事項

原始碼採用 ES module，跨檔案使用的 symbol 必須明確 export / import。

目前已建立的跨模組依賴：

| 提供方 | Export | 使用方 |
|-------|--------|-------|
| `src/utils.js` | `isReportCurrent` | `src/app.js`、`src/dashboard.jsx` |
| `src/app.js` | `WORKER_URL` | `src/screener.jsx` |
| `src/sema.jsx` | `r2`、`computeGaugeMessages`、`WaterGauge`、`PriceRail` | `src/dashboard.jsx` |

**新增跨檔案呼叫時**，若出現 `ReferenceError: xxx is not defined`，解法：

```js
// 提供方（定義處）加 export
export function myFunction() { ... }
export const MY_CONST = '...'

// 使用方（呼叫處）加 import
import { myFunction, MY_CONST } from './提供方.js'
```

---

## Build 技術細節

| 工具 | 用途 |
|-----|-----|
| Vite 5 | 打包、Dev server |
| @vitejs/plugin-react | JSX 編譯 |
| @tailwindcss/vite | Tailwind CSS 編譯（不用 CDN） |
| rollup-plugin-obfuscator | 混淆變數名稱（防止原始碼被直接閱讀） |
| Terser | 壓縮、移除空白與註解 |
| gh-pages | 推 `dist/` 到 `gh-pages` branch |

Build 產物（`dist/`）不會 commit 到 main branch，由 `npm run deploy` 直接推到 `gh-pages` branch。
