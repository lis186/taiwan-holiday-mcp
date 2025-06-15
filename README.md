# Taiwan Holiday MCP Server

[![Node.js Version](https://img.shields.io/node/v/taiwan-holiday-mcp.svg)](https://nodejs.org/)
[![npm version](https://badge.fury.io/js/taiwan-holiday-mcp.svg)](https://badge.fury.io/js/taiwan-holiday-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=taiwan-holiday&config=eyJjb21tYW5kIjoibnB4IHRhaXdhbi1ob2xpZGF5LW1jcCJ9)

一個基於 Model Context Protocol (MCP) 的台灣假期查詢伺服器，提供準確的台灣國定假日和補班日資訊。

## ✨ 特色功能

- 🇹🇼 **準確的台灣假期資料**：基於 [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar) 提供的政府公告假期資訊
- 🚀 **即時查詢**：支援單日查詢、範圍查詢和統計查詢
- 📅 **多種日期格式**：支援 `YYYY-MM-DD` 和 `YYYYMMDD` 格式
- 🔄 **智慧快取**：自動快取資料，提升查詢效能
- 🛠️ **MCP 標準**：完全相容 Model Context Protocol 規範
- 🎯 **AI 友善**：專為 Claude Desktop、Cursor 等 AI 工具設計
- 📊 **豐富統計**：提供假期統計和分析功能
- 🌐 **跨平台**：支援 Windows、macOS 和 Linux

## 🚀 快速開始

### NPX 直接使用（推薦）

最簡單的使用方式，無需安裝：

```bash
npx taiwan-holiday-mcp
```

### 本地安裝

```bash
npm install -g taiwan-holiday-mcp
taiwan-holiday-mcp
```

### 開發環境安裝

```bash
git clone https://github.com/lis186/taiwan-holiday-mcp.git
cd taiwan-holiday-mcp
npm install
npm run build
npm start
```



## 🔧 客戶端設定

### Claude Desktop 設定

在 Claude Desktop 的設定檔中新增：

```json
{
  "mcpServers": {
    "taiwan-holiday": {
      "command": "npx",
      "args": ["taiwan-holiday-mcp"]
    }
  }
}
```

**設定檔位置：**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Cursor 設定

點擊以下按鈕直接安裝。

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=taiwan-holiday&config=eyJjb21tYW5kIjoibnB4IHRhaXdhbi1ob2xpZGF5LW1jcCJ9)

### Windsurf 設定

在專案的 `.cursorrules` 或設定檔中新增：

```json
{
  "mcp": {
    "servers": {
      "taiwan-holiday": {
        "command": "npx",
        "args": ["taiwan-holiday-mcp"]
      }
    }
  }
}
```

## 📖 使用範例

安裝完成後，你可以直接在 Claude Desktop 中用自然語言與 AI 對話，詢問台灣假期相關問題：

### 基本查詢

**你可以這樣問：**
> "2025年10月10日是假期嗎？"
> 
> "幫我查一下2025年1月有哪些假期"
> 
> "2025年總共有多少個假期？"

**Claude 會自動呼叫相應的工具並回答：**
- ✅ 2025年10月10日是國慶日，是假期
- 📅 2025年1月共有14個假期，包含春節連假
- 📊 2025年總共有115個假期

### 實用對話範例

#### 🏖️ 假期規劃

**你：** "我想規劃2025年第一季的旅遊，幫我找出有哪些連假可以安排？"

**Claude：** 會自動查詢1-3月的假期，分析連續假期，並告訴你：
- 春節連假：1月27日-31日（5天）
- 228連假：2月28日-3月2日（3天）
- 其他週末假期安排建議

#### 💼 工作安排

**你：** "下週一（2025年10月6日）需要上班嗎？"

**Claude：** 會檢查該日期並回答是否為工作日，如果是假期還會說明原因。

#### 📈 假期統計

**你：** "2025年10月份有幾個假期？有什麼重要節日嗎？"

**Claude：** 會提供該月份的假期統計，包含國定假日和重要節慶資訊。

### 進階應用

#### 🎯 智慧假期分析

**你：** "幫我分析2025年哪個月份最適合請假旅遊？"

**Claude：** 會分析各月份的假期分布，考慮連假長度和頻率，給出最佳建議。

#### 📅 年度假期規劃

**你：** "我想看2025年所有的長假期，幫我整理一個清單"

**Claude：** 會自動找出所有3天以上的連假，並按時間順序整理成清單。

## 🛠️ API 文件

### MCP 工具

#### `check_holiday`

檢查指定日期是否為台灣假期。

**參數：**
- `date` (string): 日期，格式為 `YYYY-MM-DD` 或 `YYYYMMDD`

**回傳：**
```json
{
  "success": true,
  "data": {
    "date": "2025-10-10",
    "isHoliday": true,
    "description": "國慶日",
    "week": "五",
    "normalizedDate": "20251010"
  }
}
```

#### `get_holidays_in_range`

獲取指定日期範圍內的所有台灣假期。

**參數：**
- `start_date` (string): 開始日期
- `end_date` (string): 結束日期

**回傳：**
```json
{
  "success": true,
  "data": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "holidays": [...],
    "totalCount": 14,
    "summary": "在 2025-01-01 到 2025-01-31 期間共有 14 個假期"
  }
}
```

#### `get_holiday_stats`

獲取指定年份或年月的台灣假期統計資訊。

**參數：**
- `year` (number): 年份 (2017-2025)
- `month` (number, 可選): 月份 (1-12)

**回傳：**
```json
{
  "success": true,
  "data": {
    "year": 2025,
    "statistics": {
      "year": 2025,
      "totalHolidays": 115,
      "nationalHolidays": 113,
      "compensatoryDays": 2,
      "holidayTypes": {...}
    },
    "summary": "2025 年共有 115 個假期"
  }
}
```

### MCP 資源

伺服器提供以下資源：

- `taiwan-holidays://years` - 支援的年份列表
- `taiwan-holidays://holidays/{year}` - 指定年份的完整假期資料
- `taiwan-holidays://stats/{year}` - 指定年份的統計資訊

## 🔍 故障排除

### 常見問題

#### 1. 無法連接到伺服器

**問題**：Claude Desktop 顯示 "無法連接到 MCP 伺服器"

**解決方案**：
```bash
# 檢查 Node.js 版本（需要 18+）
node --version

# 重新安裝套件
npm uninstall -g taiwan-holiday-mcp
npm install -g taiwan-holiday-mcp

# 測試伺服器
taiwan-holiday-mcp --version
```

#### 2. 日期格式錯誤

**問題**：收到 "無效的日期格式" 錯誤

**解決方案**：
- 確保使用正確格式：`YYYY-MM-DD` 或 `YYYYMMDD`
- 檢查日期是否有效（例如：2025-02-30 是無效日期）

#### 3. 網路連接問題

**問題**：無法獲取假期資料

**解決方案**：
```bash
# 檢查網路連接
curl -I https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/2025.json

# 清除快取（如果有問題）
rm -rf ~/.taiwan-holiday-mcp-cache
```

### 除錯模式

啟用詳細日誌：

```bash
taiwan-holiday-mcp --debug
```

### 效能調整

如果查詢速度較慢：

1. 檢查網路連接
2. 確認快取機制正常運作
3. 考慮使用本地資料來源

## 🧪 開發與測試

詳細的開發說明請參考 [DEVELOPMENT.md](DEVELOPMENT.md)。

### 本地開發

```bash
# 複製專案
git clone https://github.com/lis186/taiwan-holiday-mcp.git
cd taiwan-holiday-mcp

# 安裝依賴
npm install

# 執行測試
npm test

# 建置專案
npm run build

# 啟動開發模式
npm run dev
```

### 測試覆蓋率

```bash
npm run test:coverage
```

目前測試覆蓋率：**92.34%**（246 個測試案例，100% 通過）

## 📊 效能指標

- **首次 API 呼叫**：< 2 秒
- **快取 API 呼叫**：< 100ms
- **併發處理**：支援 10+ 併發請求
- **記憶體使用**：< 50MB
- **測試穩定性**：100% 通過率，企業級品質標準
- **程式碼覆蓋率**：92.34%（遠超業界 80% 標準）

## 🤝 貢獻指南

歡迎貢獻！請遵循以下步驟：

1. Fork 專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## ⚠️ 免責聲明

### 資料來源與準確性

本專案的台灣假期資料來源於 [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar) 開源專案，該專案基於中華民國政府公告的官方假期資訊。

**重要聲明：**

1. **資料準確性**：雖然我們努力確保資料的準確性，但本專案不保證所提供的假期資訊完全正確或即時更新。
2. **官方資料**：如需最準確的假期資訊，請以中華民國政府相關部門的官方公告為準。
3. **資料更新**：假期資料可能因政府政策調整而變更，本專案會盡力跟進更新，但可能存在延遲。
4. **使用責任**：使用者應自行驗證重要日期的假期狀態，特別是用於商業或法律用途時。

### 服務可用性

- 本服務依賴外部資料來源，可能因網路問題或資料來源異常而暫時無法使用
- 我們不保證服務的 100% 可用性或回應時間
- 建議在關鍵應用中實作適當的錯誤處理和備援機制

### 責任限制

在法律允許的最大範圍內，本專案的作者和貢獻者不對因使用本軟體而產生的任何直接、間接、偶然、特殊或後果性損害承擔責任。

## 📄 授權條款

本專案採用 MIT 授權條款。詳見 [LICENSE](LICENSE) 檔案。

## 🙏 致謝

- [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar) - 提供準確的台灣假期資料
- [Model Context Protocol](https://modelcontextprotocol.io/) - 提供標準化的 AI 工具協議

## 📞 支援

- **GitHub Issues**: [回報問題](https://github.com/lis186/taiwan-holiday-mcp/issues)
- **文件**: [完整文件](https://github.com/lis186/taiwan-holiday-mcp/docs)

---

**版本**: 1.0.1
**最後更新**: 2025-06-14  
**Node.js 需求**: ≥ 18.0.0
**品質狀態**: 企業級生產就緒 ✅ 