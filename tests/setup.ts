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

// 全域建置狀態
let buildCompleted = false;

// 全域建置函數
export async function ensureBuild(): Promise<void> {
  if (buildCompleted) {
    return;
  }

  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    let stderr = '';

    buildProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        buildCompleted = true;
        resolve();
      } else {
        reject(new Error(`Build failed with code ${code}: ${stderr}`));
      }
    });
  });
}

// 測試前的全域設定
beforeAll(async () => {
  // 確保專案已建置
  await ensureBuild();
}, 30000); // 增加超時時間以允許建置完成

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
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidHoliday(): R;
    }
  }
} 