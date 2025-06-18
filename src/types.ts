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
 * 假日統計資料介面
 */
export interface HolidayStats {
  /** 年份 */
  year: number;
  /** 總假日天數 */
  totalHolidays: number;
  /** 國定假日天數 */
  nationalHolidays: number;
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
 * 支援的年份範圍常數
 */
export const SUPPORTED_YEAR_RANGE: YearRange = {
  start: 2017,
  end: 2025
};

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