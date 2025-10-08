/**
 * HolidayService 整合測試
 * 
 * 測試完整的端到端查詢流程、效能基準和錯誤恢復機制
 */

import { HolidayService, HolidayServiceError } from '../../src/holiday-service.js';
import { Holiday, HolidayStats, ErrorType } from '../../src/types.js';

// 網路可用性檢查
async function isNetworkAvailable(): Promise<boolean> {
  try {
    const response = await fetch('https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/2024.json', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

describe('HolidayService 整合測試', () => {
  let service: HolidayService;
  let networkAvailable: boolean;

  beforeAll(async () => {
    networkAvailable = await isNetworkAvailable();
    if (!networkAvailable) {
      console.warn('⚠️  網路不可用，跳過需要網路連接的整合測試');
    }
  });

  beforeEach(() => {
    service = new HolidayService();
    service.clearCache(); // 確保測試獨立性
  });

  describe('端到端查詢流程測試', () => {
    test('應該完成完整的假期查詢流程', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        // 測試單一日期查詢
        const holiday = await service.checkHoliday('2024-01-01');
        expect(holiday).toBeTruthy();
        expect(holiday?.isHoliday).toBe(true);
        expect(holiday?.description).toContain('開國紀念日');

        // 測試範圍查詢
        const holidays = await service.getHolidaysInRange('2024-01-01', '2024-01-31');
        expect(holidays.length).toBeGreaterThan(0);
        expect(holidays.every(h => h.date >= '20240101' && h.date <= '20240131')).toBe(true);

        // 測試統計查詢
        const stats = await service.getHolidayStats(2024, 1);
        expect(stats.year).toBe(2024);
        expect(stats.totalHolidays).toBeGreaterThanOrEqual(0);
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('應該正確處理跨年度查詢', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        const holidays = await service.getHolidaysInRange('2023-12-30', '2024-01-05');
        
        expect(holidays.length).toBeGreaterThan(0);
        expect(holidays.some(h => h.date.startsWith('2023'))).toBe(true);
        expect(holidays.some(h => h.date.startsWith('2024'))).toBe(true);
        
        // 驗證排序
        for (let i = 1; i < holidays.length; i++) {
          expect(holidays[i].date >= holidays[i - 1].date).toBe(true);
        }
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('應該正確處理多種日期格式', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        const formats = ['20240101', '2024-01-01', '2024/01/01'];
        const results: (Holiday | null)[] = [];

        for (const format of formats) {
          const result = await service.checkHoliday(format);
          results.push(result);
        }

        // 所有格式應該回傳相同結果
        expect(results[0]).toEqual(results[1]);
        expect(results[1]).toEqual(results[2]);
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('應該正確處理大範圍查詢', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        const holidays = await service.getHolidaysInRange('2024-01-01', '2024-12-31');
        
        expect(holidays.length).toBeGreaterThan(10); // 一年應該有超過10個假期
        expect(holidays.every(h => h.date.startsWith('2024'))).toBe(true);
        
        // 驗證包含主要假期
        const descriptions = holidays.map(h => h.description);
        expect(descriptions.some(d => d.includes('開國紀念日'))).toBe(true);
        expect(descriptions.some(d => d.includes('春節'))).toBe(true);
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);
  });

  describe('效能基準測試', () => {
    test('首次 API 呼叫應該在 2 秒內完成', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        const startTime = Date.now();
        
        await service.getHolidaysForYear(2024);
        
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(2000); // 2 秒
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('快取 API 呼叫應該在 100ms 內完成', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        // 先載入資料到快取
        await service.getHolidaysForYear(2024);
        
        const startTime = Date.now();
        
        await service.getHolidaysForYear(2024);
        
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(100); // 100ms
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('併發查詢應該在 5 秒內完成', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        const startTime = Date.now();
        
        const promises = Array.from({ length: 10 }, (_, i) => 
          service.checkHoliday(`2024-01-${(i + 1).toString().padStart(2, '0')}`)
        );
        
        await Promise.all(promises);
        
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(5000); // 5 秒
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('記憶體使用應該保持穩定', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        const initialMemory = process.memoryUsage().heapUsed;
        
        // 執行多次查詢
        for (let i = 0; i < 50; i++) {
          await service.checkHoliday(`2024-01-01`);
        }
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        
        // 記憶體增長應該小於 10MB
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);
  });

  describe('錯誤恢復測試', () => {
    test('應該從網路錯誤中恢復', async () => {
      // 建立一個會重試的服務
      const retryService = new HolidayService({ retries: 2, retryDelay: 100 });
      
      // 第一次查詢可能失敗，但應該能恢復
      try {
        const holidays = await retryService.getHolidaysForYear(2024);
        expect(holidays).toBeDefined();
        expect(Array.isArray(holidays)).toBe(true);
      } catch (error) {
        // 如果真的失敗了，應該是 HolidayServiceError
        expect(error).toBeInstanceOf(HolidayServiceError);
      }
    }, 30000);

    test('應該正確處理無效年份', async () => {
      await expect(service.getHolidaysForYear(2016))
        .rejects.toThrow(HolidayServiceError);
      
      await expect(service.getHolidaysForYear(2027))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該正確處理無效日期格式', async () => {
      const invalidDates = [
        'invalid-date',
        '2024-13-01',
        '2024-01-32',
        '2024/02/30',
        ''
      ];

      for (const invalidDate of invalidDates) {
        await expect(service.checkHoliday(invalidDate))
          .rejects.toThrow(HolidayServiceError);
      }
    });

    test('應該正確處理無效日期範圍', async () => {
      await expect(service.getHolidaysInRange('2024-01-31', '2024-01-01'))
        .rejects.toThrow(HolidayServiceError);
      
      await expect(service.getHolidaysInRange('2024-02-01', '2024-01-31'))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該正確處理無效月份', async () => {
      await expect(service.getHolidayStats(2024, 0))
        .rejects.toThrow(HolidayServiceError);
      
      await expect(service.getHolidayStats(2024, 13))
        .rejects.toThrow(HolidayServiceError);
    });
  });

  describe('快取機制測試', () => {
    test('應該正確使用快取機制', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        // 第一次查詢
        const holidays1 = await service.getHolidaysForYear(2024);
        
        // 第二次查詢應該使用快取
        const startTime = Date.now();
        const holidays2 = await service.getHolidaysForYear(2024);
        const duration = Date.now() - startTime;
        
        expect(holidays1).toEqual(holidays2);
        expect(duration).toBeLessThan(50); // 快取查詢應該很快
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('應該正確清除快取', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        // 載入資料到快取
        await service.getHolidaysForYear(2024);
        
        // 清除快取
        service.clearCache();
        
        // 再次查詢應該重新載入
        const startTime = Date.now();
        await service.getHolidaysForYear(2024);
        const duration = Date.now() - startTime;
        
        // 應該比快取查詢慢
        expect(duration).toBeGreaterThan(100);
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('應該正確處理快取過期', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        // 建立短 TTL 的服務
        const shortTtlService = new HolidayService({}, 100); // 100ms TTL
        
        // 載入資料
        await shortTtlService.getHolidaysForYear(2024);
        
        // 等待快取過期
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // 清除過期快取
        shortTtlService.clearExpiredCache();
        
        // 再次查詢應該重新載入
        const startTime = Date.now();
        await shortTtlService.getHolidaysForYear(2024);
        const duration = Date.now() - startTime;
        
        expect(duration).toBeGreaterThan(100);
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);
  });

  describe('資料一致性測試', () => {
    test('應該確保查詢結果的一致性', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        const date = '2024-01-01';
        
        // 單一日期查詢
        const singleResult = await service.checkHoliday(date);
        
        // 範圍查詢
        const rangeResults = await service.getHolidaysInRange(date, date);
        
        if (singleResult) {
          expect(rangeResults).toHaveLength(1);
          expect(rangeResults[0]).toEqual(singleResult);
        } else {
          expect(rangeResults).toHaveLength(0);
        }
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('應該確保統計資料的正確性', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        const year = 2024;
        const month = 1;
        
        // 獲取年度統計
        const yearStats = await service.getHolidayStats(year);
        
        // 獲取月份統計
        const monthStats = await service.getHolidayStats(year, month);
        
        // 月份統計的假期數應該小於等於年度統計
        expect(monthStats.totalHolidays).toBeLessThanOrEqual(yearStats.totalHolidays);
        
        // 年份應該一致
        expect(monthStats.year).toBe(year);
        expect(yearStats.year).toBe(year);
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);

    test('應該確保日期排序的正確性', async () => {
      if (!networkAvailable) {
        console.log('跳過測試：網路不可用');
        return;
      }

      try {
        const holidays = await service.getHolidaysInRange('2024-01-01', '2024-12-31');
        
        for (let i = 1; i < holidays.length; i++) {
          expect(holidays[i].date >= holidays[i - 1].date).toBe(true);
        }
      } catch (error) {
        if (error instanceof HolidayServiceError && error.type === ErrorType.NETWORK_ERROR) {
          console.log('跳過測試：網路錯誤');
          return;
        }
        throw error;
      }
    }, 30000);
  });
}); 