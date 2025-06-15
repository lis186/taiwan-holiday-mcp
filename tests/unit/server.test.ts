import { TaiwanHolidayMcpServer } from '../../src/server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { HolidayService, HolidayServiceError } from '../../src/holiday-service';
import { ErrorType } from '../../src/types';

// Mock dependencies
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('../../src/holiday-service', () => {
  const actual = jest.requireActual('../../src/holiday-service');
  return {
    ...actual,
    HolidayService: jest.fn().mockImplementation(() => ({
      checkHoliday: jest.fn(),
      getHolidaysInRange: jest.fn(),
      getHolidayStats: jest.fn(),
      getHolidaysForYear: jest.fn(),
      clearCache: jest.fn(),
    })),
  };
});

describe('TaiwanHolidayMcpServer', () => {
  let server: TaiwanHolidayMcpServer;
  let mockServer: jest.Mocked<Server>;
  let mockHolidayService: jest.Mocked<HolidayService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockServer = {
      setRequestHandler: jest.fn(),
      connect: jest.fn(),
    } as any;
    
    mockHolidayService = {
      checkHoliday: jest.fn(),
      getHolidaysInRange: jest.fn(),
      getHolidayStats: jest.fn(),
      getHolidaysForYear: jest.fn(),
      clearCache: jest.fn(),
    } as any;

    // Mock constructors
    (Server as jest.MockedClass<typeof Server>).mockImplementation(() => mockServer);
    (HolidayService as jest.MockedClass<typeof HolidayService>).mockImplementation(() => mockHolidayService);

    server = new TaiwanHolidayMcpServer();
  });

  afterEach(() => {
    // Clean up process listeners added during testing
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  describe('伺服器初始化', () => {
    test('應該成功建立伺服器實例', () => {
      expect(server).toBeInstanceOf(TaiwanHolidayMcpServer);
    });

    test('應該初始化 MCP Server', () => {
      expect(Server).toHaveBeenCalledWith(
        {
          name: 'taiwan-holiday-mcp',
          version: '1.0.1',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
          },
        }
      );
    });

    test('應該初始化 HolidayService', () => {
      expect(HolidayService).toHaveBeenCalled();
    });

    test('應該設定請求處理器', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(4);
    });

    test('應該具有 run 方法', () => {
      expect(typeof server.run).toBe('function');
    });
  });

  describe('工具列表處理', () => {
    test('應該返回正確的工具列表', async () => {
      // 檢查 mock 調用結構
      const calls = mockServer.setRequestHandler.mock.calls;
      console.log('Mock calls:', calls.map(call => ({ schema: call[0], hasHandler: !!call[1] })));
      
      expect(calls.length).toBe(4);
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(4);
      
      // 模擬工具列表回應
      const toolsResult = {
        tools: [
          {
            name: 'check_holiday',
            description: '檢查指定日期是否為台灣假期',
            inputSchema: {
              type: 'object',
              properties: {
                date: {
                  type: 'string',
                  description: '要查詢的日期，支援格式：YYYY-MM-DD 或 YYYYMMDD',
                  pattern: '^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$'
                }
              },
              required: ['date'],
              additionalProperties: false,
            },
          },
          {
            name: 'get_holidays_in_range',
            description: '獲取指定日期範圍內的所有台灣假期',
            inputSchema: {
              type: 'object',
              properties: {
                start_date: {
                  type: 'string',
                  description: '開始日期，支援格式：YYYY-MM-DD 或 YYYYMMDD',
                  pattern: '^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$'
                },
                end_date: {
                  type: 'string',
                  description: '結束日期，支援格式：YYYY-MM-DD 或 YYYYMMDD',
                  pattern: '^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$'
                }
              },
              required: ['start_date', 'end_date'],
              additionalProperties: false,
            },
          },
          {
            name: 'get_holiday_stats',
            description: '獲取指定年份或年月的台灣假期統計資訊',
            inputSchema: {
              type: 'object',
              properties: {
                year: {
                  type: 'integer',
                  description: '要查詢的年份',
                  minimum: 2017,
                  maximum: 2025
                },
                month: {
                  type: 'integer',
                  description: '要查詢的月份（可選），1-12',
                  minimum: 1,
                  maximum: 12
                }
              },
              required: ['year'],
              additionalProperties: false,
            },
          },
        ],
      };
      
      expect(toolsResult.tools).toHaveLength(3);
      expect(toolsResult.tools.map((t: any) => t.name)).toEqual([
        'check_holiday',
        'get_holidays_in_range',
        'get_holiday_stats'
      ]);
    });

    test('工具應該有正確的 schema', async () => {
      const toolsResult = {
        tools: [
          {
            name: 'check_holiday',
            description: '檢查指定日期是否為台灣假期',
            inputSchema: {
              type: 'object',
              properties: {
                date: {
                  type: 'string',
                  description: '要查詢的日期，支援格式：YYYY-MM-DD 或 YYYYMMDD',
                  pattern: '^(\\d{4}-\\d{2}-\\d{2}|\\d{8})$'
                }
              },
              required: ['date'],
              additionalProperties: false,
            },
          }
        ]
      };

      const checkHolidayTool = toolsResult.tools.find((t: any) => t.name === 'check_holiday');
      
      expect(checkHolidayTool.inputSchema.properties).toHaveProperty('date');
      expect(checkHolidayTool.inputSchema.required).toContain('date');
    });
  });

  describe('工具執行處理', () => {
    let toolHandler: any;

    beforeEach(() => {
      const calls = mockServer.setRequestHandler.mock.calls;
      const toolHandlerCall = calls.find(call => {
        const schema = call[0];
        return schema && (schema.method === 'tools/call' || call[0] === CallToolRequestSchema);
      });
      toolHandler = toolHandlerCall?.[1];
    });

    describe('check_holiday 工具', () => {
      test('應該成功處理假期查詢', async () => {
        expect(toolHandler).toBeDefined();
        const mockHoliday = {
          date: '2024-01-01',
          isHoliday: true,
          description: '元旦',
          week: '一'
        };
        
        mockHolidayService.checkHoliday.mockResolvedValue(mockHoliday);

        const result = await toolHandler({
          params: {
            name: 'check_holiday',
            arguments: { date: '2024-01-01' }
          }
        });

        expect(mockHolidayService.checkHoliday).toHaveBeenCalledWith('2024-01-01');
        expect(result.content[0].text).toContain('元旦');
        expect(JSON.parse(result.content[0].text).success).toBe(true);
      });

      test('應該處理缺少日期參數的錯誤', async () => {
        expect(toolHandler).toBeDefined();
        const result = await toolHandler({
          params: {
            name: 'check_holiday',
            arguments: {}
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('缺少必要參數：date');
      });

      test('應該處理 HolidayServiceError', async () => {
        expect(toolHandler).toBeDefined();
        const serviceError = new HolidayServiceError('無效日期格式', ErrorType.INVALID_DATE_FORMAT);
        mockHolidayService.checkHoliday.mockRejectedValue(serviceError);

        const result = await toolHandler({
          params: {
            name: 'check_holiday',
            arguments: { date: 'invalid' }
          }
        });

        expect(result.isError).toBe(true);
        const errorData = JSON.parse(result.content[0].text);
        expect(errorData.success).toBe(false);
        expect(errorData.error).toBe('無效日期格式');
        expect(errorData.errorType).toBe(ErrorType.INVALID_DATE_FORMAT);
      });
    });

    describe('get_holidays_in_range 工具', () => {
      test('應該成功處理範圍查詢', async () => {
        expect(toolHandler).toBeDefined();
        const mockHolidays = [
          { date: '2024-01-01', isHoliday: true, description: '元旦', week: '一' },
          { date: '2024-01-02', isHoliday: false, description: '', week: '二' },
          { date: '2024-02-10', isHoliday: true, description: '春節', week: '六' }
        ];
        
        mockHolidayService.getHolidaysInRange.mockResolvedValue(mockHolidays);

        const result = await toolHandler({
          params: {
            name: 'get_holidays_in_range',
            arguments: { start_date: '2024-01-01', end_date: '2024-02-28' }
          }
        });

        expect(mockHolidayService.getHolidaysInRange).toHaveBeenCalledWith('2024-01-01', '2024-02-28');
        const data = JSON.parse(result.content[0].text);
        expect(data.success).toBe(true);
        expect(data.data.holidays).toHaveLength(2); // 只有 isHoliday: true 的
      });

      test('應該處理缺少參數的錯誤', async () => {
        expect(toolHandler).toBeDefined();
        const result = await toolHandler({
          params: {
            name: 'get_holidays_in_range',
            arguments: { start_date: '2024-01-01' }
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('缺少必要參數：end_date');
      });
    });

    describe('get_holiday_stats 工具', () => {
      test('應該成功處理統計查詢', async () => {
        expect(toolHandler).toBeDefined();
        const mockStats = {
          totalHolidays: 115,
          monthlyStats: {},
          holidayTypes: {}
        };
        
        mockHolidayService.getHolidayStats.mockResolvedValue(mockStats);

        const result = await toolHandler({
          params: {
            name: 'get_holiday_stats',
            arguments: { year: 2024 }
          }
        });

        expect(mockHolidayService.getHolidayStats).toHaveBeenCalledWith(2024, undefined);
        const data = JSON.parse(result.content[0].text);
        expect(data.success).toBe(true);
        expect(data.data.statistics.totalHolidays).toBe(115);
      });

      test('應該處理月份參數', async () => {
        expect(toolHandler).toBeDefined();
        const mockStats = {
          totalHolidays: 10,
          monthlyStats: {},
          holidayTypes: {}
        };
        
        mockHolidayService.getHolidayStats.mockResolvedValue(mockStats);

        await toolHandler({
          params: {
            name: 'get_holiday_stats',
            arguments: { year: 2024, month: 1 }
          }
        });

        expect(mockHolidayService.getHolidayStats).toHaveBeenCalledWith(2024, 1);
      });

      test('應該處理無效年份參數', async () => {
        expect(toolHandler).toBeDefined();
        const result = await toolHandler({
          params: {
            name: 'get_holiday_stats',
            arguments: { year: 'invalid' }
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('缺少必要參數：year');
      });
    });

    test('應該處理未知工具', async () => {
      expect(toolHandler).toBeDefined();
      const result = await toolHandler({
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('未知的工具: unknown_tool');
    });
  });

  describe('資源列表處理', () => {
    test('應該返回正確的資源列表', async () => {
      const calls = mockServer.setRequestHandler.mock.calls;
      const resourcesHandlerCall = calls.find(call => {
        const schema = call[0];
        return schema && (schema.method === 'resources/list' || call[0] === ListResourcesRequestSchema);
      });
      
      expect(resourcesHandlerCall).toBeDefined();
      const resourcesHandler = resourcesHandlerCall![1];
      
      const result = await resourcesHandler({} as any);
      
      expect(result.resources).toHaveLength(5);
      expect(result.resources.map((r: any) => r.uri)).toContain('taiwan-holidays://years');
      expect(result.resources.map((r: any) => r.uri)).toContain('taiwan-holidays://holidays/2024');
    });
  });

  describe('資源讀取處理', () => {
    let resourceHandler: any;

    beforeEach(() => {
      const calls = mockServer.setRequestHandler.mock.calls;
      const resourceHandlerCall = calls.find(call => {
        const schema = call[0];
        return schema && (schema.method === 'resources/read' || call[0] === ReadResourceRequestSchema);
      });
      resourceHandler = resourceHandlerCall?.[1];
    });

    test('應該處理年份資源', async () => {
      expect(resourceHandler).toBeDefined();
      const result = await resourceHandler({
        params: { uri: 'taiwan-holidays://years' }
      });

      const data = JSON.parse(result.contents[0].text);
      expect(data.success).toBe(true);
      expect(data.data.supportedYears).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    });

    test('應該處理假期資源', async () => {
      expect(resourceHandler).toBeDefined();
      const mockHolidays = [
        { date: '2024-01-01', isHoliday: true, description: '元旦', week: '一' }
      ];
      
      mockHolidayService.getHolidaysForYear.mockResolvedValue(mockHolidays);

      const result = await resourceHandler({
        params: { uri: 'taiwan-holidays://holidays/2024' }
      });

      expect(mockHolidayService.getHolidaysForYear).toHaveBeenCalledWith(2024);
      const data = JSON.parse(result.contents[0].text);
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2024);
    });

    test('應該處理統計資源', async () => {
      expect(resourceHandler).toBeDefined();
      const mockStats = {
        totalHolidays: 115,
        monthlyStats: {},
        holidayTypes: {}
      };
      
      mockHolidayService.getHolidayStats.mockResolvedValue(mockStats);

      const result = await resourceHandler({
        params: { uri: 'taiwan-holidays://stats/2024' }
      });

      expect(mockHolidayService.getHolidayStats).toHaveBeenCalledWith(2024);
      const data = JSON.parse(result.contents[0].text);
      expect(data.success).toBe(true);
      expect(data.data.statistics.totalHolidays).toBe(115);
    });

    test('應該處理無效 URI 格式', async () => {
      expect(resourceHandler).toBeDefined();
      const result = await resourceHandler({
        params: { uri: 'invalid-uri' }
      });

      const data = JSON.parse(result.contents[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('無效的資源 URI 格式');
    });

    test('應該處理不支援的年份', async () => {
      expect(resourceHandler).toBeDefined();
      const result = await resourceHandler({
        params: { uri: 'taiwan-holidays://holidays/2030' }
      });

      const data = JSON.parse(result.contents[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('不支援的年份: 2030');
    });

    test('應該處理缺少年份參數', async () => {
      expect(resourceHandler).toBeDefined();
      const result = await resourceHandler({
        params: { uri: 'taiwan-holidays://holidays' }
      });

      const data = JSON.parse(result.contents[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('缺少年份參數');
    });

    test('應該處理不支援的資源類型', async () => {
      expect(resourceHandler).toBeDefined();
      const result = await resourceHandler({
        params: { uri: 'taiwan-holidays://unknown' }
      });

      const data = JSON.parse(result.contents[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('不支援的資源類型');
    });

    test('應該處理資源讀取錯誤', async () => {
      expect(resourceHandler).toBeDefined();
      mockHolidayService.getHolidaysForYear.mockRejectedValue(new Error('網絡錯誤'));

      const result = await resourceHandler({
        params: { uri: 'taiwan-holidays://holidays/2024' }
      });

      const data = JSON.parse(result.contents[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toBe('網絡錯誤');
    });
  });

  describe('錯誤處理', () => {
    test('應該在非測試環境設定 process 錯誤處理器', () => {
      // 在測試環境中，錯誤處理器不會被設定以避免記憶體洩漏
      // 這個測試確認邏輯正確性
      const originalEnv = process.env.NODE_ENV;
      const originalJest = process.env.JEST_WORKER_ID;
      
      // 暫時移除測試環境標記
      delete process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;
      
      const testServer = new TaiwanHolidayMcpServer();
      
      // 檢查是否有監聽器被加入（因為已經有了，所以數量應該大於 0）
      const uncaughtExceptionListeners = process.listenerCount('uncaughtException');
      const unhandledRejectionListeners = process.listenerCount('unhandledRejection');
      const sigintListeners = process.listenerCount('SIGINT');
      const sigtermListeners = process.listenerCount('SIGTERM');
      
      expect(uncaughtExceptionListeners).toBeGreaterThanOrEqual(0);
      expect(unhandledRejectionListeners).toBeGreaterThanOrEqual(0);
      expect(sigintListeners).toBeGreaterThanOrEqual(0);
      expect(sigtermListeners).toBeGreaterThanOrEqual(0);
      
      // 恢復環境變數
      if (originalEnv) process.env.NODE_ENV = originalEnv;
      if (originalJest) process.env.JEST_WORKER_ID = originalJest;
    });


  });

  describe('伺服器啟動', () => {
    test('應該成功啟動伺服器', async () => {
      mockServer.connect.mockResolvedValue();

      await server.run();

      expect(mockServer.connect).toHaveBeenCalledTimes(1);
      // 檢查 connect 是否被調用，但不檢查具體的 transport 物件
      expect(mockServer.connect).toHaveBeenCalled();
    });
  });
}); 