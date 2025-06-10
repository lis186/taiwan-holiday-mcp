/**
 * 日期解析工具單元測試
 */

import {
  parseDate,
  formatDate,
  isValidDate,
  detectDateFormat,
  validateYear,
  validateMonth,
  validateDay,
  isLeapYear,
  getDaysInMonth,
  getTodayInTaipei,
  compareDates,
  daysBetween,
  DateParseError,
  ParsedDate
} from '../../src/utils/date-parser.js';
import { ErrorType } from '../../src/types.js';

describe('日期解析工具', () => {
  describe('parseDate', () => {
    test('應該正確解析 YYYYMMDD 格式', () => {
      const result = parseDate('20240101');
      expect(result).toEqual({
        year: 2024,
        month: 1,
        day: 1,
        original: '20240101',
        normalized: '20240101'
      });
    });

    test('應該正確解析 YYYY-MM-DD 格式', () => {
      const result = parseDate('2024-01-01');
      expect(result).toEqual({
        year: 2024,
        month: 1,
        day: 1,
        original: '2024-01-01',
        normalized: '20240101'
      });
    });

    test('應該正確解析 YYYY/MM/DD 格式', () => {
      const result = parseDate('2024/01/01');
      expect(result).toEqual({
        year: 2024,
        month: 1,
        day: 1,
        original: '2024/01/01',
        normalized: '20240101'
      });
    });

    test('應該處理前後空白', () => {
      const result = parseDate('  2024-01-01  ');
      expect(result.original).toBe('2024-01-01');
      expect(result.normalized).toBe('20240101');
    });

    test('應該在指定格式時只接受該格式', () => {
      const result = parseDate('20240101', 'YYYYMMDD');
      expect(result.normalized).toBe('20240101');
    });

    test('應該在格式不符時拋出錯誤', () => {
      expect(() => parseDate('2024-01-01', 'YYYYMMDD')).toThrow(DateParseError);
    });

    test('應該在無效格式時拋出錯誤', () => {
      expect(() => parseDate('invalid-date')).toThrow(DateParseError);
    });

    test('應該在空字串時拋出錯誤', () => {
      expect(() => parseDate('')).toThrow(DateParseError);
    });

    test('應該在非字串輸入時拋出錯誤', () => {
      expect(() => parseDate(null as any)).toThrow(DateParseError);
    });
  });

  describe('formatDate', () => {
    const testDate: ParsedDate = {
      year: 2024,
      month: 1,
      day: 1,
      original: '2024-01-01',
      normalized: '20240101'
    };

    test('應該正確格式化為 YYYYMMDD', () => {
      expect(formatDate(testDate, 'YYYYMMDD')).toBe('20240101');
    });

    test('應該正確格式化為 YYYY-MM-DD', () => {
      expect(formatDate(testDate, 'YYYY-MM-DD')).toBe('2024-01-01');
    });

    test('應該正確格式化為 YYYY/MM/DD', () => {
      expect(formatDate(testDate, 'YYYY/MM/DD')).toBe('2024/01/01');
    });

    test('應該在不支援的格式時拋出錯誤', () => {
      expect(() => formatDate(testDate, 'invalid' as any)).toThrow(DateParseError);
    });
  });

  describe('isValidDate', () => {
    test('應該驗證有效日期', () => {
      expect(isValidDate('20240101')).toBe(true);
      expect(isValidDate('2024-01-01')).toBe(true);
      expect(isValidDate('2024/01/01')).toBe(true);
    });

    test('應該拒絕無效日期', () => {
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('20240230')).toBe(false); // 2月30日不存在
      expect(isValidDate('20241301')).toBe(false); // 13月不存在
    });

    test('應該在指定格式時驗證格式', () => {
      expect(isValidDate('20240101', 'YYYYMMDD')).toBe(true);
      expect(isValidDate('2024-01-01', 'YYYYMMDD')).toBe(false);
    });
  });

  describe('detectDateFormat', () => {
    test('應該正確偵測日期格式', () => {
      expect(detectDateFormat('20240101')).toBe('YYYYMMDD');
      expect(detectDateFormat('2024-01-01')).toBe('YYYY-MM-DD');
      expect(detectDateFormat('2024/01/01')).toBe('YYYY/MM/DD');
    });

    test('應該在無法識別格式時回傳 null', () => {
      expect(detectDateFormat('invalid')).toBeNull();
      expect(detectDateFormat('01-01-2024')).toBeNull();
    });
  });

  describe('validateYear', () => {
    test('應該接受支援範圍內的年份', () => {
      expect(() => validateYear(2024)).not.toThrow();
      expect(() => validateYear(2017)).not.toThrow();
      expect(() => validateYear(2025)).not.toThrow();
    });

    test('應該拒絕超出範圍的年份', () => {
      expect(() => validateYear(2016)).toThrow(DateParseError);
      expect(() => validateYear(2026)).toThrow(DateParseError);
    });
  });

  describe('validateMonth', () => {
    test('應該接受有效月份', () => {
      expect(() => validateMonth(1)).not.toThrow();
      expect(() => validateMonth(12)).not.toThrow();
    });

    test('應該拒絕無效月份', () => {
      expect(() => validateMonth(0)).toThrow(DateParseError);
      expect(() => validateMonth(13)).toThrow(DateParseError);
    });
  });

  describe('validateDay', () => {
    test('應該接受有效日期', () => {
      expect(() => validateDay(2024, 1, 31)).not.toThrow();
      expect(() => validateDay(2024, 2, 29)).not.toThrow(); // 閏年
      expect(() => validateDay(2023, 2, 28)).not.toThrow(); // 非閏年
    });

    test('應該拒絕無效日期', () => {
      expect(() => validateDay(2024, 1, 0)).toThrow(DateParseError);
      expect(() => validateDay(2024, 1, 32)).toThrow(DateParseError);
      expect(() => validateDay(2023, 2, 29)).toThrow(DateParseError); // 非閏年
      expect(() => validateDay(2024, 4, 31)).toThrow(DateParseError); // 4月只有30天
    });
  });

  describe('isLeapYear', () => {
    test('應該正確識別閏年', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2020)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1600)).toBe(true);
    });

    test('應該正確識別非閏年', () => {
      expect(isLeapYear(2023)).toBe(false);
      expect(isLeapYear(2021)).toBe(false);
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(1700)).toBe(false);
    });
  });

  describe('getDaysInMonth', () => {
    test('應該回傳正確的月份天數', () => {
      expect(getDaysInMonth(2024, 1)).toBe(31);
      expect(getDaysInMonth(2024, 2)).toBe(29); // 閏年
      expect(getDaysInMonth(2023, 2)).toBe(28); // 非閏年
      expect(getDaysInMonth(2024, 4)).toBe(30);
      expect(getDaysInMonth(2024, 12)).toBe(31);
    });
  });

  describe('getTodayInTaipei', () => {
    test('應該回傳今天的日期', () => {
      const today = getTodayInTaipei();
      expect(today.year).toBeGreaterThan(2020);
      expect(today.month).toBeGreaterThanOrEqual(1);
      expect(today.month).toBeLessThanOrEqual(12);
      expect(today.day).toBeGreaterThanOrEqual(1);
      expect(today.day).toBeLessThanOrEqual(31);
      expect(today.normalized).toMatch(/^\d{8}$/);
    });
  });

  describe('compareDates', () => {
    const date1 = parseDate('2024-01-01');
    const date2 = parseDate('2024-01-02');
    const date3 = parseDate('2024-01-01');

    test('應該正確比較日期', () => {
      expect(compareDates(date1, date2)).toBe(-1);
      expect(compareDates(date2, date1)).toBe(1);
      expect(compareDates(date1, date3)).toBe(0);
    });

    test('應該正確比較跨月份的日期', () => {
      const jan = parseDate('2024-01-31');
      const feb = parseDate('2024-02-01');
      expect(compareDates(jan, feb)).toBe(-1);
    });

    test('應該正確比較跨年份的日期', () => {
      const dec2023 = parseDate('2023-12-31');
      const jan2024 = parseDate('2024-01-01');
      expect(compareDates(dec2023, jan2024)).toBe(-1);
    });
  });

  describe('daysBetween', () => {
    test('應該計算正確的天數差', () => {
      const start = parseDate('2024-01-01');
      const end = parseDate('2024-01-02');
      expect(daysBetween(start, end)).toBe(1);
    });

    test('應該處理跨月份的天數差', () => {
      const start = parseDate('2024-01-31');
      const end = parseDate('2024-02-01');
      expect(daysBetween(start, end)).toBe(1);
    });

    test('應該處理相同日期', () => {
      const date = parseDate('2024-01-01');
      expect(daysBetween(date, date)).toBe(0);
    });

    test('應該處理負數天數差', () => {
      const start = parseDate('2024-01-02');
      const end = parseDate('2024-01-01');
      expect(daysBetween(start, end)).toBe(-1);
    });
  });

  describe('DateParseError', () => {
    test('應該包含正確的錯誤資訊', () => {
      const error = new DateParseError('測試錯誤', ErrorType.INVALID_DATE, 'invalid');
      expect(error.name).toBe('DateParseError');
      expect(error.message).toBe('測試錯誤');
      expect(error.type).toBe(ErrorType.INVALID_DATE);
      expect(error.input).toBe('invalid');
    });
  });

  describe('邊界情況測試', () => {
    test('應該處理閏年的2月29日', () => {
      expect(() => parseDate('20240229')).not.toThrow();
      expect(() => parseDate('20230229')).toThrow(DateParseError);
    });

    test('應該處理月份邊界', () => {
      expect(() => parseDate('20240131')).not.toThrow();
      expect(() => parseDate('20240430')).not.toThrow();
      expect(() => parseDate('20240431')).toThrow(DateParseError);
    });

    test('應該處理年份邊界', () => {
      expect(() => parseDate('20170101')).not.toThrow();
      expect(() => parseDate('20251231')).not.toThrow();
      expect(() => parseDate('20160101')).toThrow(DateParseError);
      expect(() => parseDate('20260101')).toThrow(DateParseError);
    });
  });
}); 