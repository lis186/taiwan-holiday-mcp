/**
 * HolidayService 單元測試
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { HolidayService, HolidayServiceError } from '../../src/holiday-service.js';
import { Holiday, ErrorType, getQueryableYearRange, HOLIDAY_TYPES, getCurrentYearInTaipei } from '../../src/types.js';
import { formatDate, getDaysInMonth, getTodayInTaipei } from '../../src/utils/date-parser.js';

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

    test('應該拒絕超出可查詢範圍的年份，且不浪費一次網路請求', async () => {
      const { start, end } = getQueryableYearRange();

      await expect(service.getHolidaysForYear(start - 1))
        .rejects.toThrow(HolidayServiceError);

      await expect(service.getHolidaysForYear(end + 1))
        .rejects.toThrow(HolidayServiceError);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('上游尚未發布該年度時應明確說明，且不重試', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      await expect(service.getHolidaysForYear(getCurrentYearInTaipei() + 1))
        .rejects.toThrow('上游尚未發布');

      // 不重試的來源是 fetchHolidaysFromCdn catch 開頭對 HolidayServiceError 的短路，
      // 不是 ErrorClassifier（它把中文 404 訊息歸為 TEMPORARY，即「可重試」）。
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // 已發布年度的 404 是上游資料異常，不該與「還沒公布」混為一談 ——
    // 混在一起會讓呼叫端把資料遺失當成正常狀況而靜默跳過。
    test('已發布年度的資料消失時應回報上游異常，而非「尚未發布」', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      const pastYear = getCurrentYearInTaipei() - 1;
      await expect(service.getHolidaysForYear(pastYear)).rejects.toMatchObject({
        message: expect.stringContaining('上游缺少'),
        // API_ERROR（而非 INVALID_YEAR）才會被斷路器計入
        type: ErrorType.API_ERROR,
      });
      // 404 是確定性答案，不該重試
      expect(mockFetch).toHaveBeenCalledTimes(1);
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

    // 註：這條只驗存在性，永遠會通過。它是「全綠不等於正確」的實例 ——
    // 下面兩條才真的能抓到計數錯誤。保留它以維持既有覆蓋。
    test('應該正確分類假期類型', async () => {
      const stats = await service.getHolidayStats(2024);

      expect(stats.holidayTypes).toBeDefined();
      expect(Object.keys(stats.holidayTypes).length).toBeGreaterThan(0);
    });

    // holidayTypes 同時裝「分類桶」與「具體假日名」兩種語意。上游的 description
    // 有時剛好等於分類桶名稱（補假、調整放假），曾經被兩邊各加一次而翻倍。
    const collisionFixture: Holiday[] = [
      { date: '20240127', week: '六', isHoliday: true, description: '補假' },
      { date: '20240128', week: '日', isHoliday: true, description: '補假' },
      { date: '20240203', week: '六', isHoliday: true, description: '調整放假' },
      { date: '20240204', week: '日', isHoliday: true, description: '調整放假' },
      { date: '20240205', week: '一', isHoliday: true, description: '調整放假' },
      { date: '20240206', week: '二', isHoliday: true, description: '國定假日' },
      { date: '20240207', week: '三', isHoliday: true, description: '春節調整放假' },
      { date: '20240208', week: '四', isHoliday: true, description: '' },
      { date: '20240215', week: '四', isHoliday: false, description: '補行上班' },
    ];

    test('description 與分類桶同名時不應重複計數', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => collisionFixture });
      service.clearCache();

      const stats = await service.getHolidayStats(2024);

      expect(stats.holidayTypes['補假']).toBe(2); // 舊碼: 4
      expect(stats.holidayTypes['調整放假']).toBe(4); // 舊碼: 7
      expect(stats.holidayTypes['國定假日']).toBe(1); // 舊碼: 3（含被誤算的週末）
      expect(stats.holidayTypes['週末']).toBe(1); // 舊碼: 無此分類

      // 包含但不等於桶名 → 仍應同時進兩個 key（證明沒有過度修正）
      expect(stats.holidayTypes['春節調整放假']).toBe(1);
      expect(stats.holidayTypes['補行上班']).toBe(1);
    });

    // 不變式測試：不枚舉 key，斷言結構。這種寫法在還不知道「調整放假」
    // 也會碰撞時就能抓到它（2019 年補假筆數為 0，只錨定補假的測試抓不到）。
    test('每個分類桶都應等於對應的頂層計數器', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => collisionFixture });
      service.clearCache();

      const stats = await service.getHolidayStats(2024);

      expect(stats.holidayTypes[HOLIDAY_TYPES.COMPENSATORY] ?? 0).toBe(stats.compensatoryDays);
      expect(stats.holidayTypes[HOLIDAY_TYPES.ADJUSTED] ?? 0).toBe(stats.adjustedHolidays);
      expect(stats.holidayTypes[HOLIDAY_TYPES.NATIONAL] ?? 0).toBe(stats.nationalHolidays);
      expect(stats.holidayTypes[HOLIDAY_TYPES.WEEKEND] ?? 0).toBe(stats.weekends);
      expect(stats.holidayTypes[HOLIDAY_TYPES.WORKING] ?? 0).toBe(stats.workingDays);

      // 四個放假分類必須剛好切分所有放假日
      expect(
        stats.compensatoryDays + stats.adjustedHolidays + stats.nationalHolidays + stats.weekends
      ).toBe(stats.totalHolidays);
    });

    // 週末的 description 是空字串，過去落入 else 分支被算成國定假日：
    // 2026 年因此回報 114 個「國定假日」，實際具名的只有 16 個。
    test('一般週末不應被算成具名國定假日', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => collisionFixture });
      service.clearCache();

      const stats = await service.getHolidayStats(2024);

      expect(stats.nationalHolidays).toBe(1); // 舊碼: 2（週末被算進來）
      expect(stats.weekends).toBe(1); // 舊碼: 無此欄位
    });
  });

  // 查詢未發布年度是完全正常的使用情境（例如年末規劃明年行程）。
  // 若它被 Circuit Breaker 計為失敗，連續 5 次就會開啟斷路器 ——
  // 之後連「有資料的有效年份」都會被拒絕，把使用者的正常操作變成服務中斷。
  describe('Circuit Breaker 與未發布年度', () => {
    test('查詢未發布年度不應累積斷路器失敗次數', async () => {
      service.clearCache();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      const futureYear = getCurrentYearInTaipei() + 1;
      const threshold = 5; // failureThreshold
      for (let i = 0; i < threshold; i++) {
        await expect(service.getHolidaysForYear(futureYear)).rejects.toThrow('上游尚未發布');
        service.clearCache(); // 避免命中快取而沒真的走到抓取
      }

      expect(service.getCircuitBreakerStats().failureCount).toBe(0);
    });

    // 「未發布」與「已發布卻消失」必須分開：前者是正常使用情境（不計入斷路器），
    // 後者代表上游壞了 —— 若也被當成預期錯誤，上游整批資料消失時斷路器不會開，
    // 服務會持續對每個請求打一次注定失敗的網路。
    test('歷史年度資料消失應計入斷路器失敗', async () => {
      service.clearCache();
      service.resetCircuitBreaker();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      const pastYear = getCurrentYearInTaipei() - 1;
      await expect(service.getHolidaysForYear(pastYear)).rejects.toThrow('上游缺少');

      expect(service.getCircuitBreakerStats().failureCount).toBeGreaterThan(0);
    });

    test('斷路器不該因未發布年度而拒絕有效年份', async () => {
      service.clearCache();
      const futureYear = getCurrentYearInTaipei() + 1;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);
      for (let i = 0; i < 5; i++) {
        await expect(service.getHolidaysForYear(futureYear)).rejects.toThrow();
        service.clearCache();
      }

      // 換成有效年份且上游正常回應 → 不該被斷路器擋下
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => testHolidays
      } as unknown as Response);

      await expect(service.getHolidaysForYear(2024)).resolves.toBeDefined();
    });
  });

  describe('getAvailableYears', () => {
    const currentYear = getCurrentYearInTaipei();

    test('探測到 404 應正常停止，回傳到最新可用年', async () => {
      service.clearCache();
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 }) // 今年+1 存在
        .mockResolvedValueOnce({ ok: false, status: 404 }); // 今年+2 不存在

      const years = await service.getAvailableYears();

      expect(years[0]).toBe(2017);
      expect(years[years.length - 1]).toBe(currentYear + 1);
    });

    // 只有 404 代表「上游沒有」。網路故障若也被當成 404，
    // 斷網時會安靜回報較短的範圍 —— 看起來完全正常的錯誤答案。
    test('網路故障應拋出，而不是安靜回報較短的範圍', async () => {
      service.clearCache();
      mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'));

      await expect(service.getAvailableYears()).rejects.toThrow();
    });

    test('探測失敗不應污染快取', async () => {
      service.clearCache();
      mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'));
      await expect(service.getAvailableYears()).rejects.toThrow();

      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      const years = await service.getAvailableYears();
      expect(years[years.length - 1]).toBe(currentYear + 1);
    });

    // 只斷言「method 是 HEAD」這個可驗的事實。
    // 不主張節省了多少位元組 —— 那需要實際量測，未做。
    // 也註明：HEAD 不減少往返次數，探測與正式查詢仍是兩次請求。
    test('探測應使用 HEAD，不下載內容', async () => {
      service.clearCache();
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      await service.getAvailableYears();

      const probeCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
        /\/\d{4}\.json$/.test(String(url))
      );
      expect(probeCalls.length).toBeGreaterThan(0);
      probeCalls.forEach(([, init]: [string, RequestInit]) => {
        expect(init?.method).toBe('HEAD'); // 舊碼: undefined（即 GET）
      });
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

  describe('getNextHolidays 與 getWorkdays', () => {
    const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

    function calendar(year: number, month: number, overrides: Record<string, Partial<Holiday>> = {}): Holiday[] {
      const days = getDaysInMonth(year, month);
      const rows: Holiday[] = [];
      for (let day = 1; day <= days; day++) {
        const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
        const date = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
        const weekend = dow === 0 || dow === 6;
        rows.push({
          date,
          week: WEEK[dow],
          isHoliday: weekend,
          description: '',
          ...overrides[date],
        });
      }
      return rows;
    }

    const january = calendar(2024, 1, {
      '20240101': { isHoliday: true, description: '開國紀念日' },
      '20240106': { isHoliday: false, description: '補行上班' },
      '20240110': { isHoliday: true, description: '自訂假日' },
      '20240113': { isHoliday: true, description: '春節' },
    });

    function mockCalendar(data: Holiday[]): void {
      mockFetch.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/2024.json')) {
          return { ok: true, status: 200, json: async () => data };
        }
        return { ok: false, status: 404, statusText: 'Not Found' };
      });
    }

    test('下一個假期不含起算日，空說明顯示為週末', async () => {
      mockCalendar(january);

      const result = await service.getNextHolidays({ fromDate: '2024-01-01', count: 4 });

      expect(result.found).toBe(true);
      expect(result.fromDate).toBe('2024-01-01');
      expect(result.count).toBe(4);
      expect(result.holidays.map((holiday) => holiday.date)).toEqual([
        '2024-01-07',
        '2024-01-10',
        '2024-01-13',
        '2024-01-14',
      ]);
      expect(result.holidays[0]).toEqual({ date: '2024-01-07', week: '日', description: '週末' });
      expect(result.holidays[1].description).toBe('自訂假日');
      expect(result.holidays[2].description).toBe('春節');
      expect(result.holidays.some((holiday) => holiday.date === '2024-01-01')).toBe(false);
      expect(result.holidays.some((holiday) => holiday.date === '2024-01-06')).toBe(false);
    });

    test('skipWeekends 略過一般週末但保留週六的具名假日', async () => {
      mockCalendar(january);

      const result = await service.getNextHolidays({
        fromDate: '20240101',
        count: 2,
        skipWeekends: true,
      });

      expect(result.holidays.map((holiday) => holiday.date)).toEqual([
        '2024-01-10',
        '2024-01-13',
      ]);
    });

    test('未指定日期時以台北今天為起算日', async () => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => [],
      }));

      const result = await service.getNextHolidays();
      const today = getTodayInTaipei();

      expect(result.fromDate).toBe(formatDate(today, 'YYYY-MM-DD'));
      expect(result.found).toBe(false);
      expect(result.count).toBe(0);
      expect(result.holidays).toEqual([]);
      expect(result.message).toBe('查無假期');
    });

    test('起算日已是上游最後一天時不再往後抓資料', async () => {
      mockFetch.mockImplementation(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }));

      const year = getCurrentYearInTaipei();
      const result = await service.getNextHolidays({ fromDate: `${year}-12-31`, count: 3 });

      expect(result.found).toBe(false);
      expect(result.fromDate).toBe(`${year}-12-31`);
      expect(result.message).toBe('查無假期');
      const gets = mockFetch.mock.calls.filter((call) => call[1]?.method !== 'HEAD');
      expect(gets).toHaveLength(0);
    });

    test('說明為「週末」的週六日也視為一般週末', async () => {
      mockCalendar(calendar(2024, 1, {
        '20240106': { isHoliday: true, description: '週末' },
        '20240110': { isHoliday: true, description: '自訂假日' },
      }));

      const result = await service.getNextHolidays({
        fromDate: '2024-01-01',
        count: 1,
        skipWeekends: true,
      });

      expect(result.holidays.map((holiday) => holiday.date)).toEqual(['2024-01-10']);
    });

    test('上游沒有任何年份時回查無假期', async () => {
      jest.spyOn(service, 'getAvailableYears').mockResolvedValue([]);

      const result = await service.getNextHolidays({ fromDate: '2024-01-01', count: 1 });

      expect(result).toMatchObject({ found: false, count: 0, message: '查無假期' });
    });

    test('無效起算日回報日期解析錯誤', async () => {
      await expect(service.getNextHolidays({ fromDate: '2024-02-31' }))
        .rejects.toThrow('日期解析錯誤');
      await expect(service.getWorkdaysBetween('not-a-date', '2024-01-02'))
        .rejects.toThrow('日期解析錯誤');
    });

    test('count 超出範圍時拒絕，且不打網路', async () => {
      await expect(service.getNextHolidays({ count: 0 })).rejects.toThrow('count 必須是 1 到 366');
      await expect(service.getNextHolidays({ count: 367 })).rejects.toThrow(HolidayServiceError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('count 366 仍接受', async () => {
      jest.spyOn(service, 'getAvailableYears').mockResolvedValue([2024]);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await expect(service.getNextHolidays({ fromDate: '2024-01-01', count: 366 }))
        .resolves.toMatchObject({ found: false, message: '查無假期' });
    });

    test('skipWeekends 不略過平日的空說明假期', async () => {
      mockCalendar(calendar(2024, 1, {
        '20240103': { isHoliday: true, description: '' },
      }));

      const result = await service.getNextHolidays({
        fromDate: '2024-01-01',
        count: 1,
        skipWeekends: true,
      });

      expect(result.holidays.map((holiday) => holiday.date)).toEqual(['2024-01-03']);
    });

    test('上游錯誤不會被包成日期解析錯誤', async () => {
      jest.spyOn(service, 'getAvailableYears').mockRejectedValue(new Error('upstream down'));

      await expect(service.getNextHolidays({ fromDate: '2024-01-01', count: 1 }))
        .rejects.toMatchObject({ message: 'upstream down' });

      try {
        await service.getNextHolidays({ fromDate: '2024-01-01', count: 1 });
      } catch (error) {
        expect(error).not.toBeInstanceOf(HolidayServiceError);
      }
    });

    test('整月工作天把補班日算成工作天而不是假期', async () => {
      mockCalendar(january);

      const stats = await service.getWorkdaysStats(2024, 1);

      // 1 月 31 天。週末 8 天，其中 1/6 改為補班；再加上 1/1、1/10 兩個平日假期。
      // 假期 = 7 個剩餘週末 + 2 個平日假期 = 9。工作天 = 31 - 9 = 22，其中含補班日。
      expect(stats).toMatchObject({
        year: 2024,
        month: 1,
        totalDays: 31,
        holidays: 9,
        workdays: 22,
        makeupWorkdays: 1,
      });
      expect(stats.makeupWorkdayDates).toEqual([
        { date: '2024-01-06', week: '六', description: '補行上班' },
      ]);
      expect(stats.workdays).toBe(stats.totalDays - stats.holidays);
    });

    test('月份總天數以日曆為準，資料缺筆的日子視為工作天', async () => {
      mockCalendar([
        { date: '20240201', week: '四', isHoliday: true, description: '測試假' },
        { date: '20240217', week: '六', isHoliday: false, description: '補行上班' },
      ]);

      const stats = await service.getWorkdaysStats(2024, 2);

      expect(stats.totalDays).toBe(29);
      expect(stats.holidays).toBe(1);
      expect(stats.makeupWorkdays).toBe(1);
      expect(stats.workdays).toBe(28);
    });

    test('區間工作天含起迄日，補班日計入工作天', async () => {
      mockCalendar(january);

      const stats = await service.getWorkdaysBetween('2024-01-06', '2024-01-07');

      expect(stats).toMatchObject({
        startDate: '2024-01-06',
        endDate: '2024-01-07',
        totalDays: 2,
        holidays: 1,
        workdays: 1,
        makeupWorkdays: 1,
      });
    });

    test('單日補班的工作天數為 1', async () => {
      mockCalendar(january);

      const stats = await service.getWorkdaysBetween('20240106', '20240106');

      expect(stats.totalDays).toBe(1);
      expect(stats.workdays).toBe(1);
      expect(stats.holidays).toBe(0);
      expect(stats.makeupWorkdays).toBe(1);
      expect(stats.startDate).toBe('2024-01-06');
    });

    test('開始日晚於結束日時拒絕', async () => {
      await expect(service.getWorkdaysBetween('2024-01-08', '2024-01-01'))
        .rejects.toThrow('不能晚於結束日期');
    });

    test('無效月份拒絕', async () => {
      await expect(service.getWorkdaysStats(2024, 0)).rejects.toThrow(HolidayServiceError);
      await expect(service.getWorkdaysStats(2024, 13)).rejects.toThrow('無效的月份');
    });

    test('12 月是合法月份', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const stats = await service.getWorkdaysStats(2024, 12);

      expect(stats).toMatchObject({
        year: 2024,
        month: 12,
        totalDays: 31,
        holidays: 0,
        workdays: 31,
      });
    });

    test('整月統計只算該月，不把其他月份算進來', async () => {
      mockCalendar([
        ...january,
        { date: '20240201', week: '四', isHoliday: true, description: '二月假' },
      ]);

      const stats = await service.getWorkdaysStats(2024, 1);

      expect(stats.holidays).toBe(9);
      expect(stats.makeupWorkdays).toBe(1);
      expect(stats.workdays).toBe(22);
    });
  });
}); 