# API 參考文件

Taiwan Holiday MCP Server 提供完整的台灣假期查詢 API，基於 Model Context Protocol (MCP) 標準。

## 概述

### 基本資訊

- **協議版本**: MCP 1.0
- **伺服器版本**: 1.0.0
- **支援的年份範圍**: 2017-2025
- **資料來源**: [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar)
- **更新頻率**: 即時（基於政府公告）

### 連接資訊

```json
{
  "name": "taiwan-holiday-mcp",
  "version": "1.0.0",
  "capabilities": {
    "tools": {},
    "resources": {}
  }
}
```

## MCP 工具 (Tools)

### 1. check_holiday

檢查指定日期是否為台灣假期。

#### 請求格式

```json
{
  "method": "tools/call",
  "params": {
    "name": "check_holiday",
    "arguments": {
      "date": "2024-10-10"
    }
  }
}
```

#### 參數

| 參數名 | 類型 | 必填 | 描述 | 格式 |
|--------|------|------|------|------|
| `date` | string | ✅ | 要查詢的日期 | `YYYY-MM-DD` 或 `YYYYMMDD` |

#### 參數驗證

- **日期格式**: 必須符合正規表達式 `^(\d{4}-\d{2}-\d{2}|\d{8})$`
- **日期有效性**: 必須是有效的日期（例如：2024-02-30 無效）
- **年份範圍**: 2017-2025

#### 回應格式

**成功回應：**
```json
{
  "success": true,
  "data": {
    "date": "2024-10-10",
    "isHoliday": true,
    "name": "國慶日",
    "description": "中華民國國慶日",
    "type": "國定假日"
  },
  "timestamp": "2025-06-11T10:30:00.000Z"
}
```

**非假期回應：**
```json
{
  "success": true,
  "data": {
    "date": "2024-10-11",
    "isHoliday": false,
    "name": null,
    "description": null,
    "type": "工作日"
  },
  "timestamp": "2025-06-11T10:30:00.000Z"
}
```

#### 回應欄位說明

| 欄位 | 類型 | 描述 |
|------|------|------|
| `success` | boolean | 請求是否成功 |
| `data.date` | string | 查詢的日期 (YYYY-MM-DD 格式) |
| `data.isHoliday` | boolean | 是否為假期 |
| `data.name` | string\|null | 假期名稱 |
| `data.description` | string\|null | 假期描述 |
| `data.type` | string | 日期類型 ("國定假日", "工作日") |
| `timestamp` | string | 回應時間戳 (ISO 8601) |

### 2. get_holidays_in_range

獲取指定日期範圍內的所有台灣假期。

#### 請求格式

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_holidays_in_range",
    "arguments": {
      "start_date": "2024-10-01",
      "end_date": "2024-10-31"
    }
  }
}
```

#### 參數

| 參數名 | 類型 | 必填 | 描述 | 格式 |
|--------|------|------|------|------|
| `start_date` | string | ✅ | 開始日期 | `YYYY-MM-DD` 或 `YYYYMMDD` |
| `end_date` | string | ✅ | 結束日期 | `YYYY-MM-DD` 或 `YYYYMMDD` |

#### 參數驗證

- **日期格式**: 同 `check_holiday`
- **日期範圍**: `end_date` 必須大於或等於 `start_date`
- **範圍限制**: 建議查詢範圍不超過 2 年

#### 回應格式

```json
{
  "success": true,
  "data": {
    "holidays": [
      {
        "date": "2024-10-10",
        "name": "國慶日",
        "description": "中華民國國慶日",
        "type": "國定假日"
      }
    ],
    "summary": {
      "totalHolidays": 1,
      "dateRange": "2024-10-01 to 2024-10-31",
      "startDate": "2024-10-01",
      "endDate": "2024-10-31"
    }
  },
  "timestamp": "2025-06-11T10:30:00.000Z"
}
```

#### 回應欄位說明

| 欄位 | 類型 | 描述 |
|------|------|------|
| `data.holidays` | array | 假期列表 |
| `data.holidays[].date` | string | 假期日期 |
| `data.holidays[].name` | string | 假期名稱 |
| `data.holidays[].description` | string | 假期描述 |
| `data.holidays[].type` | string | 假期類型 |
| `data.summary.totalHolidays` | number | 假期總數 |
| `data.summary.dateRange` | string | 查詢範圍描述 |
| `data.summary.startDate` | string | 開始日期 |
| `data.summary.endDate` | string | 結束日期 |

### 3. get_holiday_stats

獲取指定年份或年月的台灣假期統計資訊。

#### 請求格式

**年度統計：**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_holiday_stats",
    "arguments": {
      "year": 2024
    }
  }
}
```

**月度統計：**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_holiday_stats",
    "arguments": {
      "year": 2024,
      "month": 10
    }
  }
}
```

#### 參數

| 參數名 | 類型 | 必填 | 描述 | 範圍 |
|--------|------|------|------|------|
| `year` | integer | ✅ | 查詢年份 | 2017-2025 |
| `month` | integer | ❌ | 查詢月份 | 1-12 |

#### 回應格式

**年度統計：**
```json
{
  "success": true,
  "data": {
    "year": 2024,
    "totalHolidays": 115,
    "totalWorkdays": 251,
    "monthlyBreakdown": {
      "1": { "holidays": 3, "workdays": 22 },
      "2": { "holidays": 7, "workdays": 21 },
      "3": { "holidays": 2, "workdays": 19 },
      "4": { "holidays": 6, "workdays": 20 },
      "5": { "holidays": 2, "workdays": 21 },
      "6": { "holidays": 3, "workdays": 17 },
      "7": { "holidays": 9, "workdays": 22 },
      "8": { "holidays": 9, "workdays": 22 },
      "9": { "holidays": 17, "workdays": 13 },
      "10": { "holidays": 17, "workdays": 14 },
      "11": { "holidays": 9, "workdays": 21 },
      "12": { "holidays": 31, "workdays": 0 }
    },
    "majorHolidays": [
      "春節", "清明節", "勞動節", "端午節", 
      "中秋節", "國慶日", "元旦"
    ]
  },
  "timestamp": "2025-06-11T10:30:00.000Z"
}
```

**月度統計：**
```json
{
  "success": true,
  "data": {
    "year": 2024,
    "month": 10,
    "totalHolidays": 17,
    "totalWorkdays": 14,
    "holidays": [
      {
        "date": "2024-10-10",
        "name": "國慶日",
        "type": "國定假日"
      }
    ],
    "weekends": 16,
    "workingDaysInMonth": 31
  },
  "timestamp": "2025-06-11T10:30:00.000Z"
}
```

## MCP 資源 (Resources)

### 資源列表

| URI | 名稱 | 描述 | MIME 類型 |
|-----|------|------|-----------|
| `taiwan-holidays://years` | 支援的年份列表 | 列出所有支援查詢的年份範圍 | `application/json` |
| `taiwan-holidays://holidays/{year}` | 年度假期資料 | 指定年份的完整假期資料 | `application/json` |
| `taiwan-holidays://stats/{year}` | 年度統計資料 | 指定年份的統計資訊 | `application/json` |

### 1. taiwan-holidays://years

#### 請求格式

```json
{
  "method": "resources/read",
  "params": {
    "uri": "taiwan-holidays://years"
  }
}
```

#### 回應格式

```json
{
  "contents": [
    {
      "uri": "taiwan-holidays://years",
      "mimeType": "application/json",
      "text": "{\"supportedYears\":[2017,2018,2019,2020,2021,2022,2023,2024,2025],\"currentYear\":2024,\"dataSource\":\"TaiwanCalendar\",\"lastUpdated\":\"2025-06-11T10:30:00.000Z\"}"
    }
  ]
}
```

### 2. taiwan-holidays://holidays/{year}

#### 請求格式

```json
{
  "method": "resources/read",
  "params": {
    "uri": "taiwan-holidays://holidays/2024"
  }
}
```

#### 回應格式

```json
{
  "contents": [
    {
      "uri": "taiwan-holidays://holidays/2024",
      "mimeType": "application/json",
      "text": "{\"year\":2024,\"holidays\":[{\"date\":\"2024-01-01\",\"name\":\"元旦\",\"description\":\"中華民國開國紀念日\",\"type\":\"國定假日\"},...],\"totalHolidays\":115,\"lastUpdated\":\"2025-06-11T10:30:00.000Z\"}"
    }
  ]
}
```

### 3. taiwan-holidays://stats/{year}

#### 請求格式

```json
{
  "method": "resources/read",
  "params": {
    "uri": "taiwan-holidays://stats/2024"
  }
}
```

#### 回應格式

```json
{
  "contents": [
    {
      "uri": "taiwan-holidays://stats/2024",
      "mimeType": "application/json",
      "text": "{\"year\":2024,\"totalHolidays\":115,\"totalWorkdays\":251,\"monthlyBreakdown\":{...},\"majorHolidays\":[...],\"lastUpdated\":\"2025-06-11T10:30:00.000Z\"}"
    }
  ]
}
```

## 錯誤處理

### 錯誤回應格式

```json
{
  "success": false,
  "error": "錯誤訊息",
  "errorType": "ERROR_CODE",
  "timestamp": "2025-06-11T10:30:00.000Z",
  "tool": "工具名稱"
}
```

### 錯誤代碼參考

| 錯誤代碼 | 描述 | 常見原因 |
|----------|------|----------|
| `INVALID_DATE_FORMAT` | 無效的日期格式 | 日期格式不符合 YYYY-MM-DD 或 YYYYMMDD |
| `INVALID_DATE` | 無效的日期 | 日期不存在（如 2024-02-30） |
| `INVALID_DATE_RANGE` | 無效的日期範圍 | 結束日期早於開始日期 |
| `YEAR_OUT_OF_RANGE` | 年份超出範圍 | 年份不在 2017-2025 範圍內 |
| `MONTH_OUT_OF_RANGE` | 月份超出範圍 | 月份不在 1-12 範圍內 |
| `NETWORK_ERROR` | 網路錯誤 | 無法連接到資料來源 |
| `DATA_PARSE_ERROR` | 資料解析錯誤 | 資料格式錯誤或損壞 |
| `CACHE_ERROR` | 快取錯誤 | 快取系統故障 |
| `UNKNOWN_ERROR` | 未知錯誤 | 其他未分類錯誤 |

### 錯誤處理範例

#### 1. 日期格式錯誤

**請求：**
```json
{
  "name": "check_holiday",
  "arguments": {
    "date": "2024/10/10"
  }
}
```

**回應：**
```json
{
  "success": false,
  "error": "無效的日期格式。請使用 YYYY-MM-DD 或 YYYYMMDD 格式",
  "errorType": "INVALID_DATE_FORMAT",
  "timestamp": "2025-06-11T10:30:00.000Z",
  "tool": "check_holiday"
}
```

#### 2. 日期範圍錯誤

**請求：**
```json
{
  "name": "get_holidays_in_range",
  "arguments": {
    "start_date": "2024-12-31",
    "end_date": "2024-01-01"
  }
}
```

**回應：**
```json
{
  "success": false,
  "error": "結束日期不能早於開始日期",
  "errorType": "INVALID_DATE_RANGE",
  "timestamp": "2025-06-11T10:30:00.000Z",
  "tool": "get_holidays_in_range"
}
```

## 效能特性

### 快取機制

- **記憶體快取**: 查詢結果會快取在記憶體中
- **快取時間**: 24 小時 TTL
- **快取策略**: LRU (Least Recently Used)
- **快取大小**: 最多 100 個條目

### 效能指標

| 操作 | 首次查詢 | 快取查詢 | 併發支援 |
|------|----------|----------|----------|
| `check_holiday` | < 2 秒 | < 100ms | 10+ |
| `get_holidays_in_range` | < 5 秒 | < 200ms | 5+ |
| `get_holiday_stats` | < 3 秒 | < 150ms | 8+ |

### 限制

- **查詢範圍**: 建議單次查詢不超過 2 年範圍
- **併發限制**: 同時最多 10 個請求
- **記憶體使用**: < 100MB
- **網路超時**: 30 秒

## 資料格式

### 日期格式

支援兩種日期格式：

1. **ISO 8601 格式**: `YYYY-MM-DD` (推薦)
   - 範例: `2024-10-10`
   - 優點: 國際標準，易讀

2. **緊湊格式**: `YYYYMMDD`
   - 範例: `20241010`
   - 優點: 簡潔，適合程式處理

### 假期類型

| 類型 | 描述 | 範例 |
|------|------|------|
| `國定假日` | 政府公告的國定假日 | 國慶日、春節 |
| `工作日` | 一般工作日 | 平日非假期 |

### 時間戳格式

所有時間戳使用 ISO 8601 格式：
- 格式: `YYYY-MM-DDTHH:mm:ss.sssZ`
- 時區: UTC
- 範例: `2025-06-11T10:30:00.000Z`

## 版本資訊

### 當前版本

- **API 版本**: 1.0.0
- **MCP 協議版本**: 1.0
- **發布日期**: 2025-06-11
- **相容性**: 向後相容

### 變更歷史

#### v1.0.0 (2025-06-11)
- 初始版本發布
- 支援三個核心工具
- 完整的資源系統
- 智慧快取機制

## 最佳實踐

### 1. 效能最佳化

```typescript
// 推薦：使用範圍查詢
const holidays = await get_holidays_in_range("2024-01-01", "2024-12-31");

// 不推薦：多次單日查詢
// for (const date of dates) {
//   await check_holiday(date);
// }
```

### 2. 錯誤處理

```typescript
try {
  const result = await check_holiday("2024-10-10");
  if (result.success) {
    console.log(result.data);
  } else {
    console.error(`錯誤: ${result.error}`);
  }
} catch (error) {
  console.error(`網路錯誤: ${error.message}`);
}
```

### 3. 快取利用

```typescript
// 利用快取，避免重複查詢
const cache = new Map();

async function getCachedHoliday(date) {
  if (cache.has(date)) {
    return cache.get(date);
  }
  
  const result = await check_holiday(date);
  cache.set(date, result);
  return result;
}
```

---

**文件版本**: 1.0.0  
**最後更新**: 2025-06-11  
**維護者**: Taiwan Holiday MCP Team 