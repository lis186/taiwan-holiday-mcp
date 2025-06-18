/**
 * Enhanced Error Classification System
 * 
 * 對錯誤進行分類並提供相應的處理策略
 */

import { ErrorType } from '../types.js';

export enum ErrorCategory {
  /** 暫時性錯誤，可以重試 */
  TEMPORARY = 'TEMPORARY',
  /** 永久性錯誤，不應重試 */
  PERMANENT = 'PERMANENT',
  /** 關鍵錯誤，需要立即處理 */
  CRITICAL = 'CRITICAL',
  /** 預期錯誤，正常業務邏輯 */
  EXPECTED = 'EXPECTED'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface RetryStrategy {
  /** 是否應該重試 */
  shouldRetry: boolean;
  /** 最大重試次數 */
  maxRetries: number;
  /** 重試延遲 (ms) */
  retryDelay: number;
  /** 退避倍數 */
  backoffMultiplier: number;
  /** 最大延遲 (ms) */
  maxDelay: number;
}

export interface ErrorClassification {
  /** 錯誤類別 */
  category: ErrorCategory;
  /** 嚴重程度 */
  severity: ErrorSeverity;
  /** 錯誤類型 */
  type: ErrorType;
  /** 重試策略 */
  retryStrategy: RetryStrategy;
  /** 是否需要警報 */
  needsAlert: boolean;
  /** 錯誤描述 */
  description: string;
}

/**
 * 錯誤分類器
 */
export class ErrorClassifier {
  private static readonly HTTP_TEMPORARY_ERRORS = [
    408, // Request Timeout
    429, // Too Many Requests
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    507, // Insufficient Storage
    509, // Bandwidth Limit Exceeded
  ];

  private static readonly HTTP_PERMANENT_ERRORS = [
    400, // Bad Request
    401, // Unauthorized
    403, // Forbidden
    404, // Not Found
    405, // Method Not Allowed
    406, // Not Acceptable
    409, // Conflict
    410, // Gone
    413, // Payload Too Large
    414, // URI Too Long
    415, // Unsupported Media Type
    422, // Unprocessable Entity
  ];

  /**
   * 分類錯誤
   */
  static classify(error: Error): ErrorClassification {
    // 網路錯誤
    if (this.isNetworkError(error)) {
      return this.classifyNetworkError(error);
    }

    // HTTP 錯誤
    if (this.isHttpError(error)) {
      return this.classifyHttpError(error);
    }

    // 解析錯誤
    if (this.isParseError(error)) {
      return this.classifyParseError(error);
    }

    // 驗證錯誤
    if (this.isValidationError(error)) {
      return this.classifyValidationError(error);
    }

    // 超時錯誤
    if (this.isTimeoutError(error)) {
      return this.classifyTimeoutError(error);
    }

    // 系統錯誤
    if (this.isSystemError(error)) {
      return this.classifySystemError(error);
    }

    // 預設分類
    return this.getDefaultClassification(error);
  }

  /**
   * 檢查是否為網路錯誤
   */
  private static isNetworkError(error: Error): boolean {
    const networkErrorCodes = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
    return networkErrorCodes.some(code => error.message.includes(code));
  }

  /**
   * 分類網路錯誤
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static classifyNetworkError(_error: Error): ErrorClassification {
    return {
      category: ErrorCategory.TEMPORARY,
      severity: ErrorSeverity.MEDIUM,
      type: ErrorType.NETWORK_ERROR,
      retryStrategy: {
        shouldRetry: true,
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 10000,
      },
      needsAlert: false,
      description: '網路連線錯誤，將自動重試',
    };
  }

  /**
   * 檢查是否為 HTTP 錯誤
   */
  private static isHttpError(error: Error): boolean {
    return error.message.includes('HTTP') || /^\d{3}/.test(error.message);
  }

  /**
   * 分類 HTTP 錯誤
   */
  private static classifyHttpError(error: Error): ErrorClassification {
    const statusMatch = error.message.match(/(\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 500;

    if (this.HTTP_TEMPORARY_ERRORS.includes(status)) {
      return {
        category: ErrorCategory.TEMPORARY,
        severity: status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
        type: ErrorType.API_ERROR,
        retryStrategy: {
          shouldRetry: true,
          maxRetries: status === 429 ? 2 : 3,
          retryDelay: status === 429 ? 5000 : 2000,
          backoffMultiplier: 2,
          maxDelay: 30000,
        },
        needsAlert: status >= 500,
        description: `HTTP ${status} 錯誤，將自動重試`,
      };
    }

    if (this.HTTP_PERMANENT_ERRORS.includes(status)) {
      return {
        category: ErrorCategory.PERMANENT,
        severity: ErrorSeverity.MEDIUM,
        type: ErrorType.API_ERROR,
        retryStrategy: {
          shouldRetry: false,
          maxRetries: 0,
          retryDelay: 0,
          backoffMultiplier: 1,
          maxDelay: 0,
        },
        needsAlert: false,
        description: `HTTP ${status} 錯誤，不會重試`,
      };
    }

    // 5xx 伺服器錯誤
    if (status >= 500) {
      return {
        category: ErrorCategory.TEMPORARY,
        severity: ErrorSeverity.HIGH,
        type: ErrorType.API_ERROR,
        retryStrategy: {
          shouldRetry: true,
          maxRetries: 2,
          retryDelay: 3000,
          backoffMultiplier: 2,
          maxDelay: 15000,
        },
        needsAlert: true,
        description: `HTTP ${status} 伺服器錯誤，將重試`,
      };
    }

    return this.getDefaultClassification(error);
  }

  /**
   * 檢查是否為解析錯誤
   */
  private static isParseError(error: Error): boolean {
    return error.name.includes('Parse') || error.message.includes('parse') || error.message.includes('JSON');
  }

  /**
   * 分類解析錯誤
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static classifyParseError(_error: Error): ErrorClassification {
    return {
      category: ErrorCategory.TEMPORARY,
      severity: ErrorSeverity.MEDIUM,
      type: ErrorType.PARSE_ERROR,
      retryStrategy: {
        shouldRetry: true,
        maxRetries: 1,
        retryDelay: 1000,
        backoffMultiplier: 1,
        maxDelay: 1000,
      },
      needsAlert: false,
      description: '資料解析錯誤，可能是暫時性問題',
    };
  }

  /**
   * 檢查是否為驗證錯誤
   */
  private static isValidationError(error: Error): boolean {
    return error.name.includes('Validation') || error.message.includes('validation') || error.message.includes('invalid');
  }

  /**
   * 分類驗證錯誤
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static classifyValidationError(_error: Error): ErrorClassification {
    return {
      category: ErrorCategory.EXPECTED,
      severity: ErrorSeverity.LOW,
      type: ErrorType.VALIDATION_ERROR,
      retryStrategy: {
        shouldRetry: false,
        maxRetries: 0,
        retryDelay: 0,
        backoffMultiplier: 1,
        maxDelay: 0,
      },
      needsAlert: false,
      description: '輸入驗證錯誤，請檢查參數格式',
    };
  }

  /**
   * 檢查是否為超時錯誤
   */
  private static isTimeoutError(error: Error): boolean {
    return error.message.includes('timeout') || error.message.includes('ETIMEDOUT');
  }

  /**
   * 分類超時錯誤
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static classifyTimeoutError(_error: Error): ErrorClassification {
    return {
      category: ErrorCategory.TEMPORARY,
      severity: ErrorSeverity.MEDIUM,
      type: ErrorType.TIMEOUT_ERROR,
      retryStrategy: {
        shouldRetry: true,
        maxRetries: 2,
        retryDelay: 2000,
        backoffMultiplier: 2,
        maxDelay: 8000,
      },
      needsAlert: false,
      description: '請求超時，將自動重試',
    };
  }

  /**
   * 檢查是否為系統錯誤
   */
  private static isSystemError(error: Error): boolean {
    return error.name === 'Error' && (
      error.message.includes('memory') ||
      error.message.includes('EMFILE') ||
      error.message.includes('ENOMEM')
    );
  }

  /**
   * 分類系統錯誤
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static classifySystemError(_error: Error): ErrorClassification {
    return {
      category: ErrorCategory.CRITICAL,
      severity: ErrorSeverity.CRITICAL,
      type: ErrorType.SYSTEM_ERROR,
      retryStrategy: {
        shouldRetry: false,
        maxRetries: 0,
        retryDelay: 0,
        backoffMultiplier: 1,
        maxDelay: 0,
      },
      needsAlert: true,
      description: '系統錯誤，需要立即處理',
    };
  }

  /**
   * 獲取預設分類
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static getDefaultClassification(_error: Error): ErrorClassification {
    return {
      category: ErrorCategory.TEMPORARY,
      severity: ErrorSeverity.MEDIUM,
      type: ErrorType.UNKNOWN_ERROR,
      retryStrategy: {
        shouldRetry: true,
        maxRetries: 1,
        retryDelay: 1000,
        backoffMultiplier: 1,
        maxDelay: 1000,
      },
      needsAlert: false,
      description: '未知錯誤，將嘗試重試一次',
    };
  }
}