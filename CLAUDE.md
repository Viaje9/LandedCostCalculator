# CLAUDE.md

本文件為 Claude Code (claude.ai/code) 在此專案中工作時提供指引。

## 專案概述

**跨境成本精算 (Landed Cost Calculator)** - 一個單頁式 React 應用程式，用於計算跨境商品成本，採用重量權重分攤邏輯。專為韓國進口業務設計，可計算包含運費、關稅在內的落地成本，並提供建議售價。

## 開發指令

```bash
# 啟動開發伺服器（運行於 port 3000）
npm run dev

# 建構正式版本（執行 TypeScript 編譯器 + Vite 建構）
npm run build

# 預覽正式版建構
npm run preview
```

## 架構設計

### 單一檔案應用程式結構

整個應用程式邏輯包含在 `src/App.tsx` 中 - 單一個 React 元件，沒有獨立的模組或工具函式。這是刻意為了簡化而採用的設計。

### 狀態管理

所有狀態都透過主要 App 元件中的 React `useState` hooks 管理：

- **UI 狀態**：面板開關、可折疊區塊
- **全域設定**：匯率、利潤率、本批總重量
- **費率**：國際運費率、關稅國內運費率、箱子費用
- **商品**：商品清單，包含 `id`、`name`、`priceKRW`、`quantity`、`weight`
- **計算結果**：results 和 totals（從上述狀態衍生而來）

### localStorage 持久化

關鍵實作細節：應用程式使用 localStorage 來跨瀏覽器階段持久化所有使用者資料。

**初始化流程：**

1. 元件掛載 → 從 localStorage 載入資料（第 41-57 行）
2. 載入完成後設定 `isInitialized = true`
3. 自動儲存 effect 只在 `isInitialized === true` 時觸發（第 154 行）

**為什麼這很重要：** `isInitialized` 旗標可防止自動儲存 effect 在初始渲染時用預設值覆蓋 localStorage。若沒有這個防護，每次重新整理頁面時已儲存的資料都會遺失。

**持久化內容：**

- `exchangeRate`、`profitMargin`、`totalBilledWeight`
- `rates` 物件（所有三個費率欄位）
- `items` 陣列（完整商品清單）

### 成本計算邏輯

計算發生在單一個 `useEffect` 中（第 60-149 行），當商品、費率或設定變更時執行：

1. **重量權重分攤**：若商品有重量資料，成本按 `(item.weight × quantity) / totalItemWeight` 分攤。若未提供重量則退回按數量分攤。

2. **先計算總成本**：

   - 國際運費：`intlRateKRW × totalBilledWeight × exchangeRate`
   - 關稅與國內運：`taxDomesticRateTWD × totalBilledWeight`
   - 箱子費用：`boxCostKRW × exchangeRate`
   - 韓國費用 (3%)：`totalKRW × exchangeRate × 0.03`

3. **逐項分攤**：總成本依重量比例分配給各商品，再除以數量得到單件成本。

4. **建議售價**：`finalUnitCost × (1 + profitMargin / 100)`

### 技術堆疊

- **React 19.2** 搭配 TypeScript
- **Vite 7.3** 用於開發與建構
- **Tailwind CSS 4.1** 用於樣式
- **lucide-react** 圖示庫
- 無狀態管理函式庫、無路由、無後端

### 型別定義

`Item` 介面在 App.tsx 中內聯定義（第 26-32 行）。沒有獨立的型別定義檔。

## 程式碼慣例

- **TypeScript**：啟用嚴格模式，包含 `noUnusedLocals` 和 `noUnusedParameters`
- **React**：僅使用函式元件，所有狀態管理使用 hooks
- **樣式**：Tailwind 工具類別、漸層背景、卡片式 UI
- **語言**：UI 文字使用正體中文（台灣），註解使用中文
- **文件與註解**：所有開發文件、程式碼註解、commit 訊息都使用正體中文

## 關鍵實作提醒

1. **無測試檔案**：此專案未配置測試套件。

2. **單一元件**：整個應用程式是一個元件。修改邏輯時，永遠都是編輯 `src/App.tsx`。

3. **衍生狀態模式**：`results` 和 `totals` 是由 useEffect 更新的衍生狀態，不會由使用者操作直接設定。

4. **ID 產生**：新商品的 ID 基於 `Math.max(...items.map(i => i.id)) + 1`（第 178 行）。

5. **數字格式化**：`fmt()` 輔助函式會四捨五入並加上千位分隔符號（第 187 行）。

6. **記憶功能防護**：永遠保留 `isInitialized` 旗標邏輯，這是防止資料遺失的關鍵機制。
