# 開發說明

## 🛠️ 開發說明

此文件提供 Taiwan Holiday MCP Server 的開發環境設定和相關說明。

## 🛠️ 開發環境設定

### 系統需求

- Node.js ≥ 18.0.0
- npm ≥ 8.0.0

### 安裝與建置

```bash
# 複製專案
git clone https://github.com/lis186/taiwan-holiday-mcp.git
cd taiwan-holiday-mcp

# 安裝相依套件
npm install

# 建置專案
npm run build

# 執行測試
npm test

# 啟動伺服器
npm start
```

## 🔧 開發工具

### 可用的 npm 腳本

```bash
npm run clean          # 清理建置檔案
npm run build          # 建置專案
npm run build:watch    # 監控模式建置
npm run test           # 執行測試
npm run test:watch     # 監控模式測試
npm run test:coverage  # 測試覆蓋率報告
npm run lint           # 程式碼檢查
npm run lint:fix       # 自動修正程式碼風格
npm run package:test   # 測試打包
npm run package:local  # 本地打包
```

## 🔗 MCP 客戶端整合

### Claude Desktop 開發設定

在 Claude Desktop 設定檔中使用本地路徑：

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

**開發環境設定（使用本地路徑）：**

```json
{
  "mcpServers": {
    "taiwan-holiday": {
      "command": "node",
      "args": ["/完整路徑/taiwan-holiday-mcp/dist/index.js"]
    }
  }
}
```

### 測試連線

```bash
# 確認伺服器可以正常啟動
node dist/index.js

# 應該會看到 MCP 伺服器啟動訊息
```

## 📝 開發注意事項

1. **版本管理**: 遵循語意化版本規範
2. **測試覆蓋**: 維持高測試覆蓋率（目前 77.84%）
3. **程式碼品質**: 使用 ESLint 和 TypeScript 確保程式碼品質
4. **文件同步**: 確保 README.md 和 API 文件保持同步

## 🚀 發布流程

發布新版本的步驟：

1. 更新版本號碼 (`npm version patch/minor/major`)
2. 更新 CHANGELOG.md 記錄變更
3. 執行完整測試 (`npm test`)
4. 建置專案 (`npm run build`)
5. 發布到 npm (`npm publish`)

## 📞 聯絡資訊

如有開發相關問題，請聯絡：
- 維護者: Justin Lee
- 專案: https://github.com/lis186/taiwan-holiday-mcp 