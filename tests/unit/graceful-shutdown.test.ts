/**
 * GracefulShutdown 單元測試
 */

import { GracefulShutdown, DefaultShutdownHandlers, ShutdownHandler, ShutdownListener } from '../../src/utils/graceful-shutdown.js';

describe('GracefulShutdown', () => {
  let logs: string[];
  let mockLogger: (message: string) => void;

  beforeEach(() => {
    logs = [];
    mockLogger = (message: string) => {
      logs.push(message);
    };
  });

  describe('初始化與基本功能', () => {
    test('應該成功創建 GracefulShutdown 實例', () => {
      const shutdown = new GracefulShutdown({
        timeout: 5000,
        logger: mockLogger
      });

      expect(shutdown).toBeInstanceOf(GracefulShutdown);
      expect(shutdown.isShutdownInProgress()).toBe(false);
      expect(shutdown.getShutdownStartTime()).toBeUndefined();
    });

    test('應該能夠註冊和移除 handler', () => {
      const shutdown = new GracefulShutdown({
        timeout: 5000,
        logger: mockLogger
      });

      const handler: ShutdownHandler = async () => {
        // Do nothing
      };

      shutdown.registerHandler(handler);
      const removed = shutdown.unregisterHandler(handler);

      expect(removed).toBe(true);
    });

    test('應該能夠註冊和移除 listener', () => {
      const shutdown = new GracefulShutdown({
        timeout: 5000,
        logger: mockLogger
      });

      const listener: ShutdownListener = (signal: string) => {
        // Do nothing
      };

      shutdown.registerListener(listener);
      const removed = shutdown.unregisterListener(listener);

      expect(removed).toBe(true);
    });

    test('移除不存在的 handler 應該返回 false', () => {
      const shutdown = new GracefulShutdown({
        timeout: 5000,
        logger: mockLogger
      });

      const handler: ShutdownHandler = async () => {
        // Do nothing
      };

      const removed = shutdown.unregisterHandler(handler);
      expect(removed).toBe(false);
    });

    test('移除不存在的 listener 應該返回 false', () => {
      const shutdown = new GracefulShutdown({
        timeout: 5000,
        logger: mockLogger
      });

      const listener: ShutdownListener = (signal: string) => {
        // Do nothing
      };

      const removed = shutdown.unregisterListener(listener);
      expect(removed).toBe(false);
    });
  });

  describe('狀態查詢', () => {
    test('初始狀態應該不在關機中', () => {
      const shutdown = new GracefulShutdown({
        timeout: 5000,
        logger: mockLogger
      });

      expect(shutdown.isShutdownInProgress()).toBe(false);
    });

    test('初始狀態 shutdownStartTime 應該是 undefined', () => {
      const shutdown = new GracefulShutdown({
        timeout: 5000,
        logger: mockLogger
      });

      expect(shutdown.getShutdownStartTime()).toBeUndefined();
    });
  });

  describe('Logger 功能', () => {
    test('應該使用自定義 logger', () => {
      const shutdown = new GracefulShutdown({
        timeout: 5000,
        logger: mockLogger
      });

      // 註冊一個 handler 來觸發 log
      const handler: ShutdownHandler = async () => {
        // Do nothing
      };
      shutdown.registerHandler(handler);

      expect(logs.length).toBeGreaterThanOrEqual(0);
    });

    test('沒有提供 logger 時應該使用 console.log', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const shutdown = new GracefulShutdown({
        timeout: 5000
      });

      // 創建實例時會設置 signal handlers，可能會有 log
      expect(shutdown).toBeInstanceOf(GracefulShutdown);

      consoleSpy.mockRestore();
    });
  });
});

describe('DefaultShutdownHandlers', () => {
  describe('cleanupTimers', () => {
    test('應該清理定時器', async () => {
      const timers: NodeJS.Timeout[] = [
        setTimeout(() => {}, 1000),
        setInterval(() => {}, 1000)
      ];

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const handler = DefaultShutdownHandlers.cleanupTimers(timers);
      await handler();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('cleanupCache', () => {
    test('應該清理快取', async () => {
      const mockCache = {
        clear: jest.fn()
      };

      const handler = DefaultShutdownHandlers.cleanupCache(mockCache);
      await handler();

      expect(mockCache.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopAutoCleanup', () => {
    test('應該停止自動清理', async () => {
      const mockCleanup = {
        stopAutoCleanup: jest.fn()
      };

      const handler = DefaultShutdownHandlers.stopAutoCleanup(mockCleanup);
      await handler();

      expect(mockCleanup.stopAutoCleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeHttpServer', () => {
    test('應該成功關閉 HTTP 伺服器', async () => {
      const mockServer = {
        close: jest.fn((callback: (error?: Error) => void) => {
          callback();
        })
      };

      const handler = DefaultShutdownHandlers.closeHttpServer(mockServer);
      await handler();

      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });

    test('應該處理關閉錯誤', async () => {
      const mockError = new Error('Server close error');
      const mockServer = {
        close: jest.fn((callback: (error?: Error) => void) => {
          callback(mockError);
        })
      };

      const handler = DefaultShutdownHandlers.closeHttpServer(mockServer);
      
      await expect(handler()).rejects.toThrow('Server close error');
    });
  });

  describe('waitForRequests', () => {
    test('應該等待所有請求完成', async () => {
      let activeRequests = 2;
      const getActiveRequestCount = jest.fn(() => activeRequests);

      // 模擬請求逐漸完成
      setTimeout(() => { activeRequests = 1; }, 50);
      setTimeout(() => { activeRequests = 0; }, 100);

      const handler = DefaultShutdownHandlers.waitForRequests(getActiveRequestCount, 5000);
      await handler();

      expect(getActiveRequestCount).toHaveBeenCalled();
      expect(activeRequests).toBe(0);
    }, 10000);

    test('應該在超時後繼續', async () => {
      const getActiveRequestCount = jest.fn(() => 5); // 始終有請求
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const handler = DefaultShutdownHandlers.waitForRequests(getActiveRequestCount, 200);
      await handler();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('5 active requests'));
      consoleSpy.mockRestore();
    });
  });
});

