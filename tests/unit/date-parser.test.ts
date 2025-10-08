/**
 * date-parser.ts 完整測試
 * 測試所有日期解析和驗證功能
 */

import {
  parseDate,
  isLeapYear,
  getDaysInMonth,
  validateYear,
  validateMonth,
  validateDay,
  detectDateFormat,
  formatDate,
  isValidDate,
  getTodayInTaipei,
  compareDates,
  daysBetween,
  DateParseError,
  type ParsedDate
} from '../../src/utils/date-parser.js';
import { DateFormat, ErrorType } from '../../src/types.js';

describe('Date Parser Utils', () => {
  describe('isLeapYear', () => {
    test('應該正確識別閏年', () => {
      expect(isLeapYear(2020)).toBe(true);
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1600)).toBe(true);
    });

    test('應該正確識別非閏年', () => {
      expect(isLeapYear(2021)).toBe(false);
      expect(isLeapYear(2022)).toBe(false);
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(1700)).toBe(false);
    });

    test('應該處理邊界情況', () => {
      expect(isLeapYear(4)).toBe(true);
      expect(isLeapYear(100)).toBe(false);
      expect(isLeapYear(400)).toBe(true);
    });
  });

  describe('getDaysInMonth', () => {
    test('應該返回正確的月份天數', () => {
      expect(getDaysInMonth(2023, 1)).toBe(31);
      expect(getDaysInMonth(2023, 2)).toBe(28);
      expect(getDaysInMonth(2023, 3)).toBe(31);
      expect(getDaysInMonth(2023, 4)).toBe(30);
      expect(getDaysInMonth(2023, 12)).toBe(31);
    });

    test('應該處理閏年二月', () => {
      expect(getDaysInMonth(2020, 2)).toBe(29);
      expect(getDaysInMonth(2024, 2)).toBe(29);
      expect(getDaysInMonth(2021, 2)).toBe(28);
    });
  });

  describe('validateYear', () => {
    test('應該接受有效年份', () => {
      expect(() => validateYear(2023)).not.toThrow();
      expect(() => validateYear(2017)).not.toThrow();
      expect(() => validateYear(2025)).not.toThrow();
      expect(() => validateYear(2026)).not.toThrow();
    });

    test('應該拒絕無效年份', () => {
      expect(() => validateYear(2016)).toThrow(DateParseError);
      expect(() => validateYear(2027)).toThrow(DateParseError);
      expect(() => validateYear(1999)).toThrow(DateParseError);
    });

    test('應該提供正確的錯誤訊息', () => {
      try {
        validateYear(2030);
      } catch (error) {
        expect(error).toBeInstanceOf(DateParseError);
        expect((error as DateParseError).type).toBe(ErrorType.INVALID_YEAR);
      }
    });
  });

  describe('validateMonth', () => {
    test('應該接受有效月份', () => {
      for (let month = 1; month <= 12; month++) {
        expect(() => validateMonth(month)).not.toThrow();
      }
    });

    test('應該拒絕無效月份', () => {
      expect(() => validateMonth(0)).toThrow(DateParseError);
      expect(() => validateMonth(13)).toThrow(DateParseError);
      expect(() => validateMonth(-1)).toThrow(DateParseError);
    });
  });

  describe('validateDay', () => {
    test('應該接受有效日期', () => {
      expect(() => validateDay(2023, 1, 31)).not.toThrow();
      expect(() => validateDay(2023, 2, 28)).not.toThrow();
      expect(() => validateDay(2020, 2, 29)).not.toThrow();
      expect(() => validateDay(2023, 4, 30)).not.toThrow();
    });

    test('應該拒絕無效日期', () => {
      expect(() => validateDay(2023, 2, 29)).toThrow(DateParseError);
      expect(() => validateDay(2023, 4, 31)).toThrow(DateParseError);
      expect(() => validateDay(2023, 1, 0)).toThrow(DateParseError);
      expect(() => validateDay(2023, 1, 32)).toThrow(DateParseError);
    });
  });

  describe('detectDateFormat', () => {
    test('應該正確偵測 YYYYMMDD 格式', () => {
      expect(detectDateFormat('20231225')).toBe('YYYYMMDD');
      expect(detectDateFormat('20200229')).toBe('YYYYMMDD');
    });

    test('應該正確偵測 YYYY-MM-DD 格式', () => {
      expect(detectDateFormat('2023-12-25')).toBe('YYYY-MM-DD');
      expect(detectDateFormat('2020-02-29')).toBe('YYYY-MM-DD');
    });

    test('應該正確偵測 YYYY/MM/DD 格式', () => {
      expect(detectDateFormat('2023/12/25')).toBe('YYYY/MM/DD');
      expect(detectDateFormat('2020/02/29')).toBe('YYYY/MM/DD');
    });

    test('應該返回 null 對於無效格式', () => {
      expect(detectDateFormat('invalid')).toBe(null);
      expect(detectDateFormat('23-12-25')).toBe(null);
      expect(detectDateFormat('12345')).toBe(null);
    });
  });

  describe('parseDate', () => {
    test('應該正確解析 YYYYMMDD 格式', () => {
      const result = parseDate('20231225');
      expect(result).toEqual({
        year: 2023,
        month: 12,
        day: 25,
        original: '20231225',
        normalized: '20231225'
      });
    });

    test('應該正確解析 YYYY-MM-DD 格式', () => {
      const result = parseDate('2023-12-25');
      expect(result).toEqual({
        year: 2023,
        month: 12,
        day: 25,
        original: '2023-12-25',
        normalized: '20231225'
      });
    });

    test('應該正確解析 YYYY/MM/DD 格式', () => {
      const result = parseDate('2023/12/25');
      expect(result).toEqual({
        year: 2023,
        month: 12,
        day: 25,
        original: '2023/12/25',
        normalized: '20231225'
      });
    });

    test('應該處理指定格式', () => {
      const result = parseDate('20231225', 'YYYYMMDD');
      expect(result.year).toBe(2023);
      expect(result.month).toBe(12);
      expect(result.day).toBe(25);
    });

    test('應該拋出錯誤對於空字串', () => {
      expect(() => parseDate('')).toThrow(DateParseError);
      expect(() => parseDate('   ')).toThrow(DateParseError);
    });

    test('應該拋出錯誤對於無效格式', () => {
      expect(() => parseDate('invalid')).toThrow(DateParseError);
      expect(() => parseDate('23-12-25')).toThrow(DateParseError);
    });

    test('應該拋出錯誤對於無效日期', () => {
      expect(() => parseDate('20230229')).toThrow(DateParseError);
      expect(() => parseDate('20230431')).toThrow(DateParseError);
    });

    test('應該處理閏年', () => {
      expect(() => parseDate('20200229')).not.toThrow();
      expect(() => parseDate('20210229')).toThrow(DateParseError);
    });
  });

  describe('formatDate', () => {
    const testDate: ParsedDate = {
      year: 2023,
      month: 12,
      day: 25,
      original: '20231225',
      normalized: '20231225'
    };

    test('應該格式化為 YYYYMMDD', () => {
      expect(formatDate(testDate, 'YYYYMMDD')).toBe('20231225');
    });

    test('應該格式化為 YYYY-MM-DD', () => {
      expect(formatDate(testDate, 'YYYY-MM-DD')).toBe('2023-12-25');
    });

    test('應該格式化為 YYYY/MM/DD', () => {
      expect(formatDate(testDate, 'YYYY/MM/DD')).toBe('2023/12/25');
    });

    test('應該正確補零', () => {
      const singleDigitDate: ParsedDate = {
        year: 2023,
        month: 1,
        day: 5,
        original: '20230105',
        normalized: '20230105'
      };
      expect(formatDate(singleDigitDate, 'YYYY-MM-DD')).toBe('2023-01-05');
    });
  });

  describe('isValidDate', () => {
    test('應該驗證有效日期', () => {
      expect(isValidDate('20231225')).toBe(true);
      expect(isValidDate('2023-12-25')).toBe(true);
      expect(isValidDate('2023/12/25')).toBe(true);
      expect(isValidDate('20200229')).toBe(true);
    });

    test('應該拒絕無效日期', () => {
      expect(isValidDate('20230229')).toBe(false);
      expect(isValidDate('20230431')).toBe(false);
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('')).toBe(false);
    });

    test('應該處理指定格式', () => {
      expect(isValidDate('20231225', 'YYYYMMDD')).toBe(true);
      expect(isValidDate('2023-12-25', 'YYYYMMDD')).toBe(false);
    });
  });

  describe('getTodayInTaipei', () => {
    test('應該返回今天的日期', () => {
      const today = getTodayInTaipei();
      expect(today.year).toBeGreaterThan(2020);
      expect(today.month).toBeGreaterThanOrEqual(1);
      expect(today.month).toBeLessThanOrEqual(12);
      expect(today.day).toBeGreaterThanOrEqual(1);
      expect(today.day).toBeLessThanOrEqual(31);
    });

    test('應該有正確的格式', () => {
      const today = getTodayInTaipei();
      expect(today.normalized).toMatch(/^\d{8}$/);
      expect(today.normalized.length).toBe(8);
    });
  });

  describe('compareDates', () => {
    const date1: ParsedDate = {
      year: 2023,
      month: 12,
      day: 25,
      original: '20231225',
      normalized: '20231225'
    };

    const date2: ParsedDate = {
      year: 2023,
      month: 12,
      day: 26,
      original: '20231226',
      normalized: '20231226'
    };

    const date3: ParsedDate = {
      year: 2023,
      month: 12,
      day: 25,
      original: '2023-12-25',
      normalized: '20231225'
    };

    test('應該正確比較日期', () => {
      expect(compareDates(date1, date2)).toBeLessThan(0);
      expect(compareDates(date2, date1)).toBeGreaterThan(0);
      expect(compareDates(date1, date3)).toBe(0);
    });

    test('應該處理跨年比較', () => {
      const date2024: ParsedDate = {
        year: 2024,
        month: 1,
        day: 1,
        original: '20240101',
        normalized: '20240101'
      };
      expect(compareDates(date1, date2024)).toBeLessThan(0);
      expect(compareDates(date2024, date1)).toBeGreaterThan(0);
    });
  });

  describe('daysBetween', () => {
    test('應該計算正確的天數差', () => {
      const start = parseDate('20231225');
      const end = parseDate('20231230');
      expect(daysBetween(start, end)).toBe(5);
    });

    test('應該處理相同日期', () => {
      const date = parseDate('20231225');
      expect(daysBetween(date, date)).toBe(0);
    });

    test('應該處理反向日期', () => {
      const start = parseDate('20231230');
      const end = parseDate('20231225');
      expect(daysBetween(start, end)).toBe(-5);
    });

    test('應該處理跨月計算', () => {
      const start = parseDate('20231225');
      const end = parseDate('20240105');
      expect(daysBetween(start, end)).toBe(11);
    });
  });

  describe('DateParseError', () => {
    test('應該創建正確的錯誤物件', () => {
      const error = new DateParseError('Test message', ErrorType.INVALID_DATE, 'test-input');
      expect(error.message).toBe('Test message');
      expect(error.type).toBe(ErrorType.INVALID_DATE);
      expect(error.input).toBe('test-input');
      expect(error.name).toBe('DateParseError');
    });
  });
}); 