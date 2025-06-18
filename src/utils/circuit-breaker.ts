/**
 * Circuit Breaker Pattern Implementation
 * 
 * 防止對失敗服務的重複請求，提供降級機制
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // 正常狀態
  OPEN = 'OPEN',         // 斷路狀態
  HALF_OPEN = 'HALF_OPEN' // 半開狀態（測試恢復）
}

export interface CircuitBreakerOptions {
  /** 失敗閾值 */
  failureThreshold: number;
  /** 恢復超時時間 (ms) */
  recoveryTimeout: number;
  /** 監控時間窗口 (ms) */
  monitoringPeriod: number;
  /** 預期錯誤檢查函數 */
  isExpectedError?: (error: Error) => boolean;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  nextAttempt: number;
  totalRequests: number;
}

/**
 * Circuit Breaker 實作
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttempt: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime: number = 0;

  constructor(private readonly options: CircuitBreakerOptions) {
    if (options.failureThreshold <= 0) {
      throw new Error('failureThreshold must be greater than 0');
    }
    if (options.recoveryTimeout <= 0) {
      throw new Error('recoveryTimeout must be greater than 0');
    }
  }

  /**
   * 執行受保護的函數
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.totalRequests++;

      if (this.state === CircuitState.OPEN) {
        if (this.shouldAttemptReset()) {
          this.state = CircuitState.HALF_OPEN;
        } else {
          return reject(new CircuitBreakerError('Circuit breaker is OPEN', this.getStats()));
        }
      }

      fn()
        .then((result) => {
          this.onSuccess();
          resolve(result);
        })
        .catch((error) => {
          this.onFailure(error);
          reject(error);
        });
    });
  }

  /**
   * 成功回調
   */
  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.reset();
    }
  }

  /**
   * 失敗回調
   */
  private onFailure(error: Error): void {
    // 檢查是否為預期錯誤（不計入失敗）
    if (this.options.isExpectedError && this.options.isExpectedError(error)) {
      return;
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;
    }
  }

  /**
   * 重置 Circuit Breaker
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.nextAttempt = 0;
  }

  /**
   * 檢查是否應該嘗試重置
   */
  private shouldAttemptReset(): boolean {
    return Date.now() >= this.nextAttempt;
  }

  /**
   * 獲取統計資訊
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      totalRequests: this.totalRequests,
    };
  }

  /**
   * 手動重置
   */
  forceReset(): void {
    this.reset();
  }

  /**
   * 手動開啟
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.recoveryTimeout;
  }
}

/**
 * Circuit Breaker 錯誤
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}