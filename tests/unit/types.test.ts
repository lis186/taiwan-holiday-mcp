/**
 * 型別定義測試
 * 
 * 測試核心型別定義的正確性和一致性
 */

import {
  Holiday,
  HolidayStats,
  DateFormat,
  YearRange,
  QueryParams,
  MCPToolResult,
  HolidayQueryResult,
  HolidayStatsResult,
  ErrorType,
  ErrorDetail,
  MCPToolError,
  SUPPORTED_YEAR_RANGE,
  DEFAULT_DATE_FORMAT,
  WEEK_MAPPING,
  HOLIDAY_TYPES,
  HolidayType
} from '../../src/types';

import {
  createMockHoliday,
  createMockHolidayStats,
  createSuccessResult,
  createErrorResult,
  isValidHoliday,
  isValidHolidayStats,
  isValidMCPResult,
  loadTestData
} from '../utils/test-helpers';

describe('型別定義測試', () => {
  describe('Holiday 介面', () => {
    it('應該正確建立假日物件', () => {
      const holiday: Holiday = {
        date: '20240101',
        week: '一',
        isHoliday: true,
        description: '開國紀念日'
      };

      expect(holiday.date).toBe('20240101');
      expect(holiday.week).toBe('一');
      expect(holiday.isHoliday).toBe(true);
      expect(holiday.description).toBe('開國紀念日');
    });

    it('應該支援工作日物件', () => {
      const workingDay: Holiday = {
        date: '20240102',
        week: '二',
        isHoliday: false,
        description: ''
      };

      expect(workingDay.isHoliday).toBe(false);
      expect(workingDay.description).toBe('');
    });

    it('應該通過驗證函數', () => {
      const holiday = createMockHoliday();
      expect(isValidHoliday(holiday)).toBe(true);
    });
  });

  describe('HolidayStats 介面', () => {
    it('應該正確建立假日統計物件', () => {
      const stats: HolidayStats = {
        year: 2024,
        totalHolidays: 115,
        nationalHolidays: 12,
        compensatoryDays: 8,
        adjustedHolidays: 3,
        workingDays: 2,
        holidayTypes: {
          '國定假日': 12,
          '補假': 8,
          '調整放假': 3
        }
      };

      expect(stats.year).toBe(2024);
      expect(stats.totalHolidays).toBe(115);
      expect(typeof stats.holidayTypes).toBe('object');
    });

    it('應該通過驗證函數', () => {
      const stats = createMockHolidayStats();
      expect(isValidHolidayStats(stats)).toBe(true);
    });
  });

  describe('DateFormat 型別', () => {
    it('應該支援所有定義的日期格式', () => {
      const formats: DateFormat[] = ['YYYYMMDD', 'YYYY-MM-DD', 'YYYY/MM/DD'];
      
      formats.forEach(format => {
        expect(typeof format).toBe('string');
      });
    });

    it('預設格式應該是 YYYYMMDD', () => {
      expect(DEFAULT_DATE_FORMAT).toBe('YYYYMMDD');
    });
  });

  describe('YearRange 型別', () => {
    it('應該正確定義年份範圍', () => {
      const range: YearRange = {
        start: 2017,
        end: 2025
      };

      expect(range.start).toBeLessThan(range.end);
      expect(SUPPORTED_YEAR_RANGE.start).toBe(2017);
      expect(SUPPORTED_YEAR_RANGE.end).toBe(2026);
    });
  });

  describe('QueryParams 介面', () => {
    it('應該支援所有查詢參數', () => {
      const params: QueryParams = {
        year: 2024,
        month: 1,
        day: 1,
        holidaysOnly: true,
        dateFormat: 'YYYYMMDD'
      };

      expect(params.year).toBe(2024);
      expect(params.month).toBe(1);
      expect(params.day).toBe(1);
      expect(params.holidaysOnly).toBe(true);
      expect(params.dateFormat).toBe('YYYYMMDD');
    });

    it('應該支援部分參數', () => {
      const params: QueryParams = {
        year: 2024
      };

      expect(params.year).toBe(2024);
      expect(params.month).toBeUndefined();
    });
  });

  describe('MCPToolResult 介面', () => {
    it('應該正確建立成功結果', () => {
      const data = [createMockHoliday()];
      const result = createSuccessResult(data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.error).toBeUndefined();
    });

    it('應該正確建立錯誤結果', () => {
      const result = createErrorResult('測試錯誤');

      expect(result.success).toBe(false);
      expect(result.error).toBe('測試錯誤');
      expect(result.data).toBeUndefined();
    });

    it('應該通過驗證函數', () => {
      const result = createSuccessResult([]);
      expect(isValidMCPResult(result)).toBe(true);
    });
  });

  describe('HolidayQueryResult 介面', () => {
    it('應該正確建立查詢結果', () => {
      const holidays = [createMockHoliday()];
      const result: HolidayQueryResult = {
        success: true,
        data: holidays,
        year: 2024,
        totalCount: 1,
        holidayCount: 1
      };

      expect(result.year).toBe(2024);
      expect(result.totalCount).toBe(1);
      expect(result.holidayCount).toBe(1);
      expect(result.data).toEqual(holidays);
    });
  });

  describe('HolidayStatsResult 介面', () => {
    it('應該正確建立統計結果', () => {
      const stats = createMockHolidayStats();
      const result: HolidayStatsResult = {
        success: true,
        data: stats,
        year: 2024
      };

      expect(result.year).toBe(2024);
      expect(result.data).toEqual(stats);
    });
  });

  describe('ErrorType 列舉', () => {
    it('應該包含所有錯誤類型', () => {
      const expectedTypes = [
        'INVALID_YEAR',
        'INVALID_MONTH',
        'INVALID_DATE',
        'DATA_NOT_FOUND',
        'NETWORK_ERROR',
        'PARSE_ERROR',
        'UNKNOWN_ERROR'
      ];

      expectedTypes.forEach(type => {
        expect(Object.values(ErrorType)).toContain(type);
      });
    });
  });

  describe('ErrorDetail 介面', () => {
    it('應該正確建立錯誤詳情', () => {
      const error: ErrorDetail = {
        type: ErrorType.INVALID_YEAR,
        message: '無效的年份',
        code: 'ERR_001',
        details: { year: 2030 }
      };

      expect(error.type).toBe(ErrorType.INVALID_YEAR);
      expect(error.message).toBe('無效的年份');
      expect(error.code).toBe('ERR_001');
      expect(error.details).toEqual({ year: 2030 });
    });
  });

  describe('MCPToolError 介面', () => {
    it('應該正確建立工具錯誤', () => {
      const toolError: MCPToolError = {
        error: {
          type: ErrorType.NETWORK_ERROR,
          message: '網路連線失敗'
        },
        timestamp: '2024-01-01T00:00:00Z',
        requestId: 'req-123'
      };

      expect(toolError.error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(toolError.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(toolError.requestId).toBe('req-123');
    });
  });

  describe('常數定義', () => {
    it('WEEK_MAPPING 應該包含所有星期', () => {
      const expectedWeeks = ['日', '一', '二', '三', '四', '五', '六'];
      
      expectedWeeks.forEach((week, index) => {
        expect(WEEK_MAPPING[week]).toBe(index);
      });
    });

    it('HOLIDAY_TYPES 應該包含所有假日類型', () => {
      const expectedTypes = [
        'NATIONAL', 'COMPENSATORY', 'ADJUSTED', 'WORKING',
        'LUNAR_NEW_YEAR', 'TOMB_SWEEPING', 'DRAGON_BOAT',
        'MID_AUTUMN', 'NATIONAL_DAY'
      ];

      expectedTypes.forEach(type => {
        expect(HOLIDAY_TYPES[type as keyof typeof HOLIDAY_TYPES]).toBeDefined();
      });
    });

    it('HolidayType 應該正確對應假日類型', () => {
      const holidayType: HolidayType = HOLIDAY_TYPES.NATIONAL;
      expect(holidayType).toBe('國定假日');
    });
  });

  describe('測試資料載入', () => {
    it('應該能載入測試假日資料', () => {
      const holidays = loadTestData('sample-holidays.json');
      
      expect(Array.isArray(holidays)).toBe(true);
      expect(holidays.length).toBeGreaterThan(0);
      
      holidays.forEach(holiday => {
        expect(isValidHoliday(holiday)).toBe(true);
      });
    });

    it('載入的測試資料應該包含假日和工作日', () => {
      const holidays = loadTestData('sample-holidays.json');
      
      const holidayCount = holidays.filter(h => h.isHoliday).length;
      const workingDayCount = holidays.filter(h => !h.isHoliday).length;
      
      expect(holidayCount).toBeGreaterThan(0);
      expect(workingDayCount).toBeGreaterThan(0);
    });

    it('載入的測試資料應該符合 TaiwanCalendar 格式', () => {
      const holidays = loadTestData('sample-holidays.json');
      
      holidays.forEach(holiday => {
        expect(holiday).toHaveProperty('date');
        expect(holiday).toHaveProperty('week');
        expect(holiday).toHaveProperty('isHoliday');
        expect(holiday).toHaveProperty('description');
        
        expect(typeof holiday.date).toBe('string');
        expect(holiday.date).toMatch(/^\d{8}$/);
        expect(['一', '二', '三', '四', '五', '六', '日']).toContain(holiday.week);
        expect(typeof holiday.isHoliday).toBe('boolean');
        expect(typeof holiday.description).toBe('string');
      });
    });
  });
}); 