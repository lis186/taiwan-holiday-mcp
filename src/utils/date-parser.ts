/**
 * 日期解析和驗證工具
 * 
 * 支援多種日期格式的解析、驗證和轉換功能
 */

import { DateFormat, ErrorType, SUPPORTED_YEAR_RANGE } from '../types.js';

/**
 * 日期解析結果介面
 */
export interface ParsedDate {
  /** 年份 */
  year: number;
  /** 月份 (1-12) */
  month: number;
  /** 日期 (1-31) */
  day: number;
  /** 原始輸入 */
  original: string;
  /** 標準化格式 (YYYYMMDD) */
  normalized: string;
}

/**
 * 日期驗證錯誤
 */
export class DateParseError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly input: string
  ) {
    super(message);
    this.name = 'DateParseError';
  }
}

/**
 * 日期格式正則表達式
 */
const DATE_PATTERNS = {
  'YYYYMMDD': /^(\d{4})(\d{2})(\d{2})$/,
  'YYYY-MM-DD': /^(\d{4})-(\d{2})-(\d{2})$/,
  'YYYY/MM/DD': /^(\d{4})\/(\d{2})\/(\d{2})$/
} as const;

/**
 * 每月天數對照表（非閏年）
 */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * 檢查是否為閏年
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * 取得指定年月的天數
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return DAYS_IN_MONTH[month - 1];
}

/**
 * 驗證年份是否在支援範圍內
 */
export function validateYear(year: number): void {
  if (year < SUPPORTED_YEAR_RANGE.start || year > SUPPORTED_YEAR_RANGE.end) {
    throw new DateParseError(
      `年份 ${year} 超出支援範圍 (${SUPPORTED_YEAR_RANGE.start}-${SUPPORTED_YEAR_RANGE.end})`,
      ErrorType.INVALID_YEAR,
      year.toString()
    );
  }
}

/**
 * 驗證月份是否有效
 */
export function validateMonth(month: number): void {
  if (month < 1 || month > 12) {
    throw new DateParseError(
      `無效的月份: ${month}，月份必須在 1-12 之間`,
      ErrorType.INVALID_MONTH,
      month.toString()
    );
  }
}

/**
 * 驗證日期是否有效
 */
export function validateDay(year: number, month: number, day: number): void {
  if (day < 1) {
    throw new DateParseError(
      `無效的日期: ${day}，日期必須大於 0`,
      ErrorType.INVALID_DATE,
      day.toString()
    );
  }

  const maxDays = getDaysInMonth(year, month);
  if (day > maxDays) {
    throw new DateParseError(
      `無效的日期: ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}，${month} 月最多只有 ${maxDays} 天`,
      ErrorType.INVALID_DATE,
      `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`
    );
  }
}

/**
 * 自動偵測日期格式
 */
export function detectDateFormat(dateString: string): DateFormat | null {
  for (const [format, pattern] of Object.entries(DATE_PATTERNS)) {
    if (pattern.test(dateString)) {
      return format as DateFormat;
    }
  }
  return null;
}

/**
 * 解析日期字串
 */
export function parseDate(dateString: string, expectedFormat?: DateFormat): ParsedDate {
  if (!dateString || typeof dateString !== 'string') {
    throw new DateParseError(
      '日期字串不能為空',
      ErrorType.INVALID_DATE,
      String(dateString)
    );
  }

  const trimmedDate = dateString.trim();
  
  // 如果指定了格式，只使用該格式
  if (expectedFormat) {
    const pattern = DATE_PATTERNS[expectedFormat];
    const match = pattern.exec(trimmedDate);
    
    if (!match) {
      throw new DateParseError(
        `日期格式不符合預期格式 ${expectedFormat}: ${trimmedDate}`,
        ErrorType.INVALID_DATE,
        trimmedDate
      );
    }

    return createParsedDate(match, trimmedDate);
  }

  // 自動偵測格式
  const detectedFormat = detectDateFormat(trimmedDate);
  if (!detectedFormat) {
    throw new DateParseError(
      `無法識別的日期格式: ${trimmedDate}，支援的格式: YYYYMMDD, YYYY-MM-DD, YYYY/MM/DD`,
      ErrorType.INVALID_DATE,
      trimmedDate
    );
  }

  const pattern = DATE_PATTERNS[detectedFormat];
  const match = pattern.exec(trimmedDate)!;
  
  return createParsedDate(match, trimmedDate);
}

/**
 * 建立解析結果物件
 */
function createParsedDate(match: RegExpExecArray, original: string): ParsedDate {
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // 驗證各個部分
  validateYear(year);
  validateMonth(month);
  validateDay(year, month, day);

  const normalized = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    original,
    normalized
  };
}

/**
 * 將日期轉換為指定格式
 */
export function formatDate(date: ParsedDate, format: DateFormat): string {
  const { year, month, day } = date;
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');

  switch (format) {
    case 'YYYYMMDD':
      return `${year}${monthStr}${dayStr}`;
    case 'YYYY-MM-DD':
      return `${year}-${monthStr}-${dayStr}`;
    case 'YYYY/MM/DD':
      return `${year}/${monthStr}/${dayStr}`;
    default:
      throw new DateParseError(
        `不支援的日期格式: ${format}`,
        ErrorType.INVALID_DATE,
        format
      );
  }
}

/**
 * 驗證日期字串是否有效
 */
export function isValidDate(dateString: string, expectedFormat?: DateFormat): boolean {
  try {
    parseDate(dateString, expectedFormat);
    return true;
  } catch {
    return false;
  }
}

/**
 * 取得今天的日期（台北時區）
 */
export function getTodayInTaipei(): ParsedDate {
  const now = new Date();
  // 轉換為台北時區 (UTC+8)
  const taipeiTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  
  const year = taipeiTime.getUTCFullYear();
  const month = taipeiTime.getUTCMonth() + 1;
  const day = taipeiTime.getUTCDate();
  
  const normalized = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
  
  return {
    year,
    month,
    day,
    original: normalized,
    normalized
  };
}

/**
 * 比較兩個日期
 * @returns -1 如果 date1 < date2, 0 如果相等, 1 如果 date1 > date2
 */
export function compareDates(date1: ParsedDate, date2: ParsedDate): number {
  if (date1.year !== date2.year) {
    return date1.year < date2.year ? -1 : 1;
  }
  if (date1.month !== date2.month) {
    return date1.month < date2.month ? -1 : 1;
  }
  if (date1.day !== date2.day) {
    return date1.day < date2.day ? -1 : 1;
  }
  return 0;
}

/**
 * 計算兩個日期之間的天數差
 */
export function daysBetween(startDate: ParsedDate, endDate: ParsedDate): number {
  const start = new Date(startDate.year, startDate.month - 1, startDate.day);
  const end = new Date(endDate.year, endDate.month - 1, endDate.day);
  
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
} 