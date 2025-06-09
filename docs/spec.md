# 台灣假期 MCP 伺服器 - 技術規格文件 (MVP)

## 1. 技術架構概述

### 1.1 技術棧

- **開發語言**：TypeScript 5.6+
- **執行環境**：Node.js 18+
- **MCP SDK**：@modelcontextprotocol/sdk ^1.0.1
- **資料來源**：TaiwanCalendar GitHub Repository
- **資料 CDN**：`https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/{year}.json`
- **套件管理**：npm
- **建置工具**：TypeScript Compiler (tsc)
- **執行方式**：npx 直接執行
- **目標客戶端**：Claude Desktop, Cursor, Windsurf

### 1.2 簡化專案結構（MVP）

```
taiwan-holiday-mcp-server/
├── src/
│   ├── index.ts                 # 主要入口點
│   ├── server.ts               # MCP 伺服器實作
│   ├── holiday-service.ts      # 假期資料服務
│   └── types.ts                # 型別定義
├── dist/                       # 編譯輸出目錄
├── package.json
├── tsconfig.json
├── README.md
└── .gitignore
```

## 2. MCP 協議實作

### 2.1 MCP Tools 完整定義（符合官方規格）

#### 2.1.1 check_holiday

```typescript
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
}
```

#### 2.1.2 get_holidays_in_range

```typescript
{
  name: "get_holidays_in_range",
  description: "取得日期範圍內的台灣假期列表",
  inputSchema: {
    type: "object",
    properties: {
      start_date: {
        type: "string",
        description: "開始日期，格式為 YYYY-MM-DD 或 YYYYMMDD",
        pattern: "^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$"
      },
      end_date: {
        type: "string",
        description: "結束日期，格式為 YYYY-MM-DD 或 YYYYMMDD",
        pattern: "^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$"
      }
    },
    required: ["start_date", "end_date"]
  }
}
```

#### 2.1.3 get_holiday_stats

```typescript
{
  name: "get_holiday_stats",
  description: "取得假期統計資訊",
  inputSchema: {
    type: "object",
    properties: {
      year: {
        type: "number",
        description: "年份",
        minimum: 2020,
        maximum: 2030
      },
      month: {
        type: "number",
        description: "月份（可選）",
        minimum: 1,
        maximum: 12
      }
    },
    required: ["year"]
  }
}
```

### 2.2 MCP Resources（符合官方規格）

#### 2.2.1 taiwan_holidays_{year}

```typescript
{
  uri: "taiwan-holidays://calendar/{year}",
  name: "台灣假期資料",
  description: "提供指定年度的完整假期資料",
  mimeType: "application/json"
}
```

### 2.3 MCP 伺服器完整架構

#### 2.3.1 伺服器初始化

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export class TaiwanHolidayMcpServer {
  private server: Server;
  
  constructor() {
    this.server = new Server({
      name: "taiwan-holiday-server",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.setupToolHandlers();
    this.setupResourceHandlers();
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
  "name": "taiwan-holiday-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "taiwan-holiday-mcp-server": "./dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.1"
  },
  "devDependencies": {
    "@types/node": "^22",
    "typescript": "^5.6.2"
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

## 7. 測試與部署（MVP）

### 7.1 基本測試

- 三個 MCP 工具的基本功能測試
- 日期格式驗證測試
- 錯誤處理測試

### 7.2 NPM 發布

```bash
npm run build
npm publish
```

---

**文件版本**：v1.1 (MVP)  
**建立日期**：2025-06-09  
**最後更新**：2025-06-09  
**負責人**：技術團隊
