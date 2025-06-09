/**
 * 測試工具函數
 * 
 * 提供測試過程中常用的工具函數，包含資料載入、模擬資料建立、驗證等功能。
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Holiday, HolidayStats, ErrorType, MCPToolResult } from '../../src/types';

/**
 * 載入測試資料檔案
 */
export function loadTestData(filename: string): Holiday[] {
  const filePath = join(__dirname, '..', 'fixtures', filename);
  const data = readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

/**
 * 建立模擬假日資料
 */
export function createMockHoliday(overrides: Partial<Holiday> = {}): Holiday {
  return {
    date: '20240101',
    week: '一',
    isHoliday: true,
    description: '測試假日',
    ...overrides
  };
}

/**
 * 建立模擬假日統計資料
 */
export function createMockHolidayStats(overrides: Partial<HolidayStats> = {}): HolidayStats {
  return {
    year: 2024,
    totalHolidays: 115,
    nationalHolidays: 12,
    compensatoryDays: 8,
    adjustedHolidays: 3,
    workingDays: 2,
    holidayTypes: {
      '國定假日': 12,
      '補假': 8,
      '調整放假': 3,
      '補行上班': 2
    },
    ...overrides
  };
}

/**
 * 建立成功的 MCP 工具回傳結果
 */
export function createSuccessResult<T>(data: T, metadata?: Record<string, any>): MCPToolResult<T> {
  return {
    success: true,
    data,
    metadata
  };
}

/**
 * 建立失敗的 MCP 工具回傳結果
 */
export function createErrorResult(error: string, metadata?: Record<string, any>): MCPToolResult {
  return {
    success: false,
    error,
    metadata
  };
}

/**
 * 驗證日期格式是否為 YYYYMMDD
 */
export function isValidDateFormat(date: string): boolean {
  const regex = /^\d{8}$/;
  if (!regex.test(date)) {
    return false;
  }

  const year = parseInt(date.substring(0, 4));
  const month = parseInt(date.substring(4, 6));
  const day = parseInt(date.substring(6, 8));

  // 基本範圍檢查
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // 使用 Date 物件驗證日期有效性
  const dateObj = new Date(year, month - 1, day);
  return dateObj.getFullYear() === year &&
         dateObj.getMonth() === month - 1 &&
         dateObj.getDate() === day;
}

/**
 * 驗證星期格式
 */
export function isValidWeekFormat(week: string): boolean {
  return ['一', '二', '三', '四', '五', '六', '日'].includes(week);
}

/**
 * 驗證年份是否在支援範圍內
 */
export function isValidYear(year: number): boolean {
  return year >= 2017 && year <= 2025;
}

/**
 * 驗證月份
 */
export function isValidMonth(month: number): boolean {
  return month >= 1 && month <= 12;
}

/**
 * 驗證日期
 */
export function isValidDay(day: number): boolean {
  return day >= 1 && day <= 31;
}

/**
 * 驗證假日物件結構
 */
export function isValidHoliday(holiday: any): holiday is Holiday {
  return (
    typeof holiday === 'object' &&
    holiday !== null &&
    typeof holiday.date === 'string' &&
    typeof holiday.week === 'string' &&
    typeof holiday.isHoliday === 'boolean' &&
    typeof holiday.description === 'string' &&
    isValidDateFormat(holiday.date) &&
    isValidWeekFormat(holiday.week)
  );
}

/**
 * 驗證假日統計物件結構
 */
export function isValidHolidayStats(stats: any): stats is HolidayStats {
  return (
    typeof stats === 'object' &&
    stats !== null &&
    typeof stats.year === 'number' &&
    typeof stats.totalHolidays === 'number' &&
    typeof stats.nationalHolidays === 'number' &&
    typeof stats.compensatoryDays === 'number' &&
    typeof stats.adjustedHolidays === 'number' &&
    typeof stats.workingDays === 'number' &&
    typeof stats.holidayTypes === 'object' &&
    stats.holidayTypes !== null &&
    isValidYear(stats.year)
  );
}

/**
 * 驗證 MCP 工具回傳結果結構
 */
export function isValidMCPResult(result: any): result is MCPToolResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    typeof result.success === 'boolean' &&
    (result.data === undefined || result.data !== null) &&
    (result.error === undefined || typeof result.error === 'string') &&
    (result.metadata === undefined || typeof result.metadata === 'object')
  );
}

/**
 * 取得測試用的年份列表
 */
export function getTestYears(): number[] {
  return [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
}

/**
 * 取得測試用的無效年份列表
 */
export function getInvalidYears(): number[] {
  return [2016, 2026, 1999, 2030];
}

/**
 * 取得測試用的月份列表
 */
export function getTestMonths(): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

/**
 * 取得測試用的無效月份列表
 */
export function getInvalidMonths(): number[] {
  return [0, 13, -1, 15];
}

/**
 * 產生隨機日期字串 (YYYYMMDD 格式)
 */
export function generateRandomDate(year?: number): string {
  const testYear = year || 2024;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1; // 使用 28 避免月份天數問題
  
  return `${testYear}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
}

/**
 * 等待指定時間（用於測試異步操作）
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 建立測試用的錯誤物件
 */
export function createTestError(type: ErrorType, message: string) {
  return {
    type,
    message,
    code: `TEST_${type}`,
    details: { test: true }
  };
}

/**
 * 比較兩個假日陣列是否相等
 */
export function compareHolidayArrays(arr1: Holiday[], arr2: Holiday[]): boolean {
  if (arr1.length !== arr2.length) return false;
  
  return arr1.every((holiday1, index) => {
    const holiday2 = arr2[index];
    return (
      holiday1.date === holiday2.date &&
      holiday1.week === holiday2.week &&
      holiday1.isHoliday === holiday2.isHoliday &&
      holiday1.description === holiday2.description
    );
  });
}

/**
 * 過濾假日資料（只保留假日）
 */
export function filterHolidays(holidays: Holiday[]): Holiday[] {
  return holidays.filter(holiday => holiday.isHoliday);
}

/**
 * 過濾工作日資料（只保留工作日）
 */
export function filterWorkingDays(holidays: Holiday[]): Holiday[] {
  return holidays.filter(holiday => !holiday.isHoliday);
}

/**
 * 計算假日統計
 */
export function calculateHolidayStats(holidays: Holiday[], year: number): HolidayStats {
  const holidayData = holidays.filter(h => h.isHoliday);
  const workingData = holidays.filter(h => !h.isHoliday && h.description.includes('補行上班'));
  
  const holidayTypes: Record<string, number> = {};
  
  holidayData.forEach(holiday => {
    const type = categorizeHolidayType(holiday.description);
    holidayTypes[type] = (holidayTypes[type] || 0) + 1;
  });
  
  return {
    year,
    totalHolidays: holidayData.length,
    nationalHolidays: holidayData.filter(h => isNationalHoliday(h.description)).length,
    compensatoryDays: holidayData.filter(h => h.description.includes('補假')).length,
    adjustedHolidays: holidayData.filter(h => h.description.includes('調整放假')).length,
    workingDays: workingData.length,
    holidayTypes
  };
}

/**
 * 分類假日類型
 */
function categorizeHolidayType(description: string): string {
  if (description.includes('補假')) return '補假';
  if (description.includes('調整放假')) return '調整放假';
  if (description.includes('春節')) return '春節';
  if (description.includes('國慶')) return '國慶日';
  if (description.includes('端午')) return '端午節';
  if (description.includes('中秋')) return '中秋節';
  if (description.includes('清明') || description.includes('民族掃墓節')) return '清明節';
  return '其他假日';
}

/**
 * 判斷是否為國定假日
 */
function isNationalHoliday(description: string): boolean {
  const nationalHolidays = [
    '開國紀念日', '春節', '和平紀念日', '兒童節', '民族掃墓節',
    '端午節', '中秋節', '國慶日', '勞動節'
  ];
  
  return nationalHolidays.some(holiday => description.includes(holiday));
} 