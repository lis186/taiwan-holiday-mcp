/**
 * HolidayService 單元測試
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { HolidayService, HolidayServiceError } from '../../src/holiday-service.js';
import { Holiday, ErrorType } from '../../src/types.js';

// 載入測試資料
const testHolidays: Holiday[] = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/taiwan-holidays-2024.json'), 'utf-8')
);

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('HolidayService', () => {
  let service: HolidayService;

  beforeEach(() => {
    service = new HolidayService();
    service.clearCache(); // 清除快取確保測試獨立性
    mockFetch.mockClear();
  });

  afterEach(() => {
    // 清理定時器和資源
    if (service && typeof service.destroy === 'function') {
      service.destroy();
    }
  });

  describe('建構子', () => {
    test('應該使用預設選項建立服務', () => {
      const defaultService = new HolidayService();
      expect(defaultService).toBeInstanceOf(HolidayService);
      defaultService.destroy();
    });

    test('應該接受自訂選項', () => {
      const customService = new HolidayService(
        { timeout: 5000, retries: 1 },
        30 * 60 * 1000 // 30分鐘快取
      );
      expect(customService).toBeInstanceOf(HolidayService);
      customService.destroy();
    });
  });

  describe('getHolidaysForYear', () => {
    test('應該成功獲取假期資料', async () => {
      // 模擬成功的 HTTP 回應
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => testHolidays
      });

      const holidays = await service.getHolidaysForYear(2024);
      
      expect(holidays).toHaveLength(testHolidays.length);
      expect(holidays[0]).toMatchObject({
        date: '20240101',
        week: '一',
        isHoliday: true,
        description: '開國紀念日'
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/2024.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'taiwan-holiday-mcp/1.0.0'
          })
        })
      );
    });

    test('應該使用快取避免重複請求', async () => {
      // 第一次請求
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => testHolidays
      });

      const holidays1 = await service.getHolidaysForYear(2024);
      
      // 第二次請求應該使用快取，不會發送 HTTP 請求
      const holidays2 = await service.getHolidaysForYear(2024);
      
      expect(holidays1).toEqual(holidays2);
      expect(mockFetch).toHaveBeenCalledTimes(1); // 確認只發送了一次請求
    });

    test('應該拒絕超出支援範圍的年份', async () => {
      await expect(service.getHolidaysForYear(2016))
        .rejects.toThrow(HolidayServiceError);
      
      await expect(service.getHolidaysForYear(2027))
        .rejects.toThrow(HolidayServiceError);
      
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('應該處理 HTTP 錯誤', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(service.getHolidaysForYear(2024))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該處理網路錯誤', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(service.getHolidaysForYear(2024))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該處理無效的 JSON 回應', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(service.getHolidaysForYear(2024))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該處理非陣列的回應', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'not an array' })
      });

      await expect(service.getHolidaysForYear(2024))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該驗證假期資料格式', async () => {
      const invalidData = [
        {
          date: 'invalid',
          week: '一',
          isHoliday: true,
          description: '測試'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidData
      });

      await expect(service.getHolidaysForYear(2024))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該在重試後成功', async () => {
      // 第一次失敗，第二次成功
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Server Error'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => testHolidays
        });

      const holidays = await service.getHolidaysForYear(2024);
      expect(holidays).toHaveLength(testHolidays.length);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkHoliday', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => testHolidays
      });
    });

    test('應該正確檢查假日', async () => {
      const holiday = await service.checkHoliday('20240101');
      
      expect(holiday).toMatchObject({
        date: '20240101',
        week: '一',
        isHoliday: true,
        description: '開國紀念日'
      });
    });

    test('應該正確檢查非假日', async () => {
      const holiday = await service.checkHoliday('20240102');
      
      expect(holiday).toMatchObject({
        date: '20240102',
        week: '二',
        isHoliday: false,
        description: ''
      });
    });

    test('應該在日期不存在時回傳 null', async () => {
      const holiday = await service.checkHoliday('20241225');
      expect(holiday).toBeNull();
    });

    test('應該支援不同的日期格式', async () => {
      const holiday1 = await service.checkHoliday('2024-01-01');
      const holiday2 = await service.checkHoliday('2024/01/01');
      
      expect(holiday1).toEqual(holiday2);
      expect(holiday1?.date).toBe('20240101');
    });

    test('應該處理無效的日期格式', async () => {
      await expect(service.checkHoliday('invalid-date'))
        .rejects.toThrow(HolidayServiceError);
    });
  });

  describe('getHolidaysInRange', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => testHolidays
      });
    });

    test('應該獲取日期範圍內的假期', async () => {
      const holidays = await service.getHolidaysInRange('20240101', '20240131');
      
      expect(holidays.length).toBeGreaterThan(0);
      expect(holidays.every(h => h.date >= '20240101' && h.date <= '20240131')).toBe(true);
    });

    test('應該按日期排序結果', async () => {
      const holidays = await service.getHolidaysInRange('20240101', '20240331');
      
      for (let i = 1; i < holidays.length; i++) {
        expect(holidays[i].date >= holidays[i - 1].date).toBe(true);
      }
    });

    test('應該處理跨年度查詢', async () => {
      // 需要模擬 2023 和 2024 年的資料
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { date: '20231231', week: '日', isHoliday: false, description: '' }
          ]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => testHolidays
        });

      const holidays = await service.getHolidaysInRange('20231231', '20240102');
      
      expect(holidays.length).toBeGreaterThan(0);
      expect(holidays.some(h => h.date.startsWith('2023'))).toBe(true);
      expect(holidays.some(h => h.date.startsWith('2024'))).toBe(true);
    });

    test('應該拒絕無效的日期範圍', async () => {
      await expect(service.getHolidaysInRange('20240201', '20240101'))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該支援不同的日期格式', async () => {
      const holidays1 = await service.getHolidaysInRange('2024-01-01', '2024-01-31');
      const holidays2 = await service.getHolidaysInRange('2024/01/01', '2024/01/31');
      
      expect(holidays1).toEqual(holidays2);
    });
  });

  describe('getHolidayStats', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => testHolidays
      });
    });

    test('應該計算年度假期統計', async () => {
      const stats = await service.getHolidayStats(2024);
      
      expect(stats.year).toBe(2024);
      expect(stats.totalHolidays).toBeGreaterThan(0);
      expect(typeof stats.nationalHolidays).toBe('number');
      expect(typeof stats.compensatoryDays).toBe('number');
      expect(typeof stats.adjustedHolidays).toBe('number');
      expect(typeof stats.workingDays).toBe('number');
      expect(typeof stats.holidayTypes).toBe('object');
    });

    test('應該計算月份假期統計', async () => {
      const stats = await service.getHolidayStats(2024, 1);
      
      expect(stats.year).toBe(2024);
      expect(stats.totalHolidays).toBeGreaterThanOrEqual(0);
    });

    test('應該拒絕無效的月份', async () => {
      await expect(service.getHolidayStats(2024, 0))
        .rejects.toThrow(HolidayServiceError);
      
      await expect(service.getHolidayStats(2024, 13))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該正確分類假期類型', async () => {
      const stats = await service.getHolidayStats(2024);
      
      expect(stats.holidayTypes).toBeDefined();
      expect(Object.keys(stats.holidayTypes).length).toBeGreaterThan(0);
    });
  });

  describe('快取管理', () => {
    test('應該清除所有快取', async () => {
      // 先載入資料到快取
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => testHolidays
      });

      await service.getHolidaysForYear(2024);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // 清除快取
      service.clearCache();
      
      // 再次請求應該重新發送 HTTP 請求
      await service.getHolidaysForYear(2024);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('應該清除過期的快取', async () => {
      // 建立一個短 TTL 的服務
      const shortTtlService = new HolidayService({}, 100); // 100ms TTL
      
      try {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => testHolidays
        });

        await shortTtlService.getHolidaysForYear(2024);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        
        // 等待快取過期
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // 清除過期快取
        shortTtlService.clearExpiredCache();
        
        // 再次請求應該重新發送 HTTP 請求
        await shortTtlService.getHolidaysForYear(2024);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      } finally {
        shortTtlService.destroy();
      }
    });
  });

  describe('錯誤處理', () => {
    test('HolidayServiceError 應該包含正確的錯誤資訊', () => {
      const originalError = new Error('原始錯誤');
      const error = new HolidayServiceError(
        '測試錯誤',
        ErrorType.NETWORK_ERROR,
        originalError
      );
      
      expect(error.message).toBe('測試錯誤');
      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(error.originalError).toBe(originalError);
      expect(error.name).toBe('HolidayServiceError');
    });

    test('應該處理請求超時', async () => {
      const timeoutService = new HolidayService({ timeout: 100, retries: 1 });
      
      try {
        // 模擬所有請求都超時（包括重試）
        const abortError = Object.assign(new Error('The operation was aborted'), {
          name: 'AbortError'
        });
        mockFetch.mockRejectedValue(abortError);

        await expect(timeoutService.getHolidaysForYear(2024))
          .rejects.toThrow(HolidayServiceError);
      } finally {
        timeoutService.destroy();
      }
    });

    test('應該在所有重試失敗後拋出錯誤', async () => {
      const retryService = new HolidayService({ retries: 1, retryDelay: 10 });
      
      try {
        // 模擬所有請求都失敗
        mockFetch.mockRejectedValue(new Error('Server Error'));

        await expect(retryService.getHolidaysForYear(2024))
          .rejects.toThrow('經過 2 次嘗試後仍無法獲取資料');
        
        expect(mockFetch).toHaveBeenCalledTimes(2); // 初始請求 + 1次重試
      } finally {
        retryService.destroy();
      }
    });
  });

  describe('資料驗證', () => {
    test('應該拒絕缺少必要欄位的資料', async () => {
      const invalidData = [
        {
          date: '20240101',
          week: '一',
          // 缺少 isHoliday 和 description
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidData
      });

      await expect(service.getHolidaysForYear(2024))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該拒絕錯誤型別的欄位', async () => {
      const invalidData = [
        {
          date: 20240101, // 應該是字串
          week: '一',
          isHoliday: true,
          description: '測試'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidData
      });

      await expect(service.getHolidaysForYear(2024))
        .rejects.toThrow(HolidayServiceError);
    });

    test('應該拒絕無效的日期格式', async () => {
      const invalidData = [
        {
          date: '2024-01-01', // 應該是 YYYYMMDD 格式
          week: '一',
          isHoliday: true,
          description: '測試'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidData
      });

      await expect(service.getHolidaysForYear(2024))
        .rejects.toThrow(HolidayServiceError);
    });
  });
}); 