import { TaiwanHolidayMcpServer } from '../../src/server';

describe('TaiwanHolidayMcpServer', () => {
  let server: TaiwanHolidayMcpServer;

  beforeEach(() => {
    server = new TaiwanHolidayMcpServer();
  });

  describe('伺服器初始化', () => {
    test('應該成功建立伺服器實例', () => {
      expect(server).toBeInstanceOf(TaiwanHolidayMcpServer);
    });

    test('應該具有 run 方法', () => {
      expect(typeof server.run).toBe('function');
    });
  });

  describe('錯誤處理', () => {
    test('應該設定 process 錯誤處理器', () => {
      // 檢查是否有設定錯誤處理器
      const uncaughtExceptionListeners = process.listenerCount('uncaughtException');
      const unhandledRejectionListeners = process.listenerCount('unhandledRejection');
      
      expect(uncaughtExceptionListeners).toBeGreaterThan(0);
      expect(unhandledRejectionListeners).toBeGreaterThan(0);
    });
  });
}); 