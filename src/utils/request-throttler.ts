/**
 * Request Throttling and Rate Limiting
 * 
 * 請求節流和速率限制，防止過度請求
 */

export interface ThrottleOptions {
  /** 每秒最大請求數 */
  maxRequestsPerSecond: number;
  /** 請求佇列最大大小 */
  maxQueueSize: number;
  /** 請求超時時間 (ms) */
  requestTimeout: number;
  /** 是否啟用背壓處理 */
  enableBackpressure: boolean;
}

export interface ThrottleStats {
  /** 當前佇列大小 */
  currentQueueSize: number;
  /** 處理中的請求數 */
  activeRequests: number;
  /** 總請求數 */
  totalRequests: number;
  /** 成功請求數 */
  successfulRequests: number;
  /** 失敗請求數 */
  failedRequests: number;
  /** 丟棄的請求數 */
  droppedRequests: number;
  /** 平均響應時間 */
  averageResponseTime: number;
}

interface QueuedRequest<T> {
  /** 請求執行函數 */
  execute: () => Promise<T>;
  /** 成功回調 */
  resolve: (value: T) => void;
  /** 失敗回調 */
  reject: (error: Error) => void;
  /** 請求時間戳 */
  timestamp: number;
  /** 請求 ID */
  id: string;
}

/**
 * 請求節流器
 */
export class RequestThrottler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private queue: QueuedRequest<any>[] = [];
  private activeRequests: number = 0;
  private lastRequestTime: number = 0;
  private requestInterval: number;
  private isProcessing: boolean = false;
  private requestCounter: number = 0;
  
  // 跟蹤所有定時器
  private timers: Set<NodeJS.Timeout> = new Set();
  
  // 統計資訊
  private stats: ThrottleStats = {
    currentQueueSize: 0,
    activeRequests: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    droppedRequests: 0,
    averageResponseTime: 0,
  };

  private responseTimes: number[] = [];

  constructor(private readonly options: ThrottleOptions) {
    this.requestInterval = 1000 / options.maxRequestsPerSecond;
    this.startProcessing();
  }

  /**
   * 創建並跟蹤定時器
   */
  private setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.isProcessing) {
        callback();
      }
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  /**
   * 清除所有定時器
   */
  private clearAllTimers(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  /**
   * 執行節流的請求
   */
  async throttle<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.stats.totalRequests++;

      // 檢查佇列是否已滿
      if (this.queue.length >= this.options.maxQueueSize) {
        this.stats.droppedRequests++;
        
        if (this.options.enableBackpressure) {
          // 背壓處理：等待佇列有空間
          this.waitForQueueSpace()
            .then(() => {
              this.enqueueRequest(execute, resolve, reject);
            })
            .catch(reject);
        } else {
          // 直接拒絕請求
          reject(new ThrottleError('Request queue is full', this.getStats()));
        }
        return;
      }

      this.enqueueRequest(execute, resolve, reject);
    });
  }

  /**
   * 將請求加入佇列
   */
  private enqueueRequest<T>(
    execute: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (error: Error) => void
  ): void {
    const request: QueuedRequest<T> = {
      execute,
      resolve,
      reject,
      timestamp: Date.now(),
      id: `req_${++this.requestCounter}`,
    };

    this.queue.push(request);
    this.stats.currentQueueSize = this.queue.length;
    
    // 如果處理循環已停止，重新啟動
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * 等待佇列有空間
   */
  private async waitForQueueSpace(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = this.setTimeout(() => {
        reject(new ThrottleError('Timeout waiting for queue space', this.getStats()));
      }, this.options.requestTimeout);

      const checkQueue = (): void => {
        if (!this.isProcessing) {
          clearTimeout(timeout);
          reject(new Error('Throttler stopped'));
          return;
        }
        if (this.queue.length < this.options.maxQueueSize) {
          clearTimeout(timeout);
          resolve();
        } else {
          // 100ms 後再次檢查
          this.setTimeout(checkQueue, 100);
        }
      };

      checkQueue();
    });
  }

  /**
   * 開始處理佇列
   */
  private startProcessing(): void {
    /* istanbul ignore next - 防禦性程式碼：enqueueRequest 只在 !isProcessing 時調用此方法 */
    if (this.isProcessing) return;
    this.isProcessing = true;

    const processNext = (): void => {
      // 檢查是否還在處理中
      if (!this.isProcessing) {
        return;
      }
      
      if (this.queue.length === 0) {
        // 佇列為空，停止處理循環
        this.isProcessing = false;
        return;
      }

      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.requestInterval) {
        // 等待到下一個允許的請求時間
        this.setTimeout(processNext, this.requestInterval - timeSinceLastRequest);
        return;
      }

      const request = this.queue.shift();
      /* istanbul ignore next - 極端邊緣案例：佇列競態導致的空 request */
      if (!request) {
        this.setTimeout(processNext, 10);
        return;
      }

      this.stats.currentQueueSize = this.queue.length;
      this.stats.activeRequests = ++this.activeRequests;
      this.lastRequestTime = now;

      // 檢查請求是否超時
      if (now - request.timestamp > this.options.requestTimeout) {
        this.stats.failedRequests++;
        this.stats.activeRequests = --this.activeRequests;
        request.reject(new ThrottleError('Request timeout', this.getStats()));
        this.setTimeout(processNext, 0);
        return;
      }

      // 執行請求
      const startTime = Date.now();
      request.execute()
        .then((result) => {
          const responseTime = Date.now() - startTime;
          this.recordResponseTime(responseTime);
          this.stats.successfulRequests++;
          this.stats.activeRequests = --this.activeRequests;
          request.resolve(result);
        })
        .catch((error) => {
          this.stats.failedRequests++;
          this.stats.activeRequests = --this.activeRequests;
          request.reject(error);
        })
        .finally(() => {
          // 原子性檢查：先檢查佇列，再決定是否繼續
          if (this.queue.length > 0 && this.isProcessing) {
            this.setTimeout(processNext, 0);
          } else {
            this.isProcessing = false;
          }
        });
    };

    processNext();
  }

  /**
   * 記錄響應時間
   */
  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    // 只保留最近 100 個響應時間
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    // 計算平均響應時間
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.stats.averageResponseTime = sum / this.responseTimes.length;
  }

  /**
   * 獲取統計資訊
   */
  getStats(): ThrottleStats {
    return {
      ...this.stats,
      activeRequests: this.activeRequests,
      currentQueueSize: this.queue.length,
    };
  }

  /**
   * 清空佇列
   */
  clearQueue(): void {
    const droppedCount = this.queue.length;
    this.queue.forEach(request => {
      request.reject(new ThrottleError('Queue cleared', this.getStats()));
    });
    this.queue = [];
    this.stats.droppedRequests += droppedCount;
    this.stats.currentQueueSize = 0;
  }

  /**
   * 停止處理
   */
  stop(): void {
    this.isProcessing = false;
    this.clearAllTimers();
    this.clearQueue();
  }

  /**
   * 重置統計資訊
   */
  resetStats(): void {
    this.stats = {
      currentQueueSize: this.queue.length,
      activeRequests: this.activeRequests,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      droppedRequests: 0,
      averageResponseTime: 0,
    };
    this.responseTimes = [];
  }
}

/**
 * 節流錯誤
 */
export class ThrottleError extends Error {
  constructor(
    message: string,
    public readonly stats: ThrottleStats
  ) {
    super(message);
    this.name = 'ThrottleError';
  }
}