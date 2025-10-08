# 本地開發與測試指南

## 🚀 本地 MCP 伺服器安裝方法

### 方法 1：直接使用本地路徑（推薦）

在 Cursor 的 MCP 配置中（`~/.cursor/mcp.json`），添加或修改配置：

```json
{
  "mcpServers": {
    "taiwan-holiday-local": {
      "command": "node",
      "args": [
        "/Users/justinlee/dev/taiwan-calendar-mcp-server/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "true"
      }
    }
  }
}
```

### 方法 2：使用 npm link

1. **在專案目錄建立全域連結**：
```bash
cd /Users/justinlee/dev/taiwan-calendar-mcp-server
npm link
```

2. **在 Cursor MCP 配置中使用**：
```json
{
  "mcpServers": {
    "taiwan-holiday-local": {
      "command": "taiwan-holiday-mcp",
      "env": {
        "DEBUG": "true"
      }
    }
  }
}
```

### 方法 3：使用相對路徑（最靈活）

```json
{
  "mcpServers": {
    "taiwan-holiday-dev": {
      "command": "node",
      "args": [
        "${workspaceFolder}/dist/index.js"
      ],
      "env": {}
    }
  }
}
```

## 📝 完整配置範例

將以下配置添加到 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "taiwan-holiday-local": {
      "command": "node",
      "args": [
        "/Users/justinlee/dev/taiwan-calendar-mcp-server/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "development",
        "MCP_LOG_LEVEL": "debug"
      }
    }
  }
}
```

## 🔧 開發流程

### 1. 修改程式碼後重新建置

```bash
npm run build
```

### 2. 測試本地版本

```bash
# 直接執行
node dist/index.js

# 或使用 npm link 後
taiwan-holiday-mcp
```

### 3. 重啟 Cursor

修改配置後，需要重啟 Cursor 或重新載入 MCP 連接。

## 🧪 測試 2026 年支援

### 使用 Node.js 直接測試

```javascript
const { HolidayService } = require('./dist/holiday-service.js');
const service = new HolidayService();

async function test() {
  // 測試 2026 年
  const holiday = await service.checkHoliday('2026-01-01');
  console.log('2026-01-01:', holiday);
  
  // 測試統計
  const stats = await service.getHolidayStats(2026);
  console.log('2026 年統計:', stats);
}

test();
```

### 在 Cursor 中測試

啟動 Cursor 後，可以直接詢問：

```
檢查 2026 年 1 月 1 日是否為假期
```

或

```
列出 2026 年所有假期
```

## 🐛 除錯模式

啟用詳細日誌：

```json
{
  "mcpServers": {
    "taiwan-holiday-local": {
      "command": "node",
      "args": [
        "/Users/justinlee/dev/taiwan-calendar-mcp-server/dist/index.js",
        "--debug"
      ],
      "env": {
        "DEBUG": "true",
        "NODE_ENV": "development"
      }
    }
  }
}
```

## 📊 驗證安裝

### 檢查 MCP 工具列表

在 Cursor 中，MCP 伺服器啟動後會自動載入三個工具：

1. `check_holiday` - 檢查特定日期是否為假期
2. `get_holidays_in_range` - 獲取日期範圍內的假期
3. `get_holiday_stats` - 獲取年度假期統計

### 檢查支援的年份

支援的年份範圍現在是：**2017-2026**

## 🔄 更新本地版本

當你修改程式碼後：

1. **重新建置**：
```bash
npm run build
```

2. **重啟 Cursor MCP 連接**：
   - 方法 1：完全重啟 Cursor
   - 方法 2：重新載入 MCP 配置（如果 Cursor 支援）

## ⚠️ 注意事項

1. **路徑使用絕對路徑**：避免使用 `~` 符號，使用完整路徑
2. **確保已建置**：執行 `npm run build` 後才能使用
3. **檢查權限**：確保 `dist/index.js` 有執行權限
4. **環境變數**：開發時可以設定 `DEBUG=true` 查看詳細日誌

## 🎯 快速開始命令

```bash
# 1. 建置專案
npm run build

# 2. 測試本地執行
node dist/index.js --version

# 3. 建立全域連結（可選）
npm link

# 4. 編輯 Cursor MCP 配置
# 添加上面的配置到 ~/.cursor/mcp.json

# 5. 重啟 Cursor
```

---

**最後更新**: 2025-10-08  
**支援年份**: 2017-2026


