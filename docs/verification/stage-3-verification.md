# 階段 3：MCP 工具實作 - 驗證標準

## 概述

本階段實作完整的 MCP 工具定義，包含三個核心工具的完整測試套件，並進行完整功能的 Cursor 驗證。

## Task 3.1: MCP 工具定義與完整測試 - 測試驗證

### check_holiday 工具測試

```typescript
// tests/unit/tools/check-holiday.test.ts
import { handleCheckHoliday } from '../../../src/tools/check-holiday';
import { HolidayService } from '../../../src/holiday-service';

jest.mock('../../../src/holiday-service');

describe('check_holiday 工具', () => {
  let mockHolidayService: jest.Mocked<HolidayService>;

  beforeEach(() => {
    mockHolidayService = new HolidayService() as jest.Mocked<HolidayService>;
    (HolidayService as jest.Mock).mockImplementation(() => mockHolidayService);
  });

  test('應正確處理有效日期參數', async () => {
    const mockHoliday = {
      date: "20240101",
      week: "一",
      isHoliday: true,
      description: "開國紀念日"
    };
    mockHolidayService.checkHoliday.mockResolvedValue(mockHoliday);

    const result = await handleCheckHoliday({ date: "2024-01-01" });
    
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    
    const data = JSON.parse(result.content[0].text);
    expect(data.isHoliday).toBe(true);
    expect(data.description).toBe("開國紀念日");
    expect(data.formatted_date).toBe("2024-01-01");
  });

  test('應拒絕無效參數', async () => {
    await expect(handleCheckHoliday({}))
      .rejects.toThrow('Missing required parameter: date');
    
    await expect(handleCheckHoliday({ date: "invalid" }))
      .rejects.toThrow('Invalid date format');
  });

  test('應處理服務層錯誤', async () => {
    mockHolidayService.checkHoliday.mockRejectedValue(new Error('Network error'));
    
    await expect(handleCheckHoliday({ date: "2024-01-01" }))
      .rejects.toThrow('Failed to check holiday');
  });

  test('應記錄操作日誌', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    mockHolidayService.checkHoliday.mockResolvedValue({
      date: "20240101", week: "一", isHoliday: true, description: "開國紀念日"
    });

    await handleCheckHoliday({ date: "2024-01-01" });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('check_holiday called with date: 2024-01-01')
    );
    
    consoleSpy.mockRestore();
  });
});
```

### get_holidays_in_range 工具測試

```typescript
// tests/unit/tools/get-holidays-in-range.test.ts
describe('get_holidays_in_range 工具', () => {
  test('應正確處理日期範圍查詢', async () => {
    const mockHolidays = [
      { date: "20240101", week: "一", isHoliday: true, description: "開國紀念日" },
      { date: "20240110", week: "三", isHoliday: true, description: "調整放假" }
    ];
    mockHolidayService.getHolidaysInRange.mockResolvedValue(mockHolidays);

    const result = await handleGetHolidaysInRange({
      start_date: "2024-01-01",
      end_date: "2024-01-31"
    });

    expect(result.content[0].type).toBe("text");
    const data = JSON.parse(result.content[0].text);
    expect(data.total_holidays).toBe(2);
    expect(data.holidays).toHaveLength(2);
  });

  test('應驗證日期範圍邏輯', async () => {
    await expect(handleGetHolidaysInRange({
      start_date: "2024-01-31",
      end_date: "2024-01-01"
    })).rejects.toThrow('End date must be after start date');
  });

  test('應處理大量資料', async () => {
    // 模擬一年的資料
    const mockHolidays = Array.from({ length: 115 }, (_, i) => ({
      date: `2024${String(Math.floor(i/31) + 1).padStart(2, '0')}${String(i%31 + 1).padStart(2, '0')}`,
      week: "日",
      isHoliday: true,
      description: "假期"
    }));
    
    mockHolidayService.getHolidaysInRange.mockResolvedValue(mockHolidays);

    const startTime = Date.now();
    const result = await handleGetHolidaysInRange({
      start_date: "2024-01-01",
      end_date: "2024-12-31"
    });
    const processingTime = Date.now() - startTime;

    expect(processingTime).toBeLessThan(1000); // 應在 1 秒內完成
    expect(result.content[0].type).toBe("text");
  });
});
```

### get_holiday_stats 工具測試

```typescript
// tests/unit/tools/get-holiday-stats.test.ts
describe('get_holiday_stats 工具', () => {
  test('應返回年度統計', async () => {
    const mockStats = {
      year: 2024,
      totalHolidays: 115,
      holidays: []
    };
    mockHolidayService.getHolidayStats.mockResolvedValue(mockStats);

    const result = await handleGetHolidayStats({ year: 2024 });
    
    const data = JSON.parse(result.content[0].text);
    expect(data.year).toBe(2024);
    expect(data.total_holidays).toBe(115);
    expect(data.holiday_percentage).toBeCloseTo(31.4, 1); // 115/366
  });

  test('應返回月份統計', async () => {
    const mockStats = {
      year: 2024,
      month: 1,
      totalHolidays: 15,
      holidays: []
    };
    mockHolidayService.getHolidayStats.mockResolvedValue(mockStats);

    const result = await handleGetHolidayStats({ year: 2024, month: 1 });
    
    const data = JSON.parse(result.content[0].text);
    expect(data.month).toBe(1);
    expect(data.total_holidays).toBe(15);
  });

  test('應驗證年份範圍', async () => {
    await expect(handleGetHolidayStats({ year: 2019 }))
      .rejects.toThrow('Year must be between 2020 and 2030');
    
    await expect(handleGetHolidayStats({ year: 2031 }))
      .rejects.toThrow('Year must be between 2020 and 2030');
  });

  test('應驗證月份範圍', async () => {
    await expect(handleGetHolidayStats({ year: 2024, month: 0 }))
      .rejects.toThrow('Month must be between 1 and 12');
    
    await expect(handleGetHolidayStats({ year: 2024, month: 13 }))
      .rejects.toThrow('Month must be between 1 and 12');
  });
});
```

### MCP 工具整合測試

```typescript
// tests/integration/mcp-tools.integration.test.ts
describe('MCP 工具整合測試', () => {
  test('所有工具應在真實環境下運作', async () => {
    // 測試 check_holiday
    const holidayResult = await handleCheckHoliday({ date: "2024-01-01" });
    expect(holidayResult.content[0].type).toBe("text");

    // 測試 get_holidays_in_range
    const rangeResult = await handleGetHolidaysInRange({
      start_date: "2024-01-01",
      end_date: "2024-01-07"
    });
    expect(rangeResult.content[0].type).toBe("text");

    // 測試 get_holiday_stats
    const statsResult = await handleGetHolidayStats({ year: 2024 });
    expect(statsResult.content[0].type).toBe("text");
  }, 15000);
});
```

### 驗證標準

- [ ] check_holiday 工具正確實作
- [ ] get_holidays_in_range 工具正確實作
- [ ] get_holiday_stats 工具正確實作
- [ ] 參數驗證機制完善
- [ ] 錯誤處理正確
- [ ] 效能符合要求
- [ ] 日誌記錄正常

## Task 3.2: 完整功能 Cursor 驗證點

### 🎯 Cursor 完整功能測試

```bash
# 重新建置（包含所有功能）
npm run build

# 在 Cursor 中測試所有功能
# 1. 重啟 Cursor
# 2. 測試所有工具：
#    - "2024年1月1日是假期嗎？"
#    - "2024年春節期間有哪些假期？"
#    - "2024年總共有多少個假期？"
#    - "2024年2月的假期統計"
# 3. 測試錯誤處理：
#    - "2025年1月1日是假期嗎？"（未來年份）
#    - "無效日期是假期嗎？"
# 4. 測試效能：連續查詢多個日期
```

### ✅ 完整功能驗證成功標準

- [ ] **T3.2.V1** 所有三個工具都能正常運作
- [ ] **T3.2.V2** 錯誤處理完善，提供有意義的錯誤訊息
- [ ] **T3.2.V3** 效能符合預期（快取機制正常）
- [ ] **T3.2.V4** 沒有記憶體洩漏或協議錯誤
- [ ] **T3.2.V5** 用戶體驗良好，回應格式清晰易讀

## 階段 3 整體驗證清單

### 技術驗證

- [ ] 所有 MCP 工具正確實作
- [ ] 參數驗證機制完善
- [ ] 回傳格式標準化
- [ ] 錯誤處理機制完整
- [ ] 效能最佳化完成
- [ ] 日誌記錄系統正常

### Cursor 整合驗證

- [ ] 所有工具在 Cursor 中正常運作
- [ ] 用戶查詢得到正確回應
- [ ] 錯誤訊息清楚易懂
- [ ] 回應時間符合用戶體驗
- [ ] 無協議錯誤或穩定性問題

### 品質標準

- [ ] 單元測試覆蓋率 > 90%
- [ ] 整合測試通過
- [ ] 效能基準達標
- [ ] 記憶體使用最佳化
- [ ] 錯誤處理覆蓋率 > 85%

## 工具功能驗證矩陣

| 工具 | 基本功能 | 參數驗證 | 錯誤處理 | 效能 | Cursor 整合 |
|------|----------|----------|----------|------|-------------|
| check_holiday | ✅ | ✅ | ✅ | ✅ | ✅ |
| get_holidays_in_range | ✅ | ✅ | ✅ | ✅ | ✅ |
| get_holiday_stats | ✅ | ✅ | ✅ | ✅ | ✅ |

## 故障排除指南

### 常見問題

1. **工具無法在 Cursor 中顯示**
   - 檢查 MCP 伺服器註冊
   - 確認工具定義格式正確
   - 重啟 Cursor 應用程式

2. **參數驗證失敗**
   - 檢查 JSON Schema 定義
   - 確認參數型別正確
   - 驗證必要參數完整

3. **回應格式錯誤**
   - 檢查 MCP 回應格式
   - 確認 JSON 序列化正確
   - 驗證內容型別設定

4. **效能問題**
   - 檢查快取機制
   - 最佳化資料處理
   - 減少不必要的計算

### 效能基準

- [ ] 單一查詢 < 500ms（快取）
- [ ] 範圍查詢 < 2s（100個假期）
- [ ] 統計查詢 < 1s（年度資料）
- [ ] 記憶體使用 < 50MB
- [ ] 併發 5 個請求 < 3s

### 最佳化建議

1. **快取策略**
   - 實作多層快取
   - 設定適當的 TTL
   - 監控快取命中率

2. **錯誤處理**
   - 提供詳細錯誤訊息
   - 實作重試機制
   - 記錄錯誤統計

3. **用戶體驗**
   - 格式化回應內容
   - 提供使用範例
   - 改善錯誤提示 