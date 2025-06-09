# 階段 2：資料服務層實作 + 中期 Cursor 驗證 - 驗證標準

## 概述

本階段實作假期資料服務層、核心查詢方法，並進行中期 Cursor 驗證，確保實際假期查詢功能正常運作。

## Task 2.1: 假期資料服務與單元測試 - 測試驗證

### HolidayService 單元測試

```typescript
// tests/unit/holiday-service.test.ts
import { HolidayService } from '../../src/holiday-service';
import nock from 'nock';
import holidayData from '../fixtures/taiwan-holidays-2024.json';

describe('HolidayService', () => {
  let service: HolidayService;

  beforeEach(() => {
    service = new HolidayService();
    nock.cleanAll();
  });

  describe('getYearData', () => {
    test('應成功獲取年度資料', async () => {
      nock('https://cdn.jsdelivr.net')
        .get('/gh/ruyut/TaiwanCalendar/data/2024.json')
        .reply(200, holidayData);

      const data = await service.getYearData(2024);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('date');
      expect(data[0]).toHaveProperty('isHoliday');
    });

    test('應處理網路錯誤', async () => {
      nock('https://cdn.jsdelivr.net')
        .get('/gh/ruyut/TaiwanCalendar/data/2024.json')
        .replyWithError('Network error');

      await expect(service.getYearData(2024))
        .rejects.toThrow('Failed to fetch holiday data');
    });

    test('應使用快取機制', async () => {
      nock('https://cdn.jsdelivr.net')
        .get('/gh/ruyut/TaiwanCalendar/data/2024.json')
        .once()
        .reply(200, holidayData);

      // 第一次請求
      await service.getYearData(2024);
      // 第二次請求應使用快取
      const data = await service.getYearData(2024);
      expect(data).toBeDefined();
    });
  });

  describe('快取機制測試', () => {
    test('快取應在 TTL 後過期', async () => {
      // 測試快取過期邏輯
    });
  });
});
```

### 日期解析器測試

```typescript
// tests/unit/date-parser.test.ts
import { parseDateString, validateDateFormat } from '../../src/utils/date-parser';

describe('DateParser', () => {
  test('應正確解析 YYYY-MM-DD 格式', () => {
    expect(parseDateString('2024-01-01')).toBe('20240101');
    expect(parseDateString('2024-12-31')).toBe('20241231');
  });

  test('應正確解析 YYYYMMDD 格式', () => {
    expect(parseDateString('20240101')).toBe('20240101');
  });

  test('應拒絕無效日期格式', () => {
    expect(() => parseDateString('2024/01/01')).toThrow('Invalid date format');
    expect(() => parseDateString('01-01-2024')).toThrow('Invalid date format');
  });

  test('應驗證日期邏輯正確性', () => {
    expect(() => parseDateString('2024-02-30')).toThrow('Invalid date');
    expect(() => parseDateString('2024-13-01')).toThrow('Invalid date');
  });
});
```

### 驗證標準

- [ ] HolidayService 類別正確實作
- [ ] CDN 資料獲取功能正常
- [ ] 錯誤處理機制完善
- [ ] 快取機制正常運作
- [ ] 日期解析功能正確
- [ ] 測試資料和模擬設定完成

## Task 2.2: 核心查詢方法與整合測試 - 測試驗證

### 查詢方法測試

```typescript
// tests/unit/holiday-service-methods.test.ts
describe('HolidayService 查詢方法', () => {
  let service: HolidayService;

  beforeEach(async () => {
    service = new HolidayService();
    // 預載測試資料
    nock('https://cdn.jsdelivr.net')
      .get('/gh/ruyut/TaiwanCalendar/data/2024.json')
      .reply(200, require('../fixtures/taiwan-holidays-2024.json'));
  });

  describe('checkHoliday', () => {
    test('應正確識別假期', async () => {
      const holiday = await service.checkHoliday("2024-01-01");
      expect(holiday.isHoliday).toBe(true);
      expect(holiday.description).toBe("開國紀念日");
      expect(holiday.date).toBe("20240101");
    });

    test('應正確識別工作日', async () => {
      const workday = await service.checkHoliday("2024-01-02");
      expect(workday.isHoliday).toBe(false);
      expect(workday.description).toBe("一般工作日");
    });

    test('應處理不同日期格式', async () => {
      const holiday1 = await service.checkHoliday("2024-01-01");
      const holiday2 = await service.checkHoliday("20240101");
      expect(holiday1).toEqual(holiday2);
    });

    test('應拒絕無效日期', async () => {
      await expect(service.checkHoliday("invalid-date"))
        .rejects.toThrow('Invalid date format');
    });
  });

  describe('getHolidaysInRange', () => {
    test('應返回範圍內的假期', async () => {
      const holidays = await service.getHolidaysInRange("2024-01-01", "2024-01-31");
      expect(holidays.length).toBeGreaterThan(0);
      expect(holidays.every(h => h.isHoliday)).toBe(true);
      expect(holidays[0].date >= "20240101").toBe(true);
      expect(holidays[holidays.length - 1].date <= "20240131").toBe(true);
    });

    test('應處理跨年度查詢', async () => {
      // 模擬 2023 年資料
      nock('https://cdn.jsdelivr.net')
        .get('/gh/ruyut/TaiwanCalendar/data/2023.json')
        .reply(200, require('../fixtures/taiwan-holidays-2023.json'));

      const holidays = await service.getHolidaysInRange("2023-12-30", "2024-01-02");
      expect(holidays.length).toBeGreaterThan(0);
    });

    test('應按日期排序結果', async () => {
      const holidays = await service.getHolidaysInRange("2024-01-01", "2024-12-31");
      for (let i = 1; i < holidays.length; i++) {
        expect(holidays[i].date >= holidays[i-1].date).toBe(true);
      }
    });

    test('應驗證日期範圍邏輯', async () => {
      await expect(service.getHolidaysInRange("2024-01-31", "2024-01-01"))
        .rejects.toThrow('End date must be after start date');
    });
  });

  describe('getHolidayStats', () => {
    test('應返回年度統計', async () => {
      const stats = await service.getHolidayStats(2024);
      expect(stats.year).toBe(2024);
      expect(stats.totalHolidays).toBeGreaterThan(0);
      expect(Array.isArray(stats.holidays)).toBe(true);
    });

    test('應返回月份統計', async () => {
      const stats = await service.getHolidayStats(2024, 1);
      expect(stats.year).toBe(2024);
      expect(stats.month).toBe(1);
      expect(stats.holidays.every(h => h.date.startsWith('202401'))).toBe(true);
    });

    test('應處理無假期的月份', async () => {
      // 假設某月無假期
      const stats = await service.getHolidayStats(2024, 6);
      expect(stats.totalHolidays).toBeGreaterThanOrEqual(0);
    });
  });
});
```

### 整合測試

```typescript
// tests/integration/holiday-service.integration.test.ts
describe('HolidayService 整合測試', () => {
  test('應在真實網路環境下運作', async () => {
    const service = new HolidayService();
    const holiday = await service.checkHoliday("2024-01-01");
    expect(holiday).toBeDefined();
  }, 10000); // 10秒超時

  test('效能基準測試', async () => {
    const service = new HolidayService();
    const startTime = Date.now();
    
    await service.checkHoliday("2024-01-01");
    const firstCallTime = Date.now() - startTime;
    
    const cacheStartTime = Date.now();
    await service.checkHoliday("2024-01-02"); // 使用快取
    const cacheCallTime = Date.now() - cacheStartTime;
    
    expect(firstCallTime).toBeLessThan(2000); // 首次呼叫 < 2秒
    expect(cacheCallTime).toBeLessThan(100);  // 快取呼叫 < 100ms
  });
});
```

### 驗證標準

- [ ] checkHoliday 方法正確實作
- [ ] getHolidaysInRange 方法正確實作
- [ ] getHolidayStats 方法正確實作
- [ ] 日期格式轉換正確
- [ ] 跨年度資料處理正常
- [ ] 效能符合基準要求

## Task 2.3: 中期 Cursor 驗證點

### 🎯 Cursor 整合測試

```bash
# 重新建置（包含新功能）
npm run build

# 在 Cursor 中測試實際功能
# 1. 重啟 Cursor
# 2. 測試假期查詢：在 Cursor 中詢問 "2024年1月1日是假期嗎？"
# 3. 測試範圍查詢：在 Cursor 中詢問 "2024年1月有哪些假期？"
# 4. 測試錯誤處理：在 Cursor 中詢問 "無效日期是假期嗎？"
```

### ✅ 中期驗證成功標準

- [ ] **T2.3.V1** Cursor 可以成功查詢單一日期假期狀態
- [ ] **T2.3.V2** Cursor 可以查詢日期範圍內的假期
- [ ] **T2.3.V3** 錯誤處理正常運作（無效日期、網路錯誤等）
- [ ] **T2.3.V4** 回應時間合理（首次查詢 <3秒，快取查詢 <500ms）
- [ ] **T2.3.V5** 沒有 JSON-RPC 協議錯誤或記憶體洩漏

## 階段 2 整體驗證清單

### 技術驗證

- [ ] 假期資料服務正確實作
- [ ] 所有查詢方法功能正常
- [ ] 錯誤處理機制完善
- [ ] 快取機制正常運作
- [ ] 效能符合基準要求

### Cursor 整合驗證

- [ ] 實際假期查詢功能正常
- [ ] 範圍查詢功能正常
- [ ] 錯誤處理在 Cursor 中正常顯示
- [ ] 回應時間符合用戶體驗要求
- [ ] 無協議錯誤或穩定性問題

### 品質標準

- [ ] 單元測試覆蓋率 > 85%
- [ ] 整合測試通過
- [ ] 效能基準達標
- [ ] 記憶體使用合理

## 故障排除指南

### 常見問題

1. **網路請求失敗**
   - 檢查 CDN 可用性
   - 確認重試機制運作
   - 檢查網路連接

2. **快取機制異常**
   - 檢查 TTL 設定
   - 確認記憶體使用
   - 驗證快取邏輯

3. **日期解析錯誤**
   - 檢查日期格式驗證
   - 確認正規表達式正確
   - 測試邊界情況

4. **Cursor 查詢無回應**
   - 檢查 MCP 工具註冊
   - 確認參數傳遞正確
   - 查看錯誤日誌

### 效能最佳化

- [ ] 實作適當的快取策略
- [ ] 最佳化網路請求
- [ ] 減少記憶體使用
- [ ] 改善錯誤處理效率 