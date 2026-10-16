/**
 * 台灣假期資料服務
 * 
 * 負責從 TaiwanCalendar CDN 獲取假期資料，提供快取機制和完整的錯誤處理
 */

import {
  Holiday,
  HolidayStats,
  WorkdaysStats,
  WorkdaysMonthResult,
  WorkdaysRangeResult,
  NextHolidaysResult,
  MakeupWorkday,
  ErrorType,
  MIN_SUPPORTED_YEAR,
  getMaxQueryableYear,
  getQueryableYearRange,
  getCurrentYearInTaipei,
  HOLIDAY_TYPES
} from './types.js';
import {
  parseDate,
  ParsedDate,
  DateParseError,
  formatDate,
  addDays,
  inclusiveDaysBetween,
  compareDates,
  getTodayInTaipei,
  getDaysInMonth,
} from './utils/date-parser.js';
import { CircuitBreaker, CircuitBreakerOptions, CircuitBreakerError } from './utils/circuit-breaker.js';
import { ErrorClassifier, ErrorCategory } from './utils/error-classifier.js';
import { RequestThrottler, ThrottleOptions } from './utils/request-throttler.js';
import { SmartCache, SmartCacheOptions } from './utils/smart-cache.js';

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

/** 年份探測結果的存活時間 */
const AVAILABLE_YEARS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * `next` 的搜尋窗與 CLI 相同：從起算日往後 365 天，
 * 且不超過上游實際有資料的最後一年 12/31。
 */
const NEXT_HOLIDAY_SEARCH_DAYS = 365;

/** 單次最多回傳的假期數（約一年的每日一筆） */
const MAX_NEXT_HOLIDAY_COUNT = 366;

/**
 * 一般週末：週六日且說明為空或只是「週末」。
 * 週六日但有具名假日（例如春節）不是一般週末。
 */
function isRegularWeekend(holiday: Holiday): boolean {
  const description = holiday.description || '';
  return (holiday.week === '六' || holiday.week === '日')
    && (description === '' || description === '週末');
}

function toIsoDate(normalized: string): string {
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
}

function rethrowDateParseError(error: unknown): never {
  if (error instanceof DateParseError) {
    throw new HolidayServiceError(
      `日期解析錯誤: ${error.message}`,
      error.type,
      error
    );
  }
  throw error;
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
  
  /** 智慧快取系統 */
  private readonly smartCache: SmartCache<Holiday[]>;
  /** 年份探測結果（smartCache 的型別是 Holiday[]，放不進來） */
  private availableYearsCache?: { years: number[]; fetchedAt: number };
  
  /** Circuit Breaker */
  private readonly circuitBreaker: CircuitBreaker;
  
  /** Request Throttler */
  private readonly requestThrottler: RequestThrottler;
  
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
    
    // 初始化智慧快取
    const cacheOptions: SmartCacheOptions = {
      maxSize: 100,              // 最大 100 個快取項目
      defaultTtl: cacheTtl,      // 使用傳入的 TTL
      statsWindow: 300000,       // 5 分鐘統計視窗
      autoCleanup: true,         // 啟用自動清理
      cleanupInterval: 600000,   // 10 分鐘清理一次
    };
    this.smartCache = new SmartCache<Holiday[]>(cacheOptions);
    
    // 初始化 Circuit Breaker
    const circuitBreakerOptions: CircuitBreakerOptions = {
      failureThreshold: 5,      // 5 次失敗後開啟
      recoveryTimeout: 30000,   // 30 秒後嘗試恢復
      monitoringPeriod: 60000,  // 監控 60 秒
      isExpectedError: (error) => {
        // 「年份層面的問題」是正常使用情境，不是服務故障：
        // 查詢尚未發布的年度（例如年末規劃明年）會拿到 404，若把它算成
        // 斷路器失敗，連續 5 次就會開啟斷路器，之後連有資料的有效年份
        // 都被拒絕 —— 使用者的正常操作被轉成服務中斷。
        //
        // 不改 ErrorClassifier：它被其他呼叫端共用，而且它只用訊息字串
        // 比對（'validation' / 'invalid'），把中文訊息歸為 TEMPORARY。
        // 這裡的政策屬於斷路器，就放在斷路器的設定上。
        if (error instanceof HolidayServiceError && error.type === ErrorType.INVALID_YEAR) {
          return true;
        }
        const classification = ErrorClassifier.classify(error);
        return classification.category === ErrorCategory.EXPECTED;
      }
    };
    this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
    
    // 初始化 Request Throttler
    const throttleOptions: ThrottleOptions = {
      maxRequestsPerSecond: 10,  // 每秒最多 10 個請求
      maxQueueSize: 50,          // 最大佇列 50 個請求
      requestTimeout: 30000,     // 請求超時 30 秒
      enableBackpressure: true   // 啟用背壓處理
    };
    this.requestThrottler = new RequestThrottler(throttleOptions);
  }

  /**
   * 探測上游實際有哪些年份的資料。
   *
   * 2017 到今年視為必然存在（上游維護完整歷史），
   * 今年之後逐年往前探測，遇到第一個缺漏就停。
   */
  async getAvailableYears(): Promise<number[]> {
    const cached = this.availableYearsCache;
    if (cached && Date.now() - cached.fetchedAt < AVAILABLE_YEARS_TTL_MS) {
      return cached.years;
    }

    const currentYear = getCurrentYearInTaipei();
    const years: number[] = [];

    for (let year = MIN_SUPPORTED_YEAR; year <= currentYear; year++) {
      years.push(year);
    }

    const maxYear = getMaxQueryableYear();
    for (let year = currentYear + 1; year <= maxYear; year++) {
      if (!(await this.isYearAvailable(year))) {
        break;
      }
      years.push(year);
    }

    this.availableYearsCache = { years, fetchedAt: Date.now() };
    return years;
  }

  /**
   * 上游是否有這一年的資料。
   *
   * 只有 404 代表「上游確定沒有這一年」。網路故障、超時、5xx 一律往外拋 ——
   * 把它們也當成 404 的話，斷網時會安靜地回報一個較短的年份範圍，
   * 那是個看起來完全正常的錯誤答案，比明確失敗糟得多。
   *
   * 用 HEAD 而非 GET：只需要知道檔案存不存在，與 CLI 端的探測保持一致。
   */
  private async isYearAvailable(year: number): Promise<boolean> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/${year}.json`,
      this.options.timeout!,
      'HEAD'
    );
    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw new HolidayServiceError(
        `探測 ${year} 年時上游回應 HTTP ${response.status}`,
        ErrorType.API_ERROR
      );
    }
    return true;
  }

  /**
   * 獲取指定年份的假期資料
   */
  async getHolidaysForYear(year: number): Promise<Holiday[]> {
    // 只擋荒謬輸入；該年份有沒有資料由上游回答
    const { start, end } = getQueryableYearRange();
    if (year < start || year > end) {
      throw new HolidayServiceError(
        `年份 ${year} 超出可查詢範圍 (${start}-${end})`,
        ErrorType.INVALID_YEAR
      );
    }

    const cacheKey = `holidays_${year}`;
    
    // 檢查智慧快取
    const cached = this.smartCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 使用 Circuit Breaker 和 Throttler 保護的請求
      const holidays = await this.circuitBreaker.execute(async () => {
        return await this.requestThrottler.throttle(async () => {
          return await this.fetchHolidaysFromCdn(year);
        });
      });
      
      // 驗證資料格式
      this.validateHolidayData(holidays);
      
      // 存入智慧快取
      this.smartCache.set(cacheKey, holidays);
      
      return holidays;
    } catch (error) {
      // 使用錯誤分類器進行分類處理
      const classification = ErrorClassifier.classify(error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof HolidayServiceError) {
        throw error;
      }
      
      if (error instanceof CircuitBreakerError) {
        throw new HolidayServiceError(
          `服務暫時不可用 (Circuit Breaker 開啟): ${error.message}`,
          ErrorType.API_ERROR,
          error
        );
      }
      
      // 根據分類決定錯誤類型
      const errorType = classification.type;
      const errorMessage = `獲取 ${year} 年假期資料失敗: ${error instanceof Error ? error.message : String(error)}`;
      
      throw new HolidayServiceError(
        errorMessage,
        errorType,
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
   * 取得起算日之後的接下來 N 個假期。
   *
   * 語意對齊 taiwan-holiday-cli 的 `holiday next`：
   * - 起算日當天即使是假期也不算（嚴格大於 fromDate）
   * - 未給日期時用台北時區的今天
   * - 搜尋上限為起算日後 365 天，且不超過上游最後一個有資料的年份
   * - skipWeekends 略過一般週末，保留具名假日
   * - 一般週末的空 description 在輸出中顯示為「週末」
   */
  async getNextHolidays(options: {
    fromDate?: string;
    count?: number;
    skipWeekends?: boolean;
  } = {}): Promise<NextHolidaysResult> {
    const count = options.count ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > MAX_NEXT_HOLIDAY_COUNT) {
      throw new HolidayServiceError(
        `count 必須是 1 到 ${MAX_NEXT_HOLIDAY_COUNT} 的整數`,
        ErrorType.VALIDATION_ERROR
      );
    }

    try {
      const from = options.fromDate ? parseDate(options.fromDate) : getTodayInTaipei();
      const fromIso = formatDate(from, 'YYYY-MM-DD');
      const empty = (message: string): NextHolidaysResult => ({
        found: false,
        count: 0,
        fromDate: fromIso,
        holidays: [],
        message,
      });

      const availableYears = await this.getAvailableYears();
      if (availableYears.length === 0) {
        return empty('查無假期');
      }

      const maxYear = availableYears[availableYears.length - 1];
      const cap = parseDate(`${maxYear}1231`);
      const horizon = addDays(from, NEXT_HOLIDAY_SEARCH_DAYS);
      const end = compareDates(horizon, cap) > 0 ? cap : horizon;

      if (compareDates(end, from) <= 0) {
        return empty('查無假期');
      }

      const holidays = await this.getHolidaysInRange(
        formatDate(from, 'YYYY-MM-DD'),
        formatDate(end, 'YYYY-MM-DD')
      );

      const selected: Holiday[] = [];
      for (const holiday of holidays) {
        if (!holiday.isHoliday || holiday.date <= from.normalized) {
          continue;
        }
        if (options.skipWeekends && isRegularWeekend(holiday)) {
          continue;
        }
        selected.push(holiday);
        if (selected.length >= count) {
          break;
        }
      }

      if (selected.length === 0) {
        return empty('查無假期');
      }

      return {
        found: true,
        count: selected.length,
        fromDate: fromIso,
        holidays: selected.map((holiday) => ({
          date: toIsoDate(holiday.date),
          week: holiday.week,
          description: holiday.description || '週末',
        })),
      };
    } catch (error) {
      rethrowDateParseError(error);
    }
  }

  /**
   * 計算指定月份的工作天。
   * 語意對齊 CLI `holiday workdays`：總天數是該月日曆天數，不是資料筆數。
   */
  async getWorkdaysStats(year: number, month: number): Promise<WorkdaysMonthResult> {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new HolidayServiceError(
        `無效的月份: ${month}，月份必須在 1-12 之間`,
        ErrorType.INVALID_MONTH
      );
    }

    const holidays = await this.getHolidaysForYear(year);
    const monthStr = month.toString().padStart(2, '0');
    const inMonth = holidays.filter((holiday) => holiday.date.substring(4, 6) === monthStr);

    return {
      year,
      month,
      ...this.calculateWorkdays(getDaysInMonth(year, month), inMonth),
    };
  }

  /**
   * 計算兩日期間的工作天（含起迄日）。
   * 語意對齊 CLI `holiday between`。
   */
  async getWorkdaysBetween(startDate: string, endDate: string): Promise<WorkdaysRangeResult> {
    try {
      const start = parseDate(startDate);
      const end = parseDate(endDate);

      if (compareDates(start, end) > 0) {
        throw new HolidayServiceError(
          `開始日期 ${startDate} 不能晚於結束日期 ${endDate}`,
          ErrorType.INVALID_DATE
        );
      }

      const inRange = await this.getHolidaysInRange(startDate, endDate);
      return {
        startDate: formatDate(start, 'YYYY-MM-DD'),
        endDate: formatDate(end, 'YYYY-MM-DD'),
        ...this.calculateWorkdays(inclusiveDaysBetween(start, end), inRange),
      };
    } catch (error) {
      rethrowDateParseError(error);
    }
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    this.smartCache.clear();
    this.availableYearsCache = undefined;
  }


  /**
   * 從 CDN 獲取假期資料
   */
  private async fetchHolidaysFromCdn(year: number): Promise<Holiday[]> {
    const url = `${this.baseUrl}/${year}.json`;
    
    let lastError: Error | undefined;
    let currentDelay = this.options.retryDelay!;
    
    for (let attempt = 0; attempt <= this.options.retries!; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, this.options.timeout!);

        // 404 代表上游確定沒有這一年，重試無意義。
        //
        // 但兩種 404 的性質完全不同，錯誤型別也必須不同：
        // - 未來年度尚未發布 → INVALID_YEAR，正常使用情境，斷路器不計入
        // - 已發布年度資料消失 → API_ERROR，上游異常，斷路器**要**計入
        //
        // 若後者也標成 INVALID_YEAR，上游整批資料消失時斷路器不會開，
        // 服務會持續對每個請求打一次注定失敗的網路。
        if (response.status === 404) {
          if (year > getCurrentYearInTaipei()) {
            throw new HolidayServiceError(
              `上游尚未發布 ${year} 年資料。中華民國政府行政機關辦公日曆表通常在前一年年中公布。`,
              ErrorType.INVALID_YEAR
            );
          }
          throw new HolidayServiceError(
            `上游缺少 ${year} 年資料。該年度應已發布，可能是上游資料異常，請回報 ruyut/TaiwanCalendar。`,
            ErrorType.API_ERROR
          );
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
          throw new Error('回應資料格式錯誤：預期為陣列');
        }
        
        return data as Holiday[];
      } catch (error) {
        // 這個 try 區塊裡的 HolidayServiceError 全都來自 404 分支 —— 那是上游的
        // 確定性答案（無論「尚未發布」或「已發布卻消失」），重試與包裝都只會
        // 模糊掉原因。型別差異（INVALID_YEAR / API_ERROR）留給斷路器判斷是否計入。
        if (error instanceof HolidayServiceError) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        // 使用錯誤分類器決定是否應該重試
        const classification = ErrorClassifier.classify(lastError);
        
        if (!classification.retryStrategy.shouldRetry) {
          throw new HolidayServiceError(
            `請求失敗，錯誤不可重試: ${lastError.message}`,
            classification.type,
            lastError
          );
        }
        
        // 如果不是最後一次嘗試，使用指數退避等待後重試
        if (attempt < this.options.retries!) {
          const retryDelay = Math.min(
            currentDelay * Math.pow(classification.retryStrategy.backoffMultiplier, attempt),
            classification.retryStrategy.maxDelay
          );
          await this.delay(retryDelay);
          currentDelay = retryDelay;
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
  private async fetchWithTimeout(
    url: string,
    timeout: number,
    method: 'GET' | 'HEAD' = 'GET'
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
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
   * 計算工作天。補班日以 description 含「補行上班」認定，與 CLI 相同。
   */
  private calculateWorkdays(totalDays: number, records: Holiday[]): WorkdaysStats {
    let holidays = 0;
    const makeupWorkdayDates: MakeupWorkday[] = [];

    for (const record of records) {
      if (record.isHoliday) {
        holidays++;
      }
      if (record.description.includes('補行上班')) {
        makeupWorkdayDates.push({
          date: toIsoDate(record.date),
          week: record.week,
          description: record.description,
        });
      }
    }

    return {
      totalDays,
      workdays: totalDays - holidays,
      holidays,
      makeupWorkdays: makeupWorkdayDates.length,
      makeupWorkdayDates,
    };
  }

  /**
   * 計算假期統計
   */
  private calculateStats(year: number, holidays: Holiday[]): HolidayStats {
    const holidayTypes: Record<string, number> = {};
    let totalHolidays = 0;
    let nationalHolidays = 0;
    let weekends = 0;
    let compensatoryDays = 0;
    let adjustedHolidays = 0;
    let workingDays = 0;

    for (const holiday of holidays) {
      if (holiday.isHoliday) {
        totalHolidays++;

        // 分析假日類型
        const description = holiday.description.toLowerCase();
        let categoryKey: string;

        if (description.includes('補假')) {
          compensatoryDays++;
          categoryKey = HOLIDAY_TYPES.COMPENSATORY;
        } else if (description.includes('調整放假')) {
          adjustedHolidays++;
          categoryKey = HOLIDAY_TYPES.ADJUSTED;
        } else if (!holiday.description) {
          // 上游把一般週末的 description 留空。這些日子過去被算進
          // nationalHolidays，導致 2026 年回報 114 個「國定假日」
          // （實際具名國定假日只有 16 個，其餘 98 個是週末）。
          weekends++;
          categoryKey = HOLIDAY_TYPES.WEEKEND;
        } else {
          nationalHolidays++;
          categoryKey = HOLIDAY_TYPES.NATIONAL;
        }
        holidayTypes[categoryKey] = (holidayTypes[categoryKey] || 0) + 1;

        // 記錄具體假日類型；描述與分類桶同名時（例如「補假」）不重複計
        if (holiday.description && holiday.description !== categoryKey) {
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
      weekends,
      compensatoryDays,
      adjustedHolidays,
      workingDays,
      holidayTypes
    };
  }


  /**
   * 獲取 Circuit Breaker 統計資訊
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * 獲取 Request Throttler 統計資訊
   */
  getThrottlerStats() {
    return this.requestThrottler.getStats();
  }

  /**
   * 獲取智慧快取統計資訊
   */
  getCacheStats() {
    return this.smartCache.getStats();
  }

  /**
   * 清理過期快取
   */
  clearExpiredCache(): number {
    return this.smartCache.cleanup();
  }

  /**
   * 手動重置 Circuit Breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.forceReset();
  }

  /**
   * 銷毀服務並清理資源
   */
  destroy(): void {
    this.smartCache.destroy();
    this.requestThrottler.stop();
  }
} 