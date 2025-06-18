/**
 * Smart Caching System with LRU and TTL
 * 
 * 結合 LRU (Least Recently Used) 和 TTL (Time To Live) 的智慧快取系統
 */

export interface SmartCacheOptions {
  /** 最大快取項目數 */
  maxSize: number;
  /** 預設 TTL (毫秒) */
  defaultTtl: number;
  /** 快取命中率統計時間窗口 (毫秒) */
  statsWindow: number;
  /** 是否啟用自動清理 */
  autoCleanup: boolean;
  /** 自動清理間隔 (毫秒) */
  cleanupInterval: number;
}

export interface CacheItem<T> {
  /** 快取資料 */
  data: T;
  /** 建立時間 */
  createdAt: number;
  /** 過期時間 */
  expiresAt: number;
  /** 最後存取時間 */
  lastAccessed: number;
  /** 存取次數 */
  accessCount: number;
  /** TTL (毫秒) */
  ttl: number;
}

export interface CacheStats {
  /** 總項目數 */
  totalItems: number;
  /** 過期項目數 */
  expiredItems: number;
  /** 活躍項目數 */
  activeItems: number;
  /** 總請求數 */
  totalRequests: number;
  /** 快取命中數 */
  cacheHits: number;
  /** 快取未命中數 */
  cacheMisses: number;
  /** 快取命中率 (%) */
  hitRate: number;
  /** 記憶體使用量估算 (bytes) */
  memoryUsage: number;
  /** 平均存取次數 */
  averageAccessCount: number;
}

/**
 * 智慧快取系統
 */
export class SmartCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private accessOrder: string[] = []; // LRU 排序
  private totalRequests = 0;
  private cacheHits = 0;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private readonly options: SmartCacheOptions) {
    if (options.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * 獲取快取項目
   */
  get(key: string): T | null {
    this.totalRequests++;
    
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    const now = Date.now();
    
    // 檢查是否過期
    if (now > item.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // 更新存取資訊
    item.lastAccessed = now;
    item.accessCount++;
    this.updateAccessOrder(key);
    
    this.cacheHits++;
    return item.data;
  }

  /**
   * 設定快取項目
   */
  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const itemTtl = ttl || this.options.defaultTtl;
    
    // 如果快取已滿且要插入新項目，移除最少使用的項目
    if (!this.cache.has(key) && this.cache.size >= this.options.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const item: CacheItem<T> = {
      data,
      createdAt: now,
      expiresAt: now + itemTtl,
      lastAccessed: now,
      accessCount: 1,
      ttl: itemTtl,
    };

    this.cache.set(key, item);
    this.updateAccessOrder(key);
  }

  /**
   * 檢查快取中是否存在指定鍵值
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    // 檢查是否過期
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }

    return true;
  }

  /**
   * 刪除快取項目
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }

  /**
   * 清空所有快取
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.totalRequests = 0;
    this.cacheHits = 0;
  }

  /**
   * 清理過期項目
   */
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 獲取快取統計資訊
   */
  getStats(): CacheStats {
    const now = Date.now();
    let expiredItems = 0;
    let totalAccessCount = 0;

    for (const item of this.cache.values()) {
      if (now > item.expiresAt) {
        expiredItems++;
      }
      totalAccessCount += item.accessCount;
    }

    const activeItems = this.cache.size - expiredItems;
    const hitRate = this.totalRequests > 0 ? (this.cacheHits / this.totalRequests) * 100 : 0;
    const averageAccessCount = this.cache.size > 0 ? totalAccessCount / this.cache.size : 0;

    return {
      totalItems: this.cache.size,
      expiredItems,
      activeItems,
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.totalRequests - this.cacheHits,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: this.estimateMemoryUsage(),
      averageAccessCount: Math.round(averageAccessCount * 100) / 100,
    };
  }

  /**
   * 重置統計資訊
   */
  resetStats(): void {
    this.totalRequests = 0;
    this.cacheHits = 0;
  }

  /**
   * 獲取所有鍵值
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 獲取快取大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 開始自動清理
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * 停止自動清理
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * 淘汰最少使用的項目 (LRU)
   */
  private evictLeastRecentlyUsed(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    const lruKey = this.accessOrder[0];
    this.cache.delete(lruKey);
    this.removeFromAccessOrder(lruKey);
  }

  /**
   * 更新存取順序
   */
  private updateAccessOrder(key: string): void {
    // 移除現有位置
    this.removeFromAccessOrder(key);
    // 添加到最後（最近使用）
    this.accessOrder.push(key);
  }

  /**
   * 從存取順序中移除
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * 估算記憶體使用量
   */
  private estimateMemoryUsage(): number {
    let size = 0;
    
    for (const [key, item] of this.cache) {
      // Key 大小 (UTF-16)
      size += key.length * 2;
      
      // Item metadata
      size += 48; // 6 numbers * 8 bytes
      
      // Data 大小估算
      if (typeof item.data === 'string') {
        size += item.data.length * 2;
      } else if (Array.isArray(item.data)) {
        size += item.data.length * 100; // 假設每個元素約 100 bytes
      } else if (typeof item.data === 'object' && item.data !== null) {
        size += JSON.stringify(item.data).length * 2;
      } else {
        size += 8; // 其他類型
      }
    }

    // Access order array
    size += this.accessOrder.length * 8;

    return size;
  }

  /**
   * 銷毀快取
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clear();
  }
}