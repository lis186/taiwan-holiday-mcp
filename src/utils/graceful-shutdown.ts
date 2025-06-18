/**
 * Graceful Shutdown Handler
 * 
 * 優雅關機處理，確保所有資源正確清理
 */

export interface ShutdownOptions {
  /** 優雅關機超時時間 (ms) */
  timeout: number;
  /** 是否記錄關機過程 */
  logger?: (message: string) => void;
  /** 關機前的延遲時間 (ms) */
  delay?: number;
}

export type ShutdownHandler = () => Promise<void>;
export type ShutdownListener = (signal: string) => void;

/**
 * 優雅關機管理器
 */
export class GracefulShutdown {
  private handlers: ShutdownHandler[] = [];
  private listeners: ShutdownListener[] = [];
  private isShuttingDown = false;
  private shutdownStartTime?: number;

  constructor(private readonly options: ShutdownOptions) {
    this.setupSignalHandlers();
  }

  /**
   * 註冊關機處理器
   */
  registerHandler(handler: ShutdownHandler): void {
    this.handlers.push(handler);
  }

  /**
   * 註冊關機監聽器
   */
  registerListener(listener: ShutdownListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除關機處理器
   */
  unregisterHandler(handler: ShutdownHandler): boolean {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 移除關機監聽器
   */
  unregisterListener(listener: ShutdownListener): boolean {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 手動觸發關機
   */
  async shutdown(signal: string = 'MANUAL'): Promise<void> {
    if (this.isShuttingDown) {
      this.log(`Shutdown already in progress, ignoring ${signal}`);
      return;
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();
    this.log(`Graceful shutdown initiated by signal: ${signal}`);

    // 通知所有監聽器
    for (const listener of this.listeners) {
      try {
        listener(signal);
      } catch (error) {
        this.log(`Error in shutdown listener: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 可選的關機延遲
    if (this.options.delay && this.options.delay > 0) {
      this.log(`Waiting ${this.options.delay}ms before starting shutdown procedures...`);
      await this.sleep(this.options.delay);
    }

    // 執行所有關機處理器
    await this.executeHandlers();

    this.log(`Graceful shutdown completed in ${Date.now() - this.shutdownStartTime!}ms`);
    process.exit(0);
  }

  /**
   * 檢查是否正在關機
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * 獲取關機開始時間
   */
  getShutdownStartTime(): number | undefined {
    return this.shutdownStartTime;
  }

  /**
   * 設定信號處理器
   */
  private setupSignalHandlers(): void {
    // 優雅關機信號
    const gracefulSignals = ['SIGTERM', 'SIGINT'];
    
    for (const signal of gracefulSignals) {
      process.on(signal, () => {
        this.shutdown(signal).catch((error) => {
          this.log(`Error during graceful shutdown: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        });
      });
    }

    // 強制退出信號
    process.on('SIGKILL', () => {
      this.log('Received SIGKILL, forcing immediate exit');
      process.exit(1);
    });

    // 未捕獲的例外
    process.on('uncaughtException', (error) => {
      this.log(`Uncaught exception: ${error.message}`);
      this.shutdown('UNCAUGHT_EXCEPTION').catch(() => {
        process.exit(1);
      });
    });

    // 未處理的 Promise 拒絕
    process.on('unhandledRejection', (reason) => {
      this.log(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
      this.shutdown('UNHANDLED_REJECTION').catch(() => {
        process.exit(1);
      });
    });
  }

  /**
   * 執行所有關機處理器
   */
  private async executeHandlers(): Promise<void> {
    if (this.handlers.length === 0) {
      this.log('No shutdown handlers registered');
      return;
    }

    this.log(`Executing ${this.handlers.length} shutdown handlers...`);

    const promises = this.handlers.map(async (handler, index) => {
      try {
        const startTime = Date.now();
        await handler();
        const duration = Date.now() - startTime;
        this.log(`Shutdown handler ${index + 1} completed in ${duration}ms`);
      } catch (error) {
        this.log(`Shutdown handler ${index + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });

    try {
      // 使用 Promise.allSettled 確保所有處理器都有機會執行
      const results = await Promise.race([
        Promise.allSettled(promises),
        this.createTimeoutPromise()
      ]);

      if (Array.isArray(results)) {
        const failed = results.filter(result => result.status === 'rejected').length;
        if (failed > 0) {
          this.log(`${failed} shutdown handlers failed`);
        } else {
          this.log('All shutdown handlers completed successfully');
        }
      }
    } catch (error) {
      this.log(`Shutdown handlers timed out after ${this.options.timeout}ms`);
      throw error;
    }
  }

  /**
   * 建立超時 Promise
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Shutdown timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);
    });
  }

  /**
   * 記錄訊息
   */
  private log(message: string): void {
    if (this.options.logger) {
      this.options.logger(`[GracefulShutdown] ${message}`);
    } else {
      console.log(`[GracefulShutdown] ${message}`);
    }
  }

  /**
   * 睡眠函數
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 預設關機處理器
 */
export class DefaultShutdownHandlers {
  /**
   * 清理定時器
   */
  static cleanupTimers(timers: NodeJS.Timeout[]): ShutdownHandler {
    return async () => {
      for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }
    };
  }

  /**
   * 關閉 HTTP 伺服器
   */
  static closeHttpServer(server: { close(callback: (error?: Error) => void): void }): ShutdownHandler {
    return async () => {
      return new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    };
  }

  /**
   * 等待進行中的請求完成
   */
  static waitForRequests(getActiveRequestCount: () => number, maxWait: number = 10000): ShutdownHandler {
    return async () => {
      const startTime = Date.now();
      
      while (getActiveRequestCount() > 0 && Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const remainingRequests = getActiveRequestCount();
      if (remainingRequests > 0) {
        console.warn(`Shutdown with ${remainingRequests} active requests still pending`);
      }
    };
  }

  /**
   * 清理快取
   */
  static cleanupCache(cache: { clear(): void }): ShutdownHandler {
    return async () => {
      cache.clear();
    };
  }

  /**
   * 停止自動清理程序
   */
  static stopAutoCleanup(cleanup: { stopAutoCleanup(): void }): ShutdownHandler {
    return async () => {
      cleanup.stopAutoCleanup();
    };
  }
}