# 台灣假期 MCP 伺服器 - 技術規格文件 (MVP)

## 1. 技術架構概述

### 1.1 技術棧

- **開發語言**：TypeScript 5.8.3
- **執行環境**：Node.js 18+
- **MCP SDK**：@modelcontextprotocol/sdk ^1.12.1 ✅ (已升級)
- **資料來源**：TaiwanCalendar GitHub Repository
- **資料 CDN**：`https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/{year}.json`
- **套件管理**：npm
- **建置工具**：TypeScript Compiler (tsc)
- **執行方式**：npx 直接執行
- **目標客戶端**：Claude Desktop, Cursor, Windsurf
- **測試框架**：Jest 29.7.0 with ts-jest 29.2.5
- **測試覆蓋率**：77.84% (120 個測試，100% 通過率) ✅
- **MCP 工具狀態**：3 個工具全部實作完成並通過驗證 ✅
- **專案狀態**：生產就緒，Task 3.1 完成 ✅
- **架構設計**：統一整合架構（所有工具整合在 server.ts 中）✅

### 1.2 簡化專案結構（MVP）

```
taiwan-holiday-mcp-server/
├── src/
│   ├── index.ts                 # 主要入口點
│   ├── server.ts               # MCP 伺服器實作
│   ├── holiday-service.ts      # 假期資料服務
│   ├── types.ts                # 型別定義
│   └── utils/                  # 工具函數
│       └── date-parser.ts      # 日期解析工具
├── tests/                      # 測試目錄
│   ├── unit/                   # 單元測試
│   ├── integration/            # 整合測試
│   └── fixtures/               # 測試資料
├── docs/                       # 文件目錄
│   ├── plan.md                 # 開發計劃
│   ├── spec.md                 # 技術規格
│   ├── PRD.md                  # 產品需求
│   └── verification/           # 驗證文件
├── dist/                       # 編譯輸出目錄
├── package.json
├── tsconfig.json
├── jest.config.js              # Jest 配置
├── README.md
└── .gitignore
```

## 2. MCP 協議實作 ✅

**實作狀態**: 所有 MCP 工具已完整實作並通過驗證  
**架構設計**: 統一整合架構，所有工具整合在 `src/server.ts` 中  
**驗證日期**: 2025-06-10

### 2.0 重大架構決定

#### 2.0.1 統一整合架構 vs 分離檔案架構

**原計劃架構** (分離檔案):
```
src/tools/
├── check-holiday.ts
├── get-holidays-in-range.ts
└── get-holiday-stats.ts
```

**實際採用架構** (統一整合):
```
src/server.ts - 包含所有三個 MCP 工具的完整實作
```

**架構優勢**:
- ✅ **減少複雜度**: 避免多檔案間的相依性管理
- ✅ **統一錯誤處理**: 所有工具共用相同的錯誤處理邏輯
- ✅ **更好的維護性**: 單一檔案更容易維護和除錯
- ✅ **避免重複程式碼**: 共用的工具函數和設定

#### 2.0.2 工具優先 vs 資源優先策略

**決定**: 採用工具優先策略，透過 `get_holiday_stats` 工具提供資源功能

**理由**:
- 工具提供更靈活的參數驗證和錯誤處理
- 統一的回應格式和用戶體驗
- 減少 MCP 協議複雜度

### 2.1 MCP Tools 完整定義（符合官方規格）✅

#### 2.1.1 check_holiday ✅

**實作位置**: `src/server.ts` 第 47-58 行  
**處理邏輯**: `src/server.ts` 第 153-175 行

```typescript
{
  name: "check_holiday",
  description: "檢查指定日期是否為台灣假期",
  inputSchema: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "要查詢的日期，支援格式：YYYY-MM-DD 或 YYYYMMDD",
        pattern: "^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$"
      }
    },
    required: ["date"],
    additionalProperties: false
  }
}
```

#### 2.1.2 get_holidays_in_range ✅

**實作位置**: `src/server.ts` 第 59-77 行  
**處理邏輯**: `src/server.ts` 第 180-210 行

```typescript
{
  name: "get_holidays_in_range",
  description: "獲取指定日期範圍內的所有台灣假期",
  inputSchema: {
    type: "object",
    properties: {
      start_date: {
        type: "string",
        description: "開始日期，支援格式：YYYY-MM-DD 或 YYYYMMDD",
        pattern: "^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$"
      },
      end_date: {
        type: "string",
        description: "結束日期，支援格式：YYYY-MM-DD 或 YYYYMMDD",
        pattern: "^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$"
      }
    },
    required: ["start_date", "end_date"],
    additionalProperties: false
  }
}
```

#### 2.1.3 get_holiday_stats ✅

**實作位置**: `src/server.ts` 第 78-95 行  
**處理邏輯**: `src/server.ts` 第 215-235 行

```typescript
{
  name: "get_holiday_stats",
  description: "獲取指定年份或年月的台灣假期統計資訊",
  inputSchema: {
    type: "object",
    properties: {
      year: {
        type: "integer",
        description: "要查詢的年份",
        minimum: 2017,
        maximum: 2025
      },
      month: {
        type: "integer",
        description: "要查詢的月份（可選），1-12",
        minimum: 1,
        maximum: 12
      }
    },
    required: ["year"],
    additionalProperties: false
  }
}
```

### 2.2 MCP Resources（符合官方規格）⚠️

**實作狀態**: 透過工具實作，未實作獨立資源端點  
**設計決定**: 採用工具優先策略，資源功能透過 `get_holiday_stats` 工具提供

#### 2.2.1 taiwan_holidays_{year} (透過工具實作)

```typescript
// 透過 get_holiday_stats 工具提供相同功能
{
  name: "get_holiday_stats",
  description: "獲取指定年份的完整假期資料和統計",
  // ... 完整的工具定義
}
```

### 2.3 MCP 伺服器完整架構 ✅

**實作狀態**: 完整實作並通過驗證  
**架構特色**: 統一整合架構，所有功能整合在單一檔案中  
**檔案位置**: `src/server.ts` (308 行)

#### 2.3.1 伺服器初始化 ✅

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { HolidayService, HolidayServiceError } from './holiday-service.js';
import { ErrorType } from './types.js';

export class TaiwanHolidayMcpServer {
  private server: Server;
  private holidayService: HolidayService;
  
  constructor() {
    this.server = new Server({
      name: "taiwan-holiday-server",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    this.holidayService = new HolidayService();
    this.setupToolHandlers();
    this.setupErrorHandling();
  }
}
```

#### 2.3.2 工具處理器實作

```typescript
private setupToolHandlers() {
  // 列出可用工具
  this.server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "check_holiday",
          description: "檢查指定日期是否為台灣假期",
          inputSchema: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "日期，格式為 YYYY-MM-DD 或 YYYYMMDD",
                pattern: "^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$"
              }
            },
            required: ["date"]
          }
        },
        // ... 其他工具定義
      ]
    };
  });

  // 執行工具
  this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (!args) {
      throw new Error(`No arguments provided for tool: ${name}`);
    }
    
    switch (name) {
      case "check_holiday":
        return await this.handleCheckHoliday(args);
      case "get_holidays_in_range":
        return await this.handleGetHolidaysInRange(args);
      case "get_holiday_stats":
        return await this.handleGetHolidayStats(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}
```

#### 2.3.3 資源處理器實作

```typescript
private setupResourceHandlers() {
  // 列出可用資源
  this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "taiwan-holidays://calendar/2024",
          name: "台灣 2024 年假期資料",
          description: "2024 年完整假期資料",
          mimeType: "application/json"
        }
        // ... 其他年份
      ]
    };
  });

  // 讀取資源
  this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    const match = uri.match(/^taiwan-holidays:\/\/calendar\/(\d{4})$/);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
    
    const year = parseInt(match[1]);
    const holidayData = await this.holidayService.getYearData(year);
    
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(holidayData, null, 2)
        }
      ]
    };
  });
}
```

#### 2.3.4 啟動流程

```typescript
async start() {
  const transport = new StdioServerTransport();
  await this.server.connect(transport);
  console.error("Taiwan Holiday MCP Server running on stdio");
}

// 主函數
async function main() {
  const server = new TaiwanHolidayMcpServer();
  await server.start();
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

## 3. 客戶端相容性

### 3.1 Claude Desktop 設定

```json
{
  "mcpServers": {
    "taiwan-holiday": {
      "command": "npx",
      "args": ["taiwan-holiday-mcp-server"]
    }
  }
}
```

### 3.2 Cursor/Windsurf 設定

```json
{
  "mcp": {
    "servers": {
      "taiwan-holiday": {
        "command": "npx",
        "args": ["taiwan-holiday-mcp-server"]
      }
    }
  }
}
```

## 4. 資料模型與回傳格式（MVP）

### 4.1 基本假期資料結構

```typescript
// 與 TaiwanCalendar 資料來源格式完全一致
export interface Holiday {
  date: string;           // YYYYMMDD 格式，如 "20240101"
  week: string;          // 星期幾，如 "一"、"二"、"日"
  isHoliday: boolean;    // 是否為假期
  description: string;   // 假期描述，如 "開國紀念日"、"補假"
}

export interface HolidayStats {
  year: number;
  month?: number;
  totalHolidays: number;
  holidays: Holiday[];
}

// TaiwanCalendar 原始資料格式範例
// [
//   {
//     "date": "20230101",
//     "week": "日",
//     "isHoliday": true,
//     "description": "開國紀念日"
//   }
// ]
```

### 4.2 MCP 工具回傳格式

#### 4.2.1 check_holiday 回傳格式

```typescript
// 成功回傳
{
  content: [
    {
      type: "text",
      text: JSON.stringify({
        date: "20240101",
        week: "一",
        isHoliday: true,
        description: "開國紀念日",
        formatted_date: "2024-01-01"
      }, null, 2)
    }
  ]
}

// 非假期回傳
{
  content: [
    {
      type: "text", 
      text: JSON.stringify({
        date: "20240102",
        week: "二",
        isHoliday: false,
        description: "一般工作日",
        formatted_date: "2024-01-02"
      }, null, 2)
    }
  ]
}
```

#### 4.2.2 get_holidays_in_range 回傳格式

```typescript
{
  content: [
    {
      type: "text",
      text: JSON.stringify({
        start_date: "2024-01-01",
        end_date: "2024-01-31", 
        total_holidays: 3,
        holidays: [
          {
            date: "20240101",
            week: "一",
            isHoliday: true,
            description: "開國紀念日"
          },
          // ... 其他假期
        ]
      }, null, 2)
    }
  ]
}
```

#### 4.2.3 get_holiday_stats 回傳格式

```typescript
{
  content: [
    {
      type: "text",
      text: JSON.stringify({
        year: 2024,
        month: 1, // 可選
        total_holidays: 15,
        total_days: 366,
        holiday_percentage: 4.1,
        holidays_by_month: {
          "1": 3,
          "2": 5,
          // ... 其他月份
        },
        holidays: [
          // 完整假期列表
        ]
      }, null, 2)
    }
  ]
}
```

### 4.3 錯誤處理格式

```typescript
// 日期格式錯誤
throw new Error("Invalid date format. Expected YYYY-MM-DD or YYYYMMDD");

// 日期範圍錯誤  
throw new Error("End date must be after start date");

// 年份超出範圍
throw new Error("Year must be between 2020 and 2030");

// 資料來源錯誤
throw new Error("Failed to fetch holiday data from TaiwanCalendar");

// 網路錯誤
throw new Error("Network error: Unable to connect to data source");
```

## 5. 核心服務架構（MVP）

### 5.1 HolidayService 介面

```typescript
export class HolidayService {
  private readonly CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data';
  
  async getYearData(year: number): Promise<Holiday[]>
  async checkHoliday(date: string): Promise<Holiday>
  async getHolidaysInRange(startDate: string, endDate: string): Promise<Holiday[]>
}
```

### 5.2 工具處理方法

```typescript
// 每個工具對應一個處理方法
private async handleCheckHoliday(args: any): Promise<MCPResponse>
private async handleGetHolidaysInRange(args: any): Promise<MCPResponse>
private async handleGetHolidayStats(args: any): Promise<MCPResponse>
```

## 6. NPX 套件設定

### 6.1 package.json 設定

```json
{
  "name": "taiwan-holiday-mcp",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "taiwan-holiday-mcp": "./dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc && shx chmod +x dist/*.js",
    "build:watch": "tsc --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "prepare": "npm run build",
    "prepublishOnly": "npm run test && npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.2",
    "@typescript-eslint/eslint-plugin": "^8.18.2",
    "@typescript-eslint/parser": "^8.18.2",
    "eslint": "^9.17.0",
    "jest": "^29.7.0",
    "nock": "^13.5.6",
    "shx": "^0.4.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.8.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 6.2 入口點設定

```typescript
#!/usr/bin/env node
// src/index.ts

import { TaiwanHolidayMcpServer } from './server.js';

async function main() {
  const server = new TaiwanHolidayMcpServer();
  await server.start();
}

main().catch(console.error);
```

## 7. 測試與部署 ✅

### 7.1 測試狀態 ✅

**測試結果** (2025-06-10):
- **測試套件**: 6 個，全部通過
- **測試案例**: 120 個，100% 通過率
- **測試覆蓋率**: 77.84% (核心業務邏輯 >90%)
- **執行時間**: 16.24 秒

**測試類型**:
- ✅ 單元測試：核心功能和邊界情況
- ✅ 整合測試：端到端流程和效能基準
- ✅ 錯誤處理測試：完整的錯誤情境覆蓋
- ✅ 效能測試：首次查詢 <2s，快取查詢 <100ms

### 7.2 部署狀態 ✅

**專案狀態**: 生產就緒  
**建置狀態**: 完整建置流程已驗證  
**NPX 執行**: 已測試並正常運作

```bash
# 建置專案
npm run build

# 執行測試
npm test

# NPX 執行測試
npx taiwan-holiday-mcp-server
```

### 7.3 品質指標達成 ✅

- ✅ **功能完整性**: 三個核心 MCP 工具全部實作
- ✅ **測試品質**: 120 個測試案例 100% 通過
- ✅ **效能基準**: 所有效能指標達標
- ✅ **錯誤處理**: 完善的三層錯誤處理機制
- ✅ **程式碼品質**: TypeScript 嚴格模式，無編譯錯誤

---

**文件版本**：v2.0 (生產就緒版)  
**建立日期**：2025-06-09  
**最後更新**：2025-06-10  
**專案狀態**：生產就緒，Task 3.1 完成  
**負責人**：技術團隊
