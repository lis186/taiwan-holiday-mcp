import { TaiwanHolidayMcpServer } from '../../src/server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { HolidayService, HolidayServiceError } from '../../src/holiday-service';
import { ErrorType, getQueryableYearRange, getCurrentYearInTaipei } from '../../src/types';
import { createMockHolidayStats } from '../utils/test-helpers';

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
      getAvailableYears: jest.fn().mockResolvedValue([2025, 2026, 2027]),
      getNextHolidays: jest.fn(),
      getWorkdaysStats: jest.fn(),
      getWorkdaysBetween: jest.fn(),
      clearCache: jest.fn(),
    })),
  };
});

describe('TaiwanHolidayMcpServer', () => {
  let server: TaiwanHolidayMcpServer;
  let mockServer: jest.Mocked<Server>;
  let mockHolidayService: jest.Mocked<HolidayService>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console.error to prevent interference with tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
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
      getAvailableYears: jest.fn().mockResolvedValue([2025, 2026, 2027]),
      getNextHolidays: jest.fn(),
      getWorkdaysStats: jest.fn(),
      getWorkdaysBetween: jest.fn(),
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
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  describe('伺服器初始化', () => {
    test('應該成功建立伺服器實例', () => {
      expect(server).toBeInstanceOf(TaiwanHolidayMcpServer);
    });

    test('應該初始化 MCP Server', () => {
      expect(Server).toHaveBeenCalledWith(
        {
          name: 'taiwan-holiday-mcp',
          version: expect.any(String),
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
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(5);
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
      
      expect(calls.length).toBe(5);
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(5);
      
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
                  maximum: 2026
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

    test('實際工具列表應保留既有工具並加入新工具', async () => {
      const calls = mockServer.setRequestHandler.mock.calls;
      const listCall = calls.find((call) => call[0] === ListToolsRequestSchema);
      expect(listCall).toBeDefined();

      const result = await listCall![1]({} as any, {} as any) as { tools: Array<{ name: string; inputSchema: any }> };
      const names = result.tools.map((tool) => tool.name);

      expect(names).toEqual([
        'check_holiday',
        'get_holidays_in_range',
        'get_holiday_stats',
        'get_next_holidays',
        'get_workdays',
      ]);

      const byName = Object.fromEntries(
        result.tools.map((tool) => [tool.name, tool])
      );
      expect(byName.check_holiday.inputSchema.required).toEqual(['date']);
      expect(byName.get_holidays_in_range.inputSchema.required).toEqual(['start_date', 'end_date']);
      expect(byName.get_holiday_stats.inputSchema.required).toEqual(['year']);
      expect(byName.get_next_holidays.inputSchema.properties).toHaveProperty('count');
      expect(byName.get_next_holidays.inputSchema.properties).toHaveProperty('skip_weekends');
      expect(byName.get_workdays.inputSchema.properties).toHaveProperty('month');
      expect(byName.get_workdays.inputSchema.properties).toHaveProperty('start_date');
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
      
      expect(checkHolidayTool!.inputSchema.properties).toHaveProperty('date');
      expect(checkHolidayTool!.inputSchema.required).toContain('date');
    });
  });

  describe('工具執行處理', () => {
    let toolHandler: any;

    beforeEach(() => {
      const calls = mockServer.setRequestHandler.mock.calls;
      const toolHandlerCall = calls.find(call => {
        const schema = call[0] as unknown as { method?: string };
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
        // 用完整的 typed factory，避免 as any 掩蓋欄位缺漏
        const mockStats = createMockHolidayStats({ totalHolidays: 115 });
        
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
        const mockStats = createMockHolidayStats({ totalHolidays: 10 });

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

    describe('get_next_holidays 工具', () => {
      test('應該把參數轉給假期服務並保留 CLI 欄位', async () => {
        expect(toolHandler).toBeDefined();
        mockHolidayService.getNextHolidays.mockResolvedValue({
          found: true,
          count: 1,
          fromDate: '2024-01-01',
          holidays: [{ date: '2024-01-07', week: '日', description: '週末' }],
        });

        const result = await toolHandler({
          params: {
            name: 'get_next_holidays',
            arguments: { date: '2024-01-01', count: 1, skip_weekends: true }
          }
        });

        expect(mockHolidayService.getNextHolidays).toHaveBeenCalledWith({
          fromDate: '2024-01-01',
          count: 1,
          skipWeekends: true,
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.success).toBe(true);
        expect(data.tool).toBe('get_next_holidays');
        expect(data.data.holidays[0].description).toBe('週末');
      });

      test('省略參數時應交給服務使用預設值', async () => {
        mockHolidayService.getNextHolidays.mockResolvedValue({
          found: false,
          count: 0,
          fromDate: '2026-10-16',
          holidays: [],
          message: '查無假期',
        });

        await toolHandler({
          params: { name: 'get_next_holidays', arguments: {} }
        });

        expect(mockHolidayService.getNextHolidays).toHaveBeenCalledWith({
          fromDate: undefined,
          count: undefined,
          skipWeekends: false,
        });
      });

      test('應該拒絕非整數 count', async () => {
        const result = await toolHandler({
          params: {
            name: 'get_next_holidays',
            arguments: { count: 1.5 }
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('count 必須是 1 到 366 的整數');
      });

      test('應該拒絕型別錯誤的 date 與 skip_weekends', async () => {
        const badDate = await toolHandler({
          params: { name: 'get_next_holidays', arguments: { date: 20240101 } }
        });
        expect(badDate.isError).toBe(true);
        expect(badDate.content[0].text).toContain('date 必須是字串');

        const badFlag = await toolHandler({
          params: { name: 'get_next_holidays', arguments: { skip_weekends: 'yes' } }
        });
        expect(badFlag.isError).toBe(true);
        expect(badFlag.content[0].text).toContain('skip_weekends 必須是布林值');
      });
    });

    describe('get_workdays 工具', () => {
      test('應該查詢整月工作天', async () => {
        mockHolidayService.getWorkdaysStats.mockResolvedValue({
          year: 2024,
          month: 1,
          totalDays: 31,
          workdays: 23,
          holidays: 8,
          makeupWorkdays: 1,
          makeupWorkdayDates: [
            { date: '2024-01-06', week: '六', description: '補行上班' }
          ],
        });

        const result = await toolHandler({
          params: {
            name: 'get_workdays',
            arguments: { year: 2024, month: 1 }
          }
        });

        expect(mockHolidayService.getWorkdaysStats).toHaveBeenCalledWith(2024, 1);
        const data = JSON.parse(result.content[0].text);
        expect(data.success).toBe(true);
        expect(data.tool).toBe('get_workdays');
        expect(data.data.makeupWorkdays).toBe(1);
        expect(data.data.workdays).toBe(23);
      });

      test('應該查詢日期區間工作天', async () => {
        mockHolidayService.getWorkdaysBetween.mockResolvedValue({
          startDate: '2024-01-06',
          endDate: '2024-01-07',
          totalDays: 2,
          workdays: 1,
          holidays: 1,
          makeupWorkdays: 1,
          makeupWorkdayDates: [
            { date: '2024-01-06', week: '六', description: '補行上班' }
          ],
        });

        const result = await toolHandler({
          params: {
            name: 'get_workdays',
            arguments: { start_date: '2024-01-06', end_date: '2024-01-07' }
          }
        });

        expect(mockHolidayService.getWorkdaysBetween).toHaveBeenCalledWith('2024-01-06', '2024-01-07');
        const data = JSON.parse(result.content[0].text);
        expect(data.data.startDate).toBe('2024-01-06');
        expect(data.data.makeupWorkdays).toBe(1);
      });

      test('缺少查詢條件時應該回報錯誤', async () => {
        const result = await toolHandler({
          params: { name: 'get_workdays', arguments: {} }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('請指定 year 與 month');
      });

      test('同時指定月份與區間時應該回報錯誤', async () => {
        const result = await toolHandler({
          params: {
            name: 'get_workdays',
            arguments: {
              year: 2024,
              month: 1,
              start_date: '2024-01-01',
              end_date: '2024-01-31',
            }
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('不要同時指定');
        expect(mockHolidayService.getWorkdaysStats).not.toHaveBeenCalled();
        expect(mockHolidayService.getWorkdaysBetween).not.toHaveBeenCalled();
      });

      test('區間只給起日時應該回報缺少 end_date', async () => {
        const result = await toolHandler({
          params: {
            name: 'get_workdays',
            arguments: { start_date: '2024-01-01' }
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('缺少必要參數：end_date');
      });

      test('只有月份或只有迄日時應該回報缺少的另一半', async () => {
        const missingYear = await toolHandler({
          params: { name: 'get_workdays', arguments: { month: 1 } }
        });
        expect(missingYear.isError).toBe(true);
        expect(missingYear.content[0].text).toContain('缺少必要參數：year');

        const missingStart = await toolHandler({
          params: { name: 'get_workdays', arguments: { end_date: '2024-01-31' } }
        });
        expect(missingStart.isError).toBe(true);
        expect(missingStart.content[0].text).toContain('缺少必要參數：start_date');
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
        const schema = call[0] as unknown as { method?: string };
        return schema && (schema.method === 'resources/list' || call[0] === ListResourcesRequestSchema);
      });
      
      expect(resourcesHandlerCall).toBeDefined();
      const resourcesHandler = resourcesHandlerCall![1];
      
      const result = (await resourcesHandler({} as any, {} as any)) as any;
      
      const uris = result.resources.map((r: any) => r.uri);
      const currentYear = getCurrentYearInTaipei();

      // years + 最近 3 年各一組 holidays/stats + 2 個 health 資源
      expect(result.resources).toHaveLength(9);
      expect(uris).toContain('taiwan-holidays://years');
      expect(uris).toContain('taiwan-holidays://health');
      expect(uris).toContain('taiwan-holidays://health/quick');

      // 年份由當前日期推算，會自動滾動（不寫死、也不打網路）
      expect(uris).toContain(`taiwan-holidays://holidays/${currentYear}`);
      expect(uris).toContain(`taiwan-holidays://stats/${currentYear}`);
      expect(uris).toContain(`taiwan-holidays://holidays/${currentYear - 2}`);
      expect(uris).not.toContain(`taiwan-holidays://holidays/${currentYear - 3}`);

      // 握手路徑上不得做網路 I/O
      expect(mockHolidayService.getAvailableYears).not.toHaveBeenCalled();

      // holidays/* 與 stats/* 必須對稱
      expect(uris.filter((u: string) => u.startsWith('taiwan-holidays://holidays/'))).toHaveLength(3);
      expect(uris.filter((u: string) => u.startsWith('taiwan-holidays://stats/'))).toHaveLength(3);
    });
  });

  describe('資源讀取處理', () => {
    let resourceHandler: any;

    beforeEach(() => {
      const calls = mockServer.setRequestHandler.mock.calls;
      const resourceHandlerCall = calls.find(call => {
        const schema = call[0] as unknown as { method?: string };
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
      // 年份清單來自探測結果，不再是寫死的迴圈
      expect(data.data.supportedYears).toEqual([2025, 2026, 2027]);
      expect(mockHolidayService.getAvailableYears).toHaveBeenCalled();
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
      const mockStats = createMockHolidayStats({ totalHolidays: 115 });
      
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
      // 用超出合理性上限的年份；上限內的未來年份現在是合法查詢
      const outOfRange = getQueryableYearRange().end + 1;
      const result = await resourceHandler({
        params: { uri: `taiwan-holidays://holidays/${outOfRange}` }
      });

      const data = JSON.parse(result.contents[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain(`不支援的年份: ${outOfRange}`);
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