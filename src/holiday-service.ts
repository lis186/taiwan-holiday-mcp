/**
 * 台灣假期資料服務
 * 
 * 負責從 TaiwanCalendar CDN 獲取假期資料，提供快取機制和完整的錯誤處理
 */

import { Holiday, HolidayStats, ErrorType, SUPPORTED_YEAR_RANGE, HOLIDAY_TYPES } from './types.js';
import { parseDate, ParsedDate, DateParseError } from './utils/date-parser.js';

/**
 * 快取項目介面
 */
interface CacheItem<T> {
  /** 快取資料 */
  data: T;
  /** 快取時間戳記 */
  timestamp: number;
  /** TTL (毫秒) */
  ttl: number;
}

/**
 * HTTP 請求選項
 */
interface RequestOptions {
  /** 請求超時時間 (毫秒) */
  timeout: number;
  /** 重試次數 */
  retries: number;
  /** 重試間隔 (毫秒) */
  retryDelay: number;
}

/**
 * 假期資料服務錯誤
 */
export class HolidayServiceError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'HolidayServiceError';
  }
}

/**
 * 台灣假期資料服務類別
 */
export class HolidayService {
  /** CDN 基礎 URL */
  private readonly baseUrl = 'https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data';
  
  /** 記憶體快取 */
  private readonly cache = new Map<string, CacheItem<Holiday[]>>();
  
  /** 預設請求選項 */
  private readonly defaultOptions: RequestOptions = {
    timeout: 10000,      // 10 秒
    retries: 3,          // 重試 3 次
    retryDelay: 1000     // 重試間隔 1 秒
  };

  /** 預設快取 TTL (1 小時) */
  private readonly defaultTtl = 60 * 60 * 1000;

  /**
   * 建構子
   */
  constructor(
    private readonly options: Partial<RequestOptions> = {},
    private readonly cacheTtl: number = 60 * 60 * 1000 // 1 小時
  ) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * 獲取指定年份的假期資料
   */
  async getHolidaysForYear(year: number): Promise<Holiday[]> {
    // 驗證年份
    if (year < SUPPORTED_YEAR_RANGE.start || year > SUPPORTED_YEAR_RANGE.end) {
      throw new HolidayServiceError(
        `年份 ${year} 超出支援範圍 (${SUPPORTED_YEAR_RANGE.start}-${SUPPORTED_YEAR_RANGE.end})`,
        ErrorType.INVALID_YEAR
      );
    }

    const cacheKey = `holidays_${year}`;
    
    // 檢查快取
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 從 CDN 獲取資料
      const holidays = await this.fetchHolidaysFromCdn(year);
      
      // 驗證資料格式
      this.validateHolidayData(holidays);
      
      // 存入快取
      this.setCache(cacheKey, holidays);
      
      return holidays;
    } catch (error) {
      if (error instanceof HolidayServiceError) {
        throw error;
      }
      
      throw new HolidayServiceError(
        `獲取 ${year} 年假期資料失敗: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.NETWORK_ERROR,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 檢查指定日期是否為假日
   */
  async checkHoliday(dateString: string): Promise<Holiday | null> {
    try {
      const parsedDate = parseDate(dateString);
      const holidays = await this.getHolidaysForYear(parsedDate.year);
      
      return holidays.find(holiday => holiday.date === parsedDate.normalized) || null;
    } catch (error) {
      if (error instanceof DateParseError) {
        throw new HolidayServiceError(
          `日期解析錯誤: ${error.message}`,
          error.type,
          error
        );
      }
      throw error;
    }
  }

  /**
   * 獲取指定日期範圍內的假期
   */
  async getHolidaysInRange(startDate: string, endDate: string): Promise<Holiday[]> {
    try {
      const start = parseDate(startDate);
      const end = parseDate(endDate);
      
      // 驗證日期範圍
      if (start.year > end.year || 
          (start.year === end.year && start.month > end.month) ||
          (start.year === end.year && start.month === end.month && start.day > end.day)) {
        throw new HolidayServiceError(
          `開始日期 ${startDate} 不能晚於結束日期 ${endDate}`,
          ErrorType.INVALID_DATE
        );
      }

      const result: Holiday[] = [];
      
      // 處理跨年度的情況
      for (let year = start.year; year <= end.year; year++) {
        const holidays = await this.getHolidaysForYear(year);
        
        for (const holiday of holidays) {
          const holidayDate = parseDate(holiday.date);
          
          // 檢查是否在範圍內
          if (this.isDateInRange(holidayDate, start, end)) {
            result.push(holiday);
          }
        }
      }
      
      // 按日期排序
      return result.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      if (error instanceof DateParseError) {
        throw new HolidayServiceError(
          `日期解析錯誤: ${error.message}`,
          error.type,
          error
        );
      }
      throw error;
    }
  }

  /**
   * 獲取指定年份的假期統計
   */
  async getHolidayStats(year: number, month?: number): Promise<HolidayStats> {
    const holidays = await this.getHolidaysForYear(year);
    
    let filteredHolidays = holidays;
    
    // 如果指定月份，進行篩選
    if (month !== undefined) {
      if (month < 1 || month > 12) {
        throw new HolidayServiceError(
          `無效的月份: ${month}，月份必須在 1-12 之間`,
          ErrorType.INVALID_MONTH
        );
      }
      
      const monthStr = month.toString().padStart(2, '0');
      filteredHolidays = holidays.filter(holiday => {
        const holidayMonth = holiday.date.substring(4, 6);
        return holidayMonth === monthStr;
      });
    }

    return this.calculateStats(year, filteredHolidays);
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清除過期的快取項目
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 從 CDN 獲取假期資料
   */
  private async fetchHolidaysFromCdn(year: number): Promise<Holiday[]> {
    const url = `${this.baseUrl}/${year}.json`;
    
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.options.retries!; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, this.options.timeout!);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
          throw new Error('回應資料格式錯誤：預期為陣列');
        }
        
        return data as Holiday[];
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 如果不是最後一次嘗試，等待後重試
        if (attempt < this.options.retries!) {
          await this.delay(this.options.retryDelay!);
        }
      }
    }
    
    throw new HolidayServiceError(
      `經過 ${this.options.retries! + 1} 次嘗試後仍無法獲取資料`,
      ErrorType.NETWORK_ERROR,
      lastError
    );
  }

  /**
   * 帶超時的 fetch 請求
   */
  private async fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'taiwan-holiday-mcp/1.0.0'
        }
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`請求超時 (${timeout}ms)`);
      }
      
      throw error;
    }
  }

  /**
   * 延遲函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 驗證假期資料格式
   */
  private validateHolidayData(holidays: any[]): void {
    if (!Array.isArray(holidays)) {
      throw new HolidayServiceError(
        '假期資料格式錯誤：預期為陣列',
        ErrorType.PARSE_ERROR
      );
    }

    for (let i = 0; i < holidays.length; i++) {
      const holiday = holidays[i];
      
      if (!holiday || typeof holiday !== 'object') {
        throw new HolidayServiceError(
          `假期資料項目 ${i} 格式錯誤：預期為物件`,
          ErrorType.PARSE_ERROR
        );
      }

      // 檢查必要欄位
      const requiredFields = ['date', 'week', 'isHoliday', 'description'];
      for (const field of requiredFields) {
        if (!(field in holiday)) {
          throw new HolidayServiceError(
            `假期資料項目 ${i} 缺少必要欄位: ${field}`,
            ErrorType.PARSE_ERROR
          );
        }
      }

      // 驗證欄位型別
      if (typeof holiday.date !== 'string' || !/^\d{8}$/.test(holiday.date)) {
        throw new HolidayServiceError(
          `假期資料項目 ${i} 的 date 欄位格式錯誤：預期為 YYYYMMDD 格式`,
          ErrorType.PARSE_ERROR
        );
      }

      if (typeof holiday.week !== 'string') {
        throw new HolidayServiceError(
          `假期資料項目 ${i} 的 week 欄位格式錯誤：預期為字串`,
          ErrorType.PARSE_ERROR
        );
      }

      if (typeof holiday.isHoliday !== 'boolean') {
        throw new HolidayServiceError(
          `假期資料項目 ${i} 的 isHoliday 欄位格式錯誤：預期為布林值`,
          ErrorType.PARSE_ERROR
        );
      }

      if (typeof holiday.description !== 'string') {
        throw new HolidayServiceError(
          `假期資料項目 ${i} 的 description 欄位格式錯誤：預期為字串`,
          ErrorType.PARSE_ERROR
        );
      }
    }
  }

  /**
   * 檢查日期是否在指定範圍內
   */
  private isDateInRange(date: ParsedDate, start: ParsedDate, end: ParsedDate): boolean {
    const dateNum = date.year * 10000 + date.month * 100 + date.day;
    const startNum = start.year * 10000 + start.month * 100 + start.day;
    const endNum = end.year * 10000 + end.month * 100 + end.day;
    
    return dateNum >= startNum && dateNum <= endNum;
  }

  /**
   * 計算假期統計
   */
  private calculateStats(year: number, holidays: Holiday[]): HolidayStats {
    const holidayTypes: Record<string, number> = {};
    let totalHolidays = 0;
    let nationalHolidays = 0;
    let compensatoryDays = 0;
    let adjustedHolidays = 0;
    let workingDays = 0;

    for (const holiday of holidays) {
      if (holiday.isHoliday) {
        totalHolidays++;
        
        // 分析假日類型
        const description = holiday.description.toLowerCase();
        
        if (description.includes('補假')) {
          compensatoryDays++;
          holidayTypes[HOLIDAY_TYPES.COMPENSATORY] = (holidayTypes[HOLIDAY_TYPES.COMPENSATORY] || 0) + 1;
        } else if (description.includes('調整放假')) {
          adjustedHolidays++;
          holidayTypes[HOLIDAY_TYPES.ADJUSTED] = (holidayTypes[HOLIDAY_TYPES.ADJUSTED] || 0) + 1;
        } else {
          nationalHolidays++;
          holidayTypes[HOLIDAY_TYPES.NATIONAL] = (holidayTypes[HOLIDAY_TYPES.NATIONAL] || 0) + 1;
        }
        
        // 記錄具體假日類型
        if (holiday.description) {
          holidayTypes[holiday.description] = (holidayTypes[holiday.description] || 0) + 1;
        }
      } else if (holiday.description.includes('補行上班')) {
        workingDays++;
        holidayTypes[HOLIDAY_TYPES.WORKING] = (holidayTypes[HOLIDAY_TYPES.WORKING] || 0) + 1;
      }
    }

    return {
      year,
      totalHolidays,
      nationalHolidays,
      compensatoryDays,
      adjustedHolidays,
      workingDays,
      holidayTypes
    };
  }

  /**
   * 從快取獲取資料
   */
  private getFromCache(key: string): Holiday[] | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // 檢查是否過期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  /**
   * 設定快取
   */
  private setCache(key: string, data: Holiday[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.cacheTtl
    });
  }
} 