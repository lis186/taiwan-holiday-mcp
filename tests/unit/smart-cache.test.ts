/**
 * SmartCache 單元測試
 */

import {
  SmartCache,
  SmartCacheOptions,
  CacheStats,
} from '../../src/utils/smart-cache.js';

describe('SmartCache', () => {
  let cache: SmartCache<string>;
  const defaultOptions: SmartCacheOptions = {
    maxSize: 5,
    defaultTtl: 60000, // 1 分鐘
    statsWindow: 300000, // 5 分鐘
    autoCleanup: false, // 預設關閉自動清理
    cleanupInterval: 30000, // 30 秒
  };

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new SmartCache<string>(defaultOptions);
  });

  afterEach(() => {
    cache.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('基本功能測試', () => {
    test('應該成功創建 SmartCache 實例', () => {
      expect(cache).toBeInstanceOf(SmartCache);
    });

    test('應該能夠 set 和 get 快取項目', () => {
      cache.set('key1', 'value1');
      const value = cache.get('key1');
      expect(value).toBe('value1');
    });

    test('應該使用 has() 檢查項目存在性', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    test('應該能夠 delete 刪除項目', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      
      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    test('應該能夠 clear 清空所有快取', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.size()).toBe(3);
      
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('TTL 過期機制測試', () => {
    test('應該在 get() 時自動刪除過期項目', () => {
      cache.set('key1', 'value1', 1000); // 1 秒 TTL
      
      // 立即獲取應該成功
      expect(cache.get('key1')).toBe('value1');
      
      // 推進時間超過 TTL
      jest.advanceTimersByTime(1001);
      
      // 應該返回 null 且自動刪除
      expect(cache.get('key1')).toBeNull();
      expect(cache.size()).toBe(0);
    });

    test('應該在 has() 時檢查過期並返回 false', () => {
      cache.set('key1', 'value1', 1000);
      expect(cache.has('key1')).toBe(true);
      
      // 推進時間超過 TTL
      jest.advanceTimersByTime(1001);
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.size()).toBe(0);
    });

    test('應該使用自訂 TTL 設定', () => {
      cache.set('key1', 'value1', 2000); // 自訂 2 秒 TTL
      
      jest.advanceTimersByTime(1500);
      expect(cache.get('key1')).toBe('value1'); // 仍然有效
      
      jest.advanceTimersByTime(600);
      expect(cache.get('key1')).toBeNull(); // 已過期
    });

    test('應該使用預設 TTL 當未指定時', () => {
      cache.set('key1', 'value1'); // 使用預設 TTL (60000ms)
      
      jest.advanceTimersByTime(59000);
      expect(cache.get('key1')).toBe('value1'); // 仍然有效
      
      jest.advanceTimersByTime(1001);
      expect(cache.get('key1')).toBeNull(); // 已過期
    });

    test('應該手動清理過期項目', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 2000);
      cache.set('key3', 'value3', 3000);
      
      jest.advanceTimersByTime(1500);
      
      const cleanedCount = cache.cleanup();
      expect(cleanedCount).toBe(1); // 只有 key1 過期
      expect(cache.size()).toBe(2);
    });

    test('應該返回正確的清理數量', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);
      cache.set('key3', 'value3', 5000);
      
      jest.advanceTimersByTime(1500);
      
      const cleanedCount = cache.cleanup();
      expect(cleanedCount).toBe(2); // key1 和 key2 過期
      expect(cache.size()).toBe(1);
    });
  });

  describe('LRU 驅逐策略測試', () => {
    test('應該在快取滿時驅逐最少使用的項目', () => {
      // maxSize = 5
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');
      expect(cache.size()).toBe(5);
      
      // 插入第 6 個項目，應該驅逐 key1（最舊的）
      cache.set('key6', 'value6');
      expect(cache.size()).toBe(5);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key6')).toBe(true);
    });

    test('應該在 get() 時更新存取順序', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');
      
      // 存取 key1，使其成為最近使用
      cache.get('key1');
      
      // 插入新項目，應該驅逐 key2（現在是最舊的）
      cache.set('key6', 'value6');
      expect(cache.has('key1')).toBe(true); // key1 被保留
      expect(cache.has('key2')).toBe(false); // key2 被驅逐
    });

    test('應該正確處理多次存取的 LRU 順序', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');
      
      // 多次存取 key1 和 key2
      cache.get('key1');
      cache.get('key2');
      cache.get('key1');
      
      // 插入兩個新項目
      cache.set('key6', 'value6');
      cache.set('key7', 'value7');
      
      // key1 和 key2 應該被保留，key3 和 key4 被驅逐
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(false);
      expect(cache.has('key4')).toBe(false);
    });

    test('應該在更新現有項目時不觸發驅逐', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');
      
      // 更新現有項目
      cache.set('key1', 'updated');
      expect(cache.size()).toBe(5); // 大小不變
      expect(cache.get('key1')).toBe('updated');
    });

    test('應該在驅逐後保持正確的快取大小', () => {
      for (let i = 1; i <= 10; i++) {
        cache.set(`key${i}`, `value${i}`);
        expect(cache.size()).toBeLessThanOrEqual(5);
      }
      expect(cache.size()).toBe(5);
    });
  });

  describe('統計資訊測試', () => {
    test('應該返回完整的統計資訊', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.get('key1'); // 命中
      cache.get('key3'); // 未命中
      
      const stats = cache.getStats();
      
      expect(stats).toHaveProperty('totalItems');
      expect(stats).toHaveProperty('expiredItems');
      expect(stats).toHaveProperty('activeItems');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('averageAccessCount');
    });

    test('應該正確計算快取命中率', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.get('key1'); // 命中
      cache.get('key1'); // 命中
      cache.get('key3'); // 未命中
      
      const stats = cache.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.cacheHits).toBe(2);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    test('應該正確統計快取未命中數', () => {
      cache.get('nonexistent1');
      cache.get('nonexistent2');
      cache.get('nonexistent3');
      
      const stats = cache.getStats();
      expect(stats.cacheMisses).toBe(3);
      expect(stats.cacheHits).toBe(0);
    });

    test('應該正確統計活躍和過期項目', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 5000);
      cache.set('key3', 'value3', 5000);
      
      jest.advanceTimersByTime(2000);
      
      const stats = cache.getStats();
      expect(stats.totalItems).toBe(3);
      expect(stats.expiredItems).toBe(1);
      expect(stats.activeItems).toBe(2);
    });

    test('應該正確計算平均存取次數', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.get('key1'); // accessCount = 2 (set 時為 1)
      cache.get('key1'); // accessCount = 3
      cache.get('key2'); // accessCount = 2
      
      const stats = cache.getStats();
      // (3 + 2) / 2 = 2.5
      expect(stats.averageAccessCount).toBe(2.5);
    });

    test('應該能夠重置統計資訊', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key2');
      
      let stats = cache.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
      
      cache.resetStats();
      
      stats = cache.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });

    test('應該返回所有鍵值', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    test('應該返回正確的快取大小', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('記憶體估算測試', () => {
    test('應該估算字串資料的記憶體使用', () => {
      cache.set('key1', 'short');
      cache.set('key2', 'a very long string value for testing memory estimation');
      
      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
      // 字串較長時，記憶體使用應該更多
      expect(stats.memoryUsage).toBeGreaterThan(100);
    });

    test('應該估算陣列資料的記憶體使用', () => {
      const arrayCache = new SmartCache<string[]>(defaultOptions);
      
      arrayCache.set('key1', ['item1', 'item2', 'item3']);
      arrayCache.set('key2', ['a', 'b', 'c', 'd', 'e']);
      
      const stats = arrayCache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
      
      arrayCache.destroy();
    });

    test('應該估算物件資料的記憶體使用', () => {
      interface TestObject {
        name: string;
        age: number;
      }
      
      const objCache = new SmartCache<TestObject>(defaultOptions);
      
      objCache.set('key1', { name: 'Alice', age: 30 });
      objCache.set('key2', { name: 'Bob', age: 25 });
      
      const stats = objCache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
      
      objCache.destroy();
    });

    test('應該估算數字等其他類型資料的記憶體使用', () => {
      const numCache = new SmartCache<number>(defaultOptions);
      
      numCache.set('key1', 42);
      numCache.set('key2', 3.14);
      
      const stats = numCache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
      
      numCache.destroy();
    });

    test('應該將 accessOrder 陣列計入記憶體估算', () => {
      cache.set('key1', 'value1');
      const stats1 = cache.getStats();
      
      // 添加更多項目
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      const stats2 = cache.getStats();
      
      // 記憶體使用應該增加
      expect(stats2.memoryUsage).toBeGreaterThan(stats1.memoryUsage);
    });
  });

  describe('自動清理機制測試', () => {
    test('應該在啟用 autoCleanup 時自動執行清理', () => {
      const autoCache = new SmartCache<string>({
        ...defaultOptions,
        autoCleanup: true,
        cleanupInterval: 1000,
      });
      
      autoCache.set('key1', 'value1', 500); // 0.5 秒 TTL
      autoCache.set('key2', 'value2', 2000);
      
      expect(autoCache.size()).toBe(2);
      
      // 推進時間到清理間隔
      jest.advanceTimersByTime(1000);
      
      // key1 應該被自動清理
      expect(autoCache.size()).toBe(1);
      expect(autoCache.has('key1')).toBe(false);
      expect(autoCache.has('key2')).toBe(true);
      
      autoCache.destroy();
    });

    test('應該按照 cleanupInterval 間隔執行清理', () => {
      const autoCache = new SmartCache<string>({
        ...defaultOptions,
        autoCleanup: true,
        cleanupInterval: 2000,
      });
      
      autoCache.set('key1', 'value1', 1000);
      
      // 推進 1 秒，不應該觸發清理
      jest.advanceTimersByTime(1000);
      expect(autoCache.size()).toBe(1);
      
      // 再推進 1 秒，應該觸發清理
      jest.advanceTimersByTime(1000);
      expect(autoCache.size()).toBe(0);
      
      autoCache.destroy();
    });

    test('應該能夠停止自動清理', () => {
      const autoCache = new SmartCache<string>({
        ...defaultOptions,
        autoCleanup: true,
        cleanupInterval: 1000,
      });
      
      autoCache.set('key1', 'value1', 500);
      
      // 停止自動清理
      autoCache.stopAutoCleanup();
      
      // 推進時間
      jest.advanceTimersByTime(1000);
      
      // 項目仍然存在（未被自動清理）
      expect(autoCache.size()).toBe(1);
      
      autoCache.destroy();
    });

    test('應該在 destroy() 時清理所有資源', () => {
      const autoCache = new SmartCache<string>({
        ...defaultOptions,
        autoCleanup: true,
        cleanupInterval: 1000,
      });
      
      autoCache.set('key1', 'value1');
      autoCache.set('key2', 'value2');
      
      expect(autoCache.size()).toBe(2);
      
      autoCache.destroy();
      
      expect(autoCache.size()).toBe(0);
      expect(autoCache.keys()).toHaveLength(0);
    });
  });

  describe('邊緣案例測試', () => {
    test('應該處理空快取的統計資訊', () => {
      const stats = cache.getStats();
      
      expect(stats.totalItems).toBe(0);
      expect(stats.activeItems).toBe(0);
      expect(stats.expiredItems).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.averageAccessCount).toBe(0);
    });

    test('應該處理單一項目的 LRU 行為', () => {
      const smallCache = new SmartCache<string>({
        ...defaultOptions,
        maxSize: 1,
      });
      
      smallCache.set('key1', 'value1');
      expect(smallCache.size()).toBe(1);
      
      smallCache.set('key2', 'value2');
      expect(smallCache.size()).toBe(1);
      expect(smallCache.has('key1')).toBe(false);
      expect(smallCache.has('key2')).toBe(true);
      
      smallCache.destroy();
    });

    test('應該處理所有項目都過期的情況', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);
      cache.set('key3', 'value3', 1000);
      
      jest.advanceTimersByTime(2000);
      
      const cleanedCount = cache.cleanup();
      expect(cleanedCount).toBe(3);
      expect(cache.size()).toBe(0);
    });

    test('應該在 get() 不存在的鍵值時返回 null', () => {
      const value = cache.get('nonexistent');
      expect(value).toBeNull();
    });

    test('應該在 delete() 不存在的鍵值時返回 false', () => {
      const deleted = cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });
});

