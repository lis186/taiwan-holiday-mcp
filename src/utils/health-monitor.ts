/**
 * Health Monitoring System
 * 
 * 系統健康狀態監控，提供健康檢查和狀態報告
 */

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN'
}

export interface HealthCheckResult {
  /** 檢查名稱 */
  name: string;
  /** 健康狀態 */
  status: HealthStatus;
  /** 回應時間 (ms) */
  responseTime: number;
  /** 錯誤訊息 */
  error?: string;
  /** 額外資訊 */
  details?: Record<string, unknown>;
  /** 檢查時間 */
  timestamp: number;
}

export interface SystemHealth {
  /** 整體狀態 */
  status: HealthStatus;
  /** 檢查時間 */
  timestamp: number;
  /** 系統啟動時間 */
  uptime: number;
  /** 版本資訊 */
  version: string;
  /** 個別檢查結果 */
  checks: HealthCheckResult[];
  /** 統計資訊 */
  stats: {
    /** 記憶體使用情況 */
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    /** 快取統計 */
    cache?: {
      hitRate: number;
      totalItems: number;
      memoryUsage: number;
    };
    /** 錯誤統計 */
    errors?: {
      circuitBreakerState: string;
      totalErrors: number;
      recentErrors: number;
    };
  };
}

export type HealthCheckFunction = () => Promise<HealthCheckResult>;

/**
 * 健康監控器
 */
export class HealthMonitor {
  private checks = new Map<string, HealthCheckFunction>();
  private lastCheckResults = new Map<string, HealthCheckResult>();
  private startTime = Date.now();

  constructor(private readonly version: string = '1.0.1') {}

  /**
   * 註冊健康檢查
   */
  registerCheck(name: string, checkFn: HealthCheckFunction): void {
    this.checks.set(name, checkFn);
  }

  /**
   * 移除健康檢查
   */
  unregisterCheck(name: string): boolean {
    this.lastCheckResults.delete(name);
    return this.checks.delete(name);
  }

  /**
   * 執行所有健康檢查
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const timestamp = Date.now();
    const checkResults: HealthCheckResult[] = [];

    // 執行所有註冊的檢查
    for (const [name, checkFn] of this.checks) {
      try {
        const result = await this.executeCheck(name, checkFn);
        checkResults.push(result);
        this.lastCheckResults.set(name, result);
      } catch (error) {
        const failedResult: HealthCheckResult = {
          name,
          status: HealthStatus.UNHEALTHY,
          responseTime: 0,
          error: error instanceof Error ? error.message : String(error),
          timestamp,
        };
        checkResults.push(failedResult);
        this.lastCheckResults.set(name, failedResult);
      }
    }

    // 確定整體健康狀態
    const overallStatus = this.determineOverallStatus(checkResults);

    return {
      status: overallStatus,
      timestamp,
      uptime: timestamp - this.startTime,
      version: this.version,
      checks: checkResults,
      stats: {
        memory: this.getMemoryStats(),
      },
    };
  }

  /**
   * 獲取快速健康狀態（不執行檢查）
   */
  getQuickStatus(): { status: HealthStatus; uptime: number; timestamp: number } {
    const timestamp = Date.now();
    const recentResults = Array.from(this.lastCheckResults.values())
      .filter(result => timestamp - result.timestamp < 300000); // 5 分鐘內的結果

    const status = recentResults.length > 0 
      ? this.determineOverallStatus(recentResults)
      : HealthStatus.UNKNOWN;

    return {
      status,
      uptime: timestamp - this.startTime,
      timestamp,
    };
  }

  /**
   * 獲取特定檢查的最新結果
   */
  getCheckResult(name: string): HealthCheckResult | null {
    return this.lastCheckResults.get(name) || null;
  }

  /**
   * 獲取所有檢查的最新結果
   */
  getAllCheckResults(): HealthCheckResult[] {
    return Array.from(this.lastCheckResults.values());
  }

  /**
   * 清除所有檢查結果
   */
  clearResults(): void {
    this.lastCheckResults.clear();
  }

  /**
   * 執行單個健康檢查
   */
  private async executeCheck(name: string, checkFn: HealthCheckFunction): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        checkFn(),
        this.createTimeoutPromise(30000) // 30 秒超時
      ]);
      
      return {
        ...result,
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`Health check '${name}' failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 建立超時 Promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeout);
    });
  }

  /**
   * 確定整體健康狀態
   */
  private determineOverallStatus(results: HealthCheckResult[]): HealthStatus {
    if (results.length === 0) {
      return HealthStatus.UNKNOWN;
    }

    const statusCounts = {
      [HealthStatus.HEALTHY]: 0,
      [HealthStatus.DEGRADED]: 0,
      [HealthStatus.UNHEALTHY]: 0,
      [HealthStatus.UNKNOWN]: 0,
    };

    for (const result of results) {
      statusCounts[result.status]++;
    }

    // 如果有任何 UNHEALTHY，整體為 UNHEALTHY
    if (statusCounts[HealthStatus.UNHEALTHY] > 0) {
      return HealthStatus.UNHEALTHY;
    }

    // 如果有 DEGRADED 但沒有 UNHEALTHY，整體為 DEGRADED
    if (statusCounts[HealthStatus.DEGRADED] > 0) {
      return HealthStatus.DEGRADED;
    }

    // 如果有 UNKNOWN，整體為 DEGRADED
    if (statusCounts[HealthStatus.UNKNOWN] > 0) {
      return HealthStatus.DEGRADED;
    }

    // 全部 HEALTHY
    return HealthStatus.HEALTHY;
  }

  /**
   * 獲取記憶體統計資訊
   */
  private getMemoryStats(): { used: number; total: number; percentage: number } {
    const usage = process.memoryUsage();
    const total = usage.heapTotal;
    const used = usage.heapUsed;
    
    return {
      used,
      total,
      percentage: Math.round((used / total) * 100 * 100) / 100,
    };
  }
}

/**
 * 預設健康檢查功能
 */
export class DefaultHealthChecks {
  /**
   * 基本存活檢查
   */
  static aliveness(): HealthCheckFunction {
    return async () => ({
      name: 'aliveness',
      status: HealthStatus.HEALTHY,
      responseTime: 0,
      details: { message: 'Service is alive' },
      timestamp: Date.now(),
    });
  }

  /**
   * 記憶體使用檢查
   */
  static memoryUsage(threshold: number = 90): HealthCheckFunction {
    return async () => {
      const usage = process.memoryUsage();
      const percentage = (usage.heapUsed / usage.heapTotal) * 100;
      
      let status = HealthStatus.HEALTHY;
      if (percentage > threshold) {
        status = HealthStatus.UNHEALTHY;
      } else if (percentage > threshold * 0.8) {
        status = HealthStatus.DEGRADED;
      }

      return {
        name: 'memory',
        status,
        responseTime: 0,
        details: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          percentage: Math.round(percentage * 100) / 100,
          threshold,
        },
        timestamp: Date.now(),
      };
    };
  }

  /**
   * 外部 API 檢查
   */
  static externalApi(url: string, timeout: number = 5000): HealthCheckFunction {
    return async () => {
      const startTime = Date.now();
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          signal: controller.signal,
          method: 'HEAD',
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        const status = response.ok ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;

        return {
          name: 'external-api',
          status,
          responseTime,
          details: {
            url,
            statusCode: response.status,
            statusText: response.statusText,
          },
          timestamp: Date.now(),
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        return {
          name: 'external-api',
          status: HealthStatus.UNHEALTHY,
          responseTime,
          error: error instanceof Error ? error.message : String(error),
          details: { url },
          timestamp: Date.now(),
        };
      }
    };
  }
}