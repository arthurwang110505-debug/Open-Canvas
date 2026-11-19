# OpenCanvas vs. Canva — 功能差距分析與改進方案

**日期：** 2026-10-29 · **基準：** `1926e09`（PR #8 合併後）· **目標：** 盡量復刻 Canva 原版功能，同時保留 OpenCanvas 的 local-first、免帳號、開放 JSON 定位

> 本文件是「比較現行網站與 Canva 功能差異，提出改進方案」的正式記錄。已交付的 Sprint 1–3（見 `ui-ux-canva-improvement-plan.md`）解決了發現、編輯器、品牌包、下載、調整尺寸與動畫；本文件聚焦**元素庫與內容深度**這一層，並列出後續 Sprint 的優先順序。

## 1. 量化規模對照（2026 年現況）

| 指標    | Canva                         | OpenCanvas（Sprint 4 前）            | 差距倍率 |
| ------- | ----------------------------- | ------------------------------------ | -------- |
| 範本    | 免費 160 萬+、Pro 360 萬+     | 60 個（全數可編輯、字體實測品管）    | ~30,000× |
| 素材庫  | 免費 470 萬、Pro 1.41 億      | 10 張內建照片、372 圖示、15 字體家族 | ~10,000× |
| AI 工具 | Magic Studio 25–40+ 項        | 0                                    | —        |
| 使用者  | 2 億+                         | 單機開源專案                         | —        |
| 平台    | Web + iOS/Android/Mac/Windows | 響應式 Web                           | —        |

**解讀：** 範本與素材的「量」差距是 4–5 個數量級，無法也不應靠手寫範本追平；但「元素種類」的差距可以靠程式產生器追平——這正是 Sprint 4 的切入點。

## 2. 逐面向差距（Sprint 4 前的基準）

| 面向                | Canva 原版                                                | OpenCanvas（Sprint 4 前）                                                    | 差距等級                    |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------- |
| **核心編輯**        | 拖放、圖層、裁切、框架、對齊、群組、歷史                  | 8 種元素、裁切、漸層、歷史、多頁、智慧調整尺寸、品牌包、下載對話框、簡報轉場 | ✅ 已接近                   |
| **形狀庫**          | 100+ 形狀（基本形、箭頭、愛心、雲朵、對話泡、絲帶…）      | 8 個（矩形、圓角矩形、橢圓、線、三角、星、六邊、閃爍）                       | 🔴 大缺口                   |
| **圖表**            | Bar / Pie / Line / Donut，資料可編輯                      | 0                                                                            | 🔴 大缺口                   |
| **相片格（Grids）** | 2×2、3×3、拼貼等一鍵格線                                  | 0（只有單張框架）                                                            | 🔴 大缺口                   |
| **畫布尺寸**        | 數百種（IG、TikTok、Pinterest、LinkedIn、YouTube…）       | 8 種預設                                                                     | 🟡 中缺口                   |
| **文字效果**        | 描邊、陰影、彎曲、間距、列表                              | 僅大小寫與列表，無描邊/陰影/彎曲                                             | 🟡 中缺口                   |
| **表格**            | 一鍵表格，可編輯儲存格                                    | 0                                                                            | 🟡 中缺口                   |
| **動畫**            | 元素進場動畫（上升、淡入、彈跳…）                         | 僅簡報模式頁面轉場                                                           | 🟡 中缺口                   |
| **匯出**            | PNG / JPG / PDF / SVG / MP4 / GIF，透明背景               | PNG（1–3×）/ SVG / 光柵 PDF                                                  | 🟡 部分缺口                 |
| **品牌包**          | 色票、字體、Logo、團隊共用、核准流程                      | 本機單一品牌包（色票+字體）                                                  | 🟡 個人夠用，團隊缺席       |
| **AI**              | Magic Design / Write / Dream Lab / 去背 / Magic Eraser 等 | 0                                                                            | 🔴 最大缺口（但屬雲端戰場） |
| **協作與雲端**      | 即時多人、留言、審核、雲端同步                            | 本機儲存、分享連結僅限同一瀏覽器                                             | 🔴 結構性缺口（定位不同）   |
| **產品線**          | 影片、Docs、Whiteboards、Sheets、網站、印刷直送           | 僅靜態畫布一種型態                                                           | 🔴 缺口                     |
| **生態**            | 300+ App 市集、Connect API、企業 SSO                      | 無                                                                           | 🔴 缺口                     |

## 3. Sprint 4 已交付（本分支）

### 3.1 形狀庫 8 → 22（Canva Elements > Shapes 對齊）

新增 14 個形狀，全部以 `path` 元素產生（不改 schema，匯出/縮放/群組自動支援）：

- 多邊形：五邊形（pentagon）、八邊形（octagon）、菱形（diamond）
- 箭頭：右、下、左、上、雙向（arrow-right/left/up/down/both）
- 情感與裝飾：愛心（heart，參數曲線）、加號（plus）、月亮（moon，新月雙弧）、雲朵（cloud，雙高斯峰）、對話泡（speech-bubble）、絲帶（ribbon）

實作：`apps/web/src/editor/elements/shapeGeometry.ts`（純幾何，可單測）、`actions.ts`（`addShape` 新增分支）、`shapeItems.tsx`（22 項 + Lucide 圖示）、`drag.ts`（拖放白名單）。

### 3.2 圖表 0 → 3（Canva Elements > Charts 對齊）

- Bar chart：4 根柱 + 數值標籤 + 類別標籤 + 基線
- Pie chart：4 切片 + 右側圖例（色塊 + 百分比）
- Line chart：趨勢線 + 5 個資料點 + 數值/類別標籤 + 基線

設計決策：圖表以**可編輯群組**（rect/path/ellipse/text）產生，而非新元素類型。群組可移動、縮放、匯出、取消群組後逐根編輯；`layout.ts` 已會等比縮放群組子元素，調整尺寸時圖表自動跟隨。資料編輯（改數值即重繪）列入 Sprint 5。

實作：`apps/web/src/editor/elements/charts.ts`（`buildChartGroup`）、`actions.ts`（`addChart`）、`ElementsPanel.tsx`（Charts 區）、`drag.ts` + `CanvasStage.tsx`（拖放）。

### 3.3 相片格 0 → 4（Canva Elements > Grids 對齊）

- 2×2（4 張）、3×3（9 張）、3-photo strip（1×3）、2-photo duo（1×2）

每格是普通 `frame` 元素：拖照片到任一格即填滿該格，整格可作為群組移動/縮放。

實作：`apps/web/src/editor/elements/grids.ts`（`buildGridGroup`）、`actions.ts`（`addGrid`）、`ElementsPanel.tsx`（Grids 區）、拖放同上。

### 3.4 畫布預設 8 → 18（Canva 尺寸對齊）

新增：TikTok 影片、Pinterest Pin、LinkedIn post、Facebook story、YouTube banner、Poster A5、Instagram landscape、X header、Presentation 4:3、Facebook cover。全部出現在「建立設計」與「調整尺寸」對話框。

實作：`packages/document/src/constants.ts`（`CANVAS_PRESETS`）。

### 驗證

- Vitest：**732 passed / 74 files**（Sprint 3 為 720/73；新增 `EditorCharts.test.tsx` 12 項 + `EditorElements.test.tsx` 拖放斷言擴充）
- Typecheck / ESLint / Prettier / Web build 全過
- 圖表與格線經 `validateDocument` 驗證為 schema-valid；匯出走既有 group/path/frame 管線，無需新匯出碼

## 4. 後續改進方案（依優先順序）

### Sprint 5 已交付（本分支）

1. **圖表資料編輯器**：選中 Bar/Pie/Line 圖表群組時，屬性面板顯示資料列（顏色/標籤/數值），按「Apply chart data」以 `page.replaceContent` 一步 undo 重繪群組子元素。資料從既有標籤與圖例反推（`parseChartGroup`），重繪保留群組 id/位置/大小（`regenerateChartGroup`）。Canva 的 Charts 核心就是「改數字，圖跟著變」。
2. **表格元素**：4×3 表格群組（標題列 + 網格線 + 儲存格文字），屬性面板可改儲存格、增減列/欄，一步 undo 重繪（`tables.ts`、`updateTableData`）。Elements 面板新增 Tables 分類，支援拖放。
3. **文字效果**：文字元素新增可選 `stroke`（描邊）與 `shadow`（陰影）欄位（schema v11 加法遷移，舊文件不變）；Fabric 渲染、SVG 匯出（`feDropShadow` filter）、調整尺寸縮放、樣式複製皆同步支援；屬性面板新增「Text effects」區（Outline/Shadow 開關 + 顏色/寬度/偏移/模糊）。

驗證：Vitest **741 passed / 75 files**（新增 `EditorSprint5.test.tsx` 8 項）；Typecheck / ESLint / Prettier / Web build 全過。

### Sprint 6 已交付（本分支）

4. **JPG 匯出 + 透明 PNG**：下載對話框新增 JPG 格式（rasterizer 支援 jpeg mime，透明區自動填白）與 PNG「透明背景」開關（SVG 匯出可選不畫背景）。Canva Pro 的透明背景是付費賣點，OpenCanvas 免費提供。
5. **品牌包 Logo**：品牌包新增 Logo 上傳（data URL 存 localStorage，上限 1 MB）與「插入 Logo」動作（經既有圖片匯入管線，一步 undo）。Canva Brand Kit 的 Logo 是團隊一致性的核心。
6. **版本歷程**：History 對話框（既有時間軸）新增具名版本——儲存快照、還原（新增 `document.replace` 命令，一步 undo）、刪除，全部存於本機 localStorage（每設計 20 個上限）。

驗證：Vitest **760 passed / 77 files**（新增 `EditorVersions.test.tsx`、`versions.test.ts`，擴充 `raster.test.ts`、`EditorExport.test.tsx`、`EditorBrand.test.tsx`、`brandKit.test.ts`、`reducer.test.ts`）；Typecheck / ESLint / Prettier / Web build 全過。

### Sprint 7 — 內容深度（不追量，追質）

7. **範本擴充到 150–200 個**：以既有 blueprint 系統程式產生 + 分類策展，而非手寫 60 個的笨方法。Canva 的百萬範本無法追，但「搜得到、品質好」的 200 個已足夠個人使用。
8. **字體擴充**：15 → 30+ 家族（仍走 @fontsource 本機打包，離線可用）。Canva 有數百字體，但本機打包的字體每多一家就多一份體積，需取捨。
9. **照片庫可插拔**：內建照片仍少（10 張），應做成「來源可插拔」架構（本機包 + 使用者自訂 URL 來源），而非硬塞數百張進 repo。

### 明確不追（定位取捨）

- **即時多人協作、雲端同步、留言審核**：需後端與帳號系統，與 local-first 定位衝突。若要做，應為 opt-in 而非預設。
- **AI 生成全家桶（Dream Lab 級）、去背雲端版**：需 GPU 後端與內容審核。唯一可考慮的本機 AI 是瀏覽器端去背（segmentation 模型），但體積與相容性風險高，列為探索項。
- **影片編輯、Docs/Whiteboards/Sheets、印刷履約、App 市集**：公司級戰場，追了會稀釋「免帳號、免上傳、打開就能用」的定位。

## 5. OpenCanvas 的反向優勢（保留）

- **隱私與自主**：免帳號、免上傳、離線可用、設計是開放 JSON，不被平台綁架
- **零成本、零延遲**：無訂閱、無 AI 點數、無雲端等待
- **品質誠實度**：範本全數通過字體實測品管、匯出能力如實標示（光柵 PDF 已註明非向量）

> **決策規則：** 優先做「本機可完成、匯出可驗證、一次 undo 可還原」的 Canva 功能；需要雲端、帳號或 GPU 的功能，先不做。
