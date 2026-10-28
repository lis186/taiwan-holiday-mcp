# API 參考文件

Taiwan Holiday MCP Server 提供完整的台灣假期查詢 API，基於 Model Context Protocol (MCP) 標準。

## 概述

### 基本資訊

- **協議版本**: MCP 1.0
- **伺服器版本**: 2.1.0
- **支援的年份範圍**: 2017 年起；上限不寫死在套件裡，由上游是否有該年度資料決定
- **資料來源**: [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar)
- **颱風假資料來源**: [DGPA 即時頁](https://www.dgpa.gov.tw/typh/daily/nds.html)（今天、明天）與 [TaiwanTyphoonDays](https://github.com/lis186/TaiwanTyphoonDays) 歸檔（2001-07-30 起）
- **更新頻率**: 即時（基於政府公告）

### 連接資訊

```json
{
  "name": "taiwan-holiday-mcp",
  "version": "2.1.0",
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
- **年份範圍**: 2017 年起（上游尚未發布的年度會回報「上游尚未發布」）

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
| `year` | integer | ✅ | 查詢年份 | 2017 年起 |
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

### 4. check_typhoon_closure

查詢颱風假（天然災害停止上班上課）。今天、明天讀人事行政總處（DGPA）[即時頁](https://www.dgpa.gov.tw/typh/daily/nds.html)，
其他日期讀 [TaiwanTyphoonDays](https://github.com/lis186/TaiwanTyphoonDays) 歸檔（2001-07-30 起）。
判斷規則由 [`taiwan-holiday-cli`](https://github.com/lis186/taiwan-holiday-cli) 提供，本工具不另行實作。

#### 請求格式

```json
{
  "method": "tools/call",
  "params": {
    "name": "check_typhoon_closure",
    "arguments": {
      "date": "2024-10-31",
      "city": "台北市"
    }
  }
}
```

#### 參數

| 參數名 | 類型 | 必填 | 描述 | 格式 |
|--------|------|------|------|------|
| `date` | string | ❌ | 查詢日期（臺灣時間），省略為今天；最早 2001-07-30 | `today`、`tomorrow`、`YYYY-MM-DD`、`YYYYMMDD` |
| `city` | string | ❌ | 縣市名稱，台／臺視為相同；省略為全國 | 例如 `臺北市` |

縣市名保留當時名稱（如改制前的臺北縣），不對應現行行政區。

#### 回應格式

```json
{
  "success": true,
  "summary": "2024-10-31 臺北市：停止上班（全天）、停止上課（全天）〔已定案〕",
  "data": {
    "date": "20241031",
    "city": "臺北市",
    "work": { "status": "stopped", "period": "allDay", "from": "" },
    "school": { "status": "stopped", "period": "allDay", "from": "" },
    "basis": "own",
    "reason": null,
    "source": {
      "kind": "archive",
      "url": "https://www.dgpa.gov.tw/information?uid=374&pid=12171",
      "announcementDate": "20241031",
      "updatedAt": "2024-10-31T23:38:13",
      "fetchedAt": null
    },
    "cities": [
      {
        "city": "臺北市",
        "work": { "status": "stopped", "period": "allDay", "from": "" },
        "school": { "status": "stopped", "period": "allDay", "from": "" },
        "coverage": "city",
        "subAreas": { "stopped": 0, "total": 0 },
        "rows": [
          {
            "city": "臺北市",
            "scope": "",
            "forDate": "20241031",
            "work": "stop",
            "school": "stop",
            "period": "allDay",
            "from": "",
            "raw": "今天停止上班、停止上課。"
          }
        ]
      }
    ],
    "notes": []
  },
  "timestamp": "2026-10-28T10:12:58.829Z",
  "tool": "check_typhoon_closure"
}
```

#### 回應欄位說明

| 欄位 | 類型 | 描述 |
|------|------|------|
| `summary` | string | 一行結論，含是否定案 |
| `data.date` | string | 查詢日 `YYYYMMDD` |
| `data.city` | string \| null | 正規化後的縣市；未指定為 `null` |
| `data.work` / `data.school` | object | 結論：`status`、`period`（`allDay`／`morning`／`afternoon`／`evening`／`from`）、`from`（`HH:MM`） |
| `data.basis` | string | `own` 當日公告；`forecast` 前一天公告的預告（可能被推翻）；`no_announcement` 無公告 |
| `data.reason` | string \| null | 結果為何仍可能改變；`null` 表示已定案 |
| `data.source` | object | `kind`（`archive`／`live`）、公告網址、公告事件日、更新時間、即時頁抓取時間 |
| `data.cities[]` | array | 各縣市的結論；`rows` 為原始記錄，`raw` 保留原文 |
| `data.notes` | string[] | 給使用者與 LLM 的提醒 |

`status` 的意義：

| `status` | 意義 |
|----------|------|
| `stopped` | 全縣市停止，時段見 `period`／`from` |
| `conditional` | 只有部分子區域、學制或時段停止，須看 `cities[].rows` 判斷是否適用；未指定縣市時只要有任何停止就是這個值 |
| `normal` | 有公告且照常；即時頁目前沒有該縣市的公告（`reason: "live"`，之後仍可能公告）；或事件後超過 21 天仍無公告（`basis: "no_announcement"`） |
| `unknown` | 無法判斷，**不可當成照常**。例如記錄無法解析、歸檔尚未收錄、即時頁還沒有明天的公告 |

`reason` 的意義：`live`（即時頁，當天仍可能更新）、`pending`（距今 21 天內，歸檔可能尚未收錄；昨天到 21 天前常見）、`source_not_ready`（當年度資料檔尚未產生）。

#### 錯誤

| `errorType` | 情況 |
|-------------|------|
| `INVALID_DATE` | 日期格式錯誤或早於 2001-07-30 |
| `NETWORK_ERROR` | 無法連線資料來源 |
| `DATA_NOT_FOUND` | 歷史年度資料不存在 |

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

- **API 版本**: 2.1.0
- **MCP 協議版本**: 1.0
- **發布日期**: 2026-10-16

### 變更歷史

完整內容見 [CHANGELOG.md](../CHANGELOG.md)。

#### 未發布
- 新增 `check_typhoon_closure` 颱風假查詢工具
- Node.js 需求改為 ≥ 22.0.0（Node 18、20 皆已 EOL）

#### v2.1.0 (2026-10-16)
- 新增 `get_next_holidays`、`get_workdays` 工具
- stdio 日誌改走 stderr，stdout 只留 JSON-RPC

#### v2.0.0 (2026-08-02)
- 年份支援改為 runtime 探測，上限由上游資料決定
- `get_holiday_stats` 的 `nationalHolidays` 只計具名國定假日，週末移到新欄位 `weekends`（破壞性變更）

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

**最後更新**: 2026-10-28  
**維護者**: Taiwan Holiday MCP Team 