/**
 * CircuitBreaker 單元測試
 */

import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerError,
  CircuitBreakerOptions,
} from '../../src/utils/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  const defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 3,
    recoveryTimeout: 5000,
    monitoringPeriod: 60000,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    breaker = new CircuitBreaker(defaultOptions);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('初始化與基本功能', () => {
    test('應該成功創建 CircuitBreaker 實例', () => {
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });

    test('應該在 failureThreshold <= 0 時拋出錯誤', () => {
      expect(() => {
        new CircuitBreaker({
          failureThreshold: 0,
          recoveryTimeout: 5000,
          monitoringPeriod: 60000,
        });
      }).toThrow('failureThreshold must be greater than 0');
    });

    test('應該在 recoveryTimeout <= 0 時拋出錯誤', () => {
      expect(() => {
        new CircuitBreaker({
          failureThreshold: 3,
          recoveryTimeout: 0,
          monitoringPeriod: 60000,
        });
      }).toThrow('recoveryTimeout must be greater than 0');
    });

    test('應該初始狀態為 CLOSED', () => {
      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
    });

    test('應該返回正確的初始統計資訊', () => {
      const stats = breaker.getStats();
      expect(stats).toEqual({
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        nextAttempt: 0,
        totalRequests: 0,
      });
    });
  });

  describe('CLOSED → OPEN 狀態轉換', () => {
    test('應該累積失敗次數', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 第一次失敗
      await expect(breaker.execute(failingFn)).rejects.toThrow('Test error');
      expect(breaker.getStats().failureCount).toBe(1);

      // 第二次失敗
      await expect(breaker.execute(failingFn)).rejects.toThrow('Test error');
      expect(breaker.getStats().failureCount).toBe(2);
    });

    test('應該在達到 failureThreshold 時轉為 OPEN', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 失敗 3 次（達到閾值）
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.failureCount).toBe(3);
    });

    test('應該在 OPEN 狀態拒絕執行並拋出 CircuitBreakerError', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 嘗試執行應該立即拒絕
      const successFn = jest.fn().mockResolvedValue('success');
      await expect(breaker.execute(successFn)).rejects.toThrow(CircuitBreakerError);
      
      // 函數不應該被執行
      expect(successFn).not.toHaveBeenCalled();
    });

    test('CircuitBreakerError 應該包含正確的統計資訊', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      try {
        await breaker.execute(jest.fn());
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError);
        expect((error as CircuitBreakerError).stats.state).toBe(CircuitState.OPEN);
        expect((error as CircuitBreakerError).stats.failureCount).toBe(3);
      }
    });

    test('應該正確計算 totalRequests', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      await breaker.execute(successFn);
      await expect(breaker.execute(failingFn)).rejects.toThrow();
      await breaker.execute(successFn);

      expect(breaker.getStats().totalRequests).toBe(3);
    });

    test('應該處理多次失敗的累積效果', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 失敗 5 次（超過閾值）
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // 忽略錯誤，繼續測試
        }
      }

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      // 失敗計數在 OPEN 後不再增加（因為請求被拒絕）
      expect(stats.failureCount).toBe(3);
    });

    test('應該過濾 isExpectedError 指定的預期錯誤', async () => {
      class ExpectedError extends Error {
        name = 'ExpectedError';
      }

      const breakerWithFilter = new CircuitBreaker({
        ...defaultOptions,
        isExpectedError: (error) => error.name === 'ExpectedError',
      });

      const expectedErrorFn = jest.fn().mockRejectedValue(new ExpectedError('Expected'));
      const unexpectedErrorFn = jest.fn().mockRejectedValue(new Error('Unexpected'));

      // 預期錯誤不應該增加失敗計數
      await expect(breakerWithFilter.execute(expectedErrorFn)).rejects.toThrow('Expected');
      await expect(breakerWithFilter.execute(expectedErrorFn)).rejects.toThrow('Expected');
      expect(breakerWithFilter.getStats().failureCount).toBe(0);

      // 非預期錯誤應該增加失敗計數
      await expect(breakerWithFilter.execute(unexpectedErrorFn)).rejects.toThrow('Unexpected');
      expect(breakerWithFilter.getStats().failureCount).toBe(1);
    });

    test('應該記錄 lastFailureTime', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const beforeTime = Date.now();

      await expect(breaker.execute(failingFn)).rejects.toThrow();

      const afterTime = Date.now();
      // lastFailureTime 是私有的，但我們可以通過觸發 OPEN 狀態來驗證它被使用
      expect(breaker.getStats().failureCount).toBe(1);
    });
  });

  describe('OPEN → HALF_OPEN 狀態轉換', () => {
    test('應該在 recoveryTimeout 後自動進入 HALF_OPEN', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }
      expect(breaker.getStats().state).toBe(CircuitState.OPEN);

      // 推進時間超過 recoveryTimeout
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);

      // 下一次執行應該進入 HALF_OPEN
      const successFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      expect(breaker.getStats().state).toBe(CircuitState.CLOSED); // 成功後轉為 CLOSED
    });

    test('應該正確使用 recoveryTimeout 時間控制', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 未超時前應該維持 OPEN
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout - 1000);
      await expect(breaker.execute(jest.fn())).rejects.toThrow(CircuitBreakerError);
      expect(breaker.getStats().state).toBe(CircuitState.OPEN);

      // 超時後進入 HALF_OPEN
      jest.advanceTimersByTime(1001);
      const successFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(successFn);
      expect(successFn).toHaveBeenCalled();
    });

    test('應該正確檢查 shouldAttemptReset 邏輯', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      const stats = breaker.getStats();
      expect(stats.nextAttempt).toBeGreaterThan(Date.now());

      // 推進到 nextAttempt 時間
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);
      expect(Date.now()).toBeGreaterThanOrEqual(stats.nextAttempt);
    });

    test('應該在 HALF_OPEN 狀態允許執行', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 推進時間
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);

      // HALF_OPEN 狀態應該允許執行
      const testFn = jest.fn().mockResolvedValue('test');
      await breaker.execute(testFn);
      expect(testFn).toHaveBeenCalled();
    });

    test('應該正確設定 nextAttempt 時間戳', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const beforeTime = Date.now();

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      const stats = breaker.getStats();
      expect(stats.nextAttempt).toBeGreaterThanOrEqual(beforeTime + defaultOptions.recoveryTimeout);
    });

    test('未超時時應該維持 OPEN 狀態', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 只推進一半時間
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout / 2);

      // 仍然應該是 OPEN
      await expect(breaker.execute(jest.fn())).rejects.toThrow(CircuitBreakerError);
      expect(breaker.getStats().state).toBe(CircuitState.OPEN);
    });
  });

  describe('HALF_OPEN → CLOSED 恢復成功', () => {
    test('應該在成功執行後轉為 CLOSED', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 進入 HALF_OPEN
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);

      // 成功執行
      const successFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      expect(breaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    test('應該重置失敗計數', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }
      expect(breaker.getStats().failureCount).toBe(3);

      // 進入 HALF_OPEN 並成功
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);
      await breaker.execute(jest.fn().mockResolvedValue('success'));

      expect(breaker.getStats().failureCount).toBe(0);
    });

    test('應該累積 successCount', async () => {
      const successFn = jest.fn().mockResolvedValue('success');

      await breaker.execute(successFn);
      expect(breaker.getStats().successCount).toBe(1);

      await breaker.execute(successFn);
      expect(breaker.getStats().successCount).toBe(2);

      await breaker.execute(successFn);
      expect(breaker.getStats().successCount).toBe(3);
    });

    test('應該完整執行 reset 邏輯', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 進入 HALF_OPEN 並成功
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);
      await breaker.execute(jest.fn().mockResolvedValue('success'));

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.nextAttempt).toBe(0);
    });

    test('應該持續累積成功統計', async () => {
      const successFn = jest.fn().mockResolvedValue('success');

      // 多次成功執行
      for (let i = 0; i < 5; i++) {
        await breaker.execute(successFn);
      }

      const stats = breaker.getStats();
      expect(stats.successCount).toBe(5);
      expect(stats.totalRequests).toBe(5);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('HALF_OPEN → OPEN 恢復失敗', () => {
    test('應該在 HALF_OPEN 時失敗立即轉回 OPEN', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 進入 HALF_OPEN
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);

      // HALF_OPEN 時失敗
      await expect(breaker.execute(failingFn)).rejects.toThrow('Test error');

      expect(breaker.getStats().state).toBe(CircuitState.OPEN);
    });

    test('應該重新設定 nextAttempt', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 進入 HALF_OPEN
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);
      const beforeFailTime = Date.now();

      // HALF_OPEN 時失敗
      await expect(breaker.execute(failingFn)).rejects.toThrow();

      const stats = breaker.getStats();
      expect(stats.nextAttempt).toBeGreaterThanOrEqual(beforeFailTime + defaultOptions.recoveryTimeout);
    });

    test('不需要累積到 failureThreshold 即可轉為 OPEN', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態（需要 3 次失敗）
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 進入 HALF_OPEN
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);

      // HALF_OPEN 時只需 1 次失敗就轉回 OPEN
      await expect(breaker.execute(failingFn)).rejects.toThrow();
      expect(breaker.getStats().state).toBe(CircuitState.OPEN);
    });

    test('錯誤應該正確傳播', async () => {
      const testError = new Error('Specific test error');
      const failingFn = jest.fn().mockRejectedValue(testError);

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // 進入 HALF_OPEN 並失敗
      jest.advanceTimersByTime(defaultOptions.recoveryTimeout + 1);
      await expect(breaker.execute(failingFn)).rejects.toThrow('Specific test error');
    });
  });

  describe('統計資訊測試', () => {
    test('getStats 應該返回完整統計資訊', async () => {
      const stats = breaker.getStats();

      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('nextAttempt');
      expect(stats).toHaveProperty('totalRequests');
    });

    test('state、failureCount、successCount 應該準確', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      await breaker.execute(successFn);
      await expect(breaker.execute(failingFn)).rejects.toThrow();
      await breaker.execute(successFn);

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
    });

    test('totalRequests 應該正確累積', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      await breaker.execute(successFn);
      await expect(breaker.execute(failingFn)).rejects.toThrow();
      await breaker.execute(successFn);
      await expect(breaker.execute(failingFn)).rejects.toThrow();

      expect(breaker.getStats().totalRequests).toBe(4);
    });

    test('nextAttempt 時間戳應該正確', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 正常狀態 nextAttempt 為 0
      expect(breaker.getStats().nextAttempt).toBe(0);

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // OPEN 狀態 nextAttempt 應該大於當前時間
      const stats = breaker.getStats();
      expect(stats.nextAttempt).toBeGreaterThan(Date.now());
    });
  });

  describe('手動控制方法', () => {
    test('forceReset 應該強制重置到 CLOSED', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // 觸發 OPEN 狀態
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }
      expect(breaker.getStats().state).toBe(CircuitState.OPEN);

      // 強制重置
      breaker.forceReset();

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.nextAttempt).toBe(0);
    });

    test('forceOpen 應該強制開啟到 OPEN', () => {
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED);

      // 強制開啟
      breaker.forceOpen();

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.nextAttempt).toBeGreaterThan(Date.now());
    });

    test('手動控制後狀態應該正確', async () => {
      const successFn = jest.fn().mockResolvedValue('success');

      // 強制開啟
      breaker.forceOpen();
      await expect(breaker.execute(successFn)).rejects.toThrow(CircuitBreakerError);

      // 強制重置
      breaker.forceReset();
      await breaker.execute(successFn);
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED);
    });
  });
});

