/**
 * Jest 測試設定檔案
 * 
 * 設定全域測試環境、模擬和工具函數
 */

// 設定測試超時時間
jest.setTimeout(10000);

// 全域變數設定
global.console = {
  ...console,
  // 在測試中靜音某些 console 輸出
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};

// 模擬 fetch API（如果需要）
global.fetch = jest.fn();

// 設定時區為台北時間
process.env.TZ = 'Asia/Taipei';

// 測試前的全域設定
beforeAll(() => {
  // 可以在這裡設定全域的測試資料或模擬
});

// 每個測試前的清理
beforeEach(() => {
  // 清除所有模擬的呼叫記錄
  jest.clearAllMocks();
});

// 每個測試後的清理
afterEach(() => {
  // 清理任何測試後的狀態
});

// 測試結束後的全域清理
afterAll(() => {
  // 清理全域資源
});

// 自訂匹配器（如果需要）
expect.extend({
  toBeValidDate(received: string) {
    const regex = /^\d{8}$/;
    const pass = regex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date format`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date format (YYYYMMDD)`,
        pass: false,
      };
    }
  },
  
  toBeValidHoliday(received: any) {
    const isValid = (
      typeof received === 'object' &&
      received !== null &&
      typeof received.date === 'string' &&
      typeof received.week === 'string' &&
      typeof received.isHoliday === 'boolean' &&
      typeof received.description === 'string'
    );
    
    if (isValid) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid holiday object`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid holiday object`,
        pass: false,
      };
    }
  }
});

// 擴展 Jest 匹配器型別
declare module '@jest/expect' {
  interface Matchers<R> {
    toBeValidDate(): R;
    toBeValidHoliday(): R;
  }
} 