/**
 * 台灣行政機關辦公日曆 MCP 伺服器核心型別定義
 * 
 * 此檔案定義了與 TaiwanCalendar 資料格式一致的型別，
 * 以及 MCP 工具回傳格式和錯誤處理相關型別。
 */

/**
 * 假日資料介面 - 與 TaiwanCalendar 格式一致
 * 
 * 資料來源格式範例：
 * {
 *   "date": "20240101",
 *   "week": "一",
 *   "isHoliday": true,
 *   "description": "開國紀念日"
 * }
 */
export interface Holiday {
  /** 日期，格式為 YYYYMMDD */
  date: string;
  /** 星期幾，中文表示（一、二、三、四、五、六、日） */
  week: string;
  /** 是否為假日 */
  isHoliday: boolean;
  /** 假日說明，如果不是假日則為空字串 */
  description: string;
}

/**
 * 補班日（補行上班）明細。
 * 日期使用 YYYY-MM-DD，與 taiwan-holiday-cli 的 JSON 輸出一致。
 */
export interface MakeupWorkday {
  /** 日期，YYYY-MM-DD */
  date: string;
  /** 星期幾，中文表示 */
  week: string;
  /** 上游說明，含「補行上班」 */
  description: string;
}

/**
 * 工作天統計。
 *
 * 語意對齊 taiwan-holiday-cli 的 `holiday workdays` / `holiday between`：
 * - `holidays` 含週末與國定假日（isHoliday === true）
 * - `workdays = totalDays - holidays`
 * - 補班日（description 含「補行上班」）本來就不是假期，已計入 workdays，
 *   `makeupWorkdays` 只是另外點名，不會再加一次
 */
export interface WorkdaysStats {
  /** 總天數（月份為該月天數；區間含起迄日） */
  totalDays: number;
  /** 工作天數 */
  workdays: number;
  /** 假期天數（含週末） */
  holidays: number;
  /** 補班天數 */
  makeupWorkdays: number;
  /** 補班日明細，筆數等於 makeupWorkdays */
  makeupWorkdayDates: MakeupWorkday[];
}

/**
 * 單月工作天統計（對應 CLI `workdays` 的 JSON 欄位）
 */
export interface WorkdaysMonthResult extends WorkdaysStats {
  year: number;
  month: number;
}

/**
 * 日期區間工作天統計（對應 CLI `between` 的 JSON 欄位）
 */
export interface WorkdaysRangeResult extends WorkdaysStats {
  /** 開始日期，YYYY-MM-DD */
  startDate: string;
  /** 結束日期，YYYY-MM-DD */
  endDate: string;
}

/**
 * 下一個假期的一筆結果（對應 CLI `next` JSON 的 holidays[] 元素）
 */
export interface NextHolidayItem {
  /** 日期，YYYY-MM-DD */
  date: string;
  /** 星期幾，中文表示 */
  week: string;
  /** 假日說明；上游留空的一般週末為「週末」 */
  description: string;
}

/**
 * 接下來 N 個假期（對應 CLI `next` 多筆 JSON）
 */
export interface NextHolidaysResult {
  /** 是否找到至少一個假期 */
  found: boolean;
  /** 實際回傳的假期數（不一定等於要求的 N） */
  count: number;
  /** 起算日（不含當日），YYYY-MM-DD */
  fromDate: string;
  /**
   * 這次實際搜尋到的最後一天（YYYY-MM-DD）。
   * 是 365 天視窗與上游最後一個已發布年度 12/31 較早的那天。
   */
  searchedThrough: string;
  /**
   * 365 天視窗超出上游已發布資料，搜尋被截到最後一個已發布年度。
   * 回傳筆數少於要求的 N 時，不代表後面沒有假期。
   */
  truncatedByData: boolean;
  holidays: NextHolidayItem[];
  /** 找不到時的說明 */
  message?: string;
}

/**
 * 假日統計資料介面
 */
export interface HolidayStats {
  /** 年份 */
  year: number;
  /** 總假日天數 */
  totalHolidays: number;
  /** 國定假日天數 */
  nationalHolidays: number;
  /** 一般週末天數（上游 description 為空的放假日） */
  weekends: number;
  /** 補假天數 */
  compensatoryDays: number;
  /** 調整放假天數 */
  adjustedHolidays: number;
  /** 補班天數 */
  workingDays: number;
  /** 假日類型分布 */
  holidayTypes: Record<string, number>;
}

/**
 * 日期格式驗證型別
 */
export type DateFormat = 'YYYYMMDD' | 'YYYY-MM-DD' | 'YYYY/MM/DD';

/**
 * 年份範圍型別
 */
export type YearRange = {
  start: number;
  end: number;
};

/**
 * 查詢參數介面
 */
export interface QueryParams {
  /** 年份 */
  year?: number;
  /** 月份 (1-12) */
  month?: number;
  /** 日期 (1-31) */
  day?: number;
  /** 是否只查詢假日 */
  holidaysOnly?: boolean;
  /** 日期格式 */
  dateFormat?: DateFormat;
}

/**
 * MCP 工具回傳結果基礎介面
 */
export interface MCPToolResult<T = any> {
  /** 是否成功 */
  success: boolean;
  /** 回傳資料 */
  data?: T;
  /** 錯誤訊息 */
  error?: string;
  /** 額外的中繼資料 */
  metadata?: Record<string, any>;
}

/**
 * 假日查詢結果介面
 */
export interface HolidayQueryResult extends MCPToolResult<Holiday[]> {
  /** 查詢的年份 */
  year: number;
  /** 查詢的月份（可選） */
  month?: number;
  /** 總筆數 */
  totalCount: number;
  /** 假日筆數 */
  holidayCount: number;
}

/**
 * 假日統計查詢結果介面
 */
export interface HolidayStatsResult extends MCPToolResult<HolidayStats> {
  /** 統計的年份 */
  year: number;
}

/**
 * 錯誤型別列舉
 */
export enum ErrorType {
  /** 無效的年份 */
  INVALID_YEAR = 'INVALID_YEAR',
  /** 無效的月份 */
  INVALID_MONTH = 'INVALID_MONTH',
  /** 無效的日期 */
  INVALID_DATE = 'INVALID_DATE',
  /** 無效的日期格式 */
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  /** 資料不存在 */
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  /** 網路錯誤 */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 解析錯誤 */
  PARSE_ERROR = 'PARSE_ERROR',
  /** API 錯誤 */
  API_ERROR = 'API_ERROR',
  /** 超時錯誤 */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  /** 驗證錯誤 */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** 系統錯誤 */
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  /** 未知錯誤 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 錯誤詳情介面
 */
export interface ErrorDetail {
  /** 錯誤型別 */
  type: ErrorType;
  /** 錯誤訊息 */
  message: string;
  /** 錯誤代碼 */
  code?: string;
  /** 額外的錯誤資訊 */
  details?: Record<string, any>;
}

/**
 * MCP 工具錯誤介面
 */
export interface MCPToolError {
  /** 錯誤詳情 */
  error: ErrorDetail;
  /** 時間戳記 */
  timestamp: string;
  /** 請求 ID（用於追蹤） */
  requestId?: string;
}

/**
 * 上游資料最早提供的年份（ruyut/TaiwanCalendar 從 2017 開始）
 */
export const MIN_SUPPORTED_YEAR = 2017;

/**
 * 台北時區「現在」的年／月／日。
 *
 * 刻意回傳分量而非 Date：位移過的 Date 不是真實 instant，
 * 呼叫端若用 `getFullYear()`（本地時區）讀取就會拿到錯的值。
 * 回傳純數字讓誤用不可能發生。
 *
 * 台灣不實施日光節約時間，固定 UTC+8 即可。
 * 這是全專案唯一計算台北時間的地方 —— 偏移量寫在兩處就會漂移。
 */
export function taipeiDateParts(now: number = Date.now()): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = new Date(now + 8 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * 取得台北時區的當前年份。
 *
 * 不能用 `new Date().getFullYear()` —— 那是主機時區。UTC 主機在台灣
 * 跨年後的 8 小時內會回報前一年，導致「未來年度／歷史年度」判斷錯位。
 */
export function getCurrentYearInTaipei(): number {
  return taipeiDateParts().year;
}

/**
 * 合理性上限：避免荒謬的年份輸入白跑一趟網路請求。
 *
 * 這不是能力上限 —— 某年份能不能查，取決於上游有沒有那筆資料，
 * 由實際抓取的結果決定，不由本套件的版本決定。
 */
export function getMaxQueryableYear(): number {
  return getCurrentYearInTaipei() + 5;
}

/**
 * 可查詢的年份範圍。
 *
 * JSON Schema、參數驗證、資源 URI 驗證共用這一個來源，
 * 避免三處各自寫死而不同步。
 */
export function getQueryableYearRange(): YearRange {
  return { start: MIN_SUPPORTED_YEAR, end: getMaxQueryableYear() };
}

/**
 * 預設日期格式
 */
export const DEFAULT_DATE_FORMAT: DateFormat = 'YYYYMMDD';

/**
 * 星期對應表
 */
export const WEEK_MAPPING: Record<string, number> = {
  '日': 0,
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6
};

/**
 * 常見假日類型
 */
export const HOLIDAY_TYPES = {
  NATIONAL: '國定假日',
  WEEKEND: '週末',
  COMPENSATORY: '補假',
  ADJUSTED: '調整放假',
  WORKING: '補行上班',
  LUNAR_NEW_YEAR: '春節',
  TOMB_SWEEPING: '清明節',
  DRAGON_BOAT: '端午節',
  MID_AUTUMN: '中秋節',
  NATIONAL_DAY: '國慶日'
} as const;

/**
 * 假日類型型別
 */
export type HolidayType = typeof HOLIDAY_TYPES[keyof typeof HOLIDAY_TYPES]; 