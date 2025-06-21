#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource,
  TextResourceContents,
} from '@modelcontextprotocol/sdk/types.js';
import { HolidayService, HolidayServiceError } from './holiday-service.js';
import { ErrorType } from './types.js';
import { HealthMonitor, DefaultHealthChecks, HealthStatus } from './utils/health-monitor.js';
import { GracefulShutdown, DefaultShutdownHandlers } from './utils/graceful-shutdown.js';

/**
 * Taiwan Holiday MCP Server
 * 
 * 提供台灣假期查詢功能的 MCP 伺服器
 * 階段：完整功能 Cursor 驗證點
 */
export class TaiwanHolidayMcpServer {
  private server: Server;
  private holidayService: HolidayService;
  private healthMonitor: HealthMonitor;
  private gracefulShutdown?: GracefulShutdown;

  constructor() {
    this.server = new Server(
      {
        name: 'taiwan-holiday-mcp',
        version: '1.0.2',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // 初始化假期服務
    this.holidayService = new HolidayService();

    // 初始化健康監控
    this.healthMonitor = new HealthMonitor('1.0.2');
    this.setupHealthChecks();

    // 初始化優雅關機（測試環境中跳過）
    if (process.env.NODE_ENV !== 'test' && process.env.JEST_WORKER_ID === undefined) {
      this.gracefulShutdown = new GracefulShutdown({
        timeout: 10000, // 10 秒超時
        logger: (message) => console.log(message),
        delay: 1000, // 1 秒延遲
      });
      this.setupShutdownHandlers();
    }

    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupErrorHandling();
  }

  /**
   * 設定工具處理器
   */
  private setupToolHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
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
          } as Tool,
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
          } as Tool,
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
          } as Tool,
        ],
      };
    });

    // 執行工具
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'check_holiday':
            return await this.handleCheckHoliday(args);

          case 'get_holidays_in_range':
            return await this.handleGetHolidaysInRange(args);

          case 'get_holiday_stats':
            return await this.handleGetHolidayStats(args);

          default:
            throw new Error(`未知的工具: ${name}`);
        }
      } catch (error) {
        // 在除錯模式下輸出錯誤訊息到 stderr
        if (process.env.DEBUG === 'true') {
          console.error(`工具執行錯誤 [${name}]:`, error);
        }
        
        const errorMessage = error instanceof HolidayServiceError ? error.message : 
                          error instanceof Error ? error.message : '未知錯誤';
        const errorType = error instanceof HolidayServiceError ? error.type : ErrorType.UNKNOWN_ERROR;
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: errorMessage,
                errorType: errorType,
                timestamp: new Date().toISOString(),
                tool: name
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * 設定資源處理器
   */
  private setupResourceHandlers(): void {
    // 列出可用資源
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'taiwan-holidays://years',
            name: '支援的年份列表',
            description: '列出所有支援查詢的年份範圍',
            mimeType: 'application/json',
          } as Resource,
          {
            uri: 'taiwan-holidays://holidays/2024',
            name: '2024年台灣假期',
            description: '2024年完整的台灣假期資料',
            mimeType: 'application/json',
          } as Resource,
          {
            uri: 'taiwan-holidays://holidays/2025',
            name: '2025年台灣假期',
            description: '2025年完整的台灣假期資料',
            mimeType: 'application/json',
          } as Resource,
          {
            uri: 'taiwan-holidays://stats/2024',
            name: '2024年假期統計',
            description: '2024年台灣假期統計資訊',
            mimeType: 'application/json',
          } as Resource,
          {
            uri: 'taiwan-holidays://stats/2025',
            name: '2025年假期統計',
            description: '2025年台灣假期統計資訊',
            mimeType: 'application/json',
          } as Resource,
          {
            uri: 'taiwan-holidays://health',
            name: '系統健康狀態',
            description: '即時系統健康狀態和診斷資訊',
            mimeType: 'application/json',
          } as Resource,
          {
            uri: 'taiwan-holidays://health/quick',
            name: '快速健康檢查',
            description: '快速系統健康狀態檢查',
            mimeType: 'application/json',
          } as Resource,
        ],
      };
    });

    // 讀取資源內容
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        return await this.handleReadResource(uri);
      } catch (error) {
        // 在除錯模式下輸出錯誤訊息到 stderr
        if (process.env.DEBUG === 'true') {
          console.error(`資源讀取錯誤 [${uri}]:`, error);
        }
        
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        
        return {
          contents: [
            {
              uri: uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                success: false,
                error: errorMessage,
                timestamp: new Date().toISOString(),
                resource: uri
              }, null, 2),
            } as TextResourceContents,
          ],
        };
      }
    });
  }

  /**
   * 處理資源讀取
   */
  private async handleReadResource(uri: string) {
    const parsedUri = this.parseResourceUri(uri);
    
    switch (parsedUri.type) {
      case 'years':
        return this.getYearsResource();
      
      case 'holidays':
        if (!parsedUri.year) {
          throw new Error('缺少年份參數');
        }
        return this.getHolidaysResource(parsedUri.year);
      
      case 'stats':
        if (!parsedUri.year) {
          throw new Error('缺少年份參數');
        }
        return this.getStatsResource(parsedUri.year);
      
      case 'health':
        return this.getHealthResource();
      
      case 'health/quick':
        return this.getQuickHealthResource();
      
      default:
        throw new Error(`不支援的資源類型: ${uri}`);
    }
  }

  /**
   * 解析資源 URI
   */
  private parseResourceUri(uri: string): { type: string; year?: number } {
    const match = uri.match(/^taiwan-holidays:\/\/(\w+)(?:\/(\d{4}))?$/);
    
    if (!match) {
      throw new Error(`無效的資源 URI 格式: ${uri}`);
    }
    
    const [, type, yearStr] = match;
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    
    if (year && (year < 2017 || year > 2025)) {
      throw new Error(`不支援的年份: ${year}。支援範圍: 2017-2025`);
    }
    
    return { type, year };
  }

  /**
   * 獲取年份列表資源
   */
  private getYearsResource() {
    const years = [];
    for (let year = 2017; year <= 2025; year++) {
      years.push(year);
    }
    
    return {
      contents: [
        {
          uri: 'taiwan-holidays://years',
          mimeType: 'application/json',
          text: JSON.stringify({
            success: true,
            data: {
              supportedYears: years,
              totalYears: years.length,
              description: '台灣假期 MCP 伺服器支援的年份範圍',
              note: '資料來源：TaiwanCalendar'
            },
            timestamp: new Date().toISOString(),
            resource: 'years'
          }, null, 2),
        } as TextResourceContents,
      ],
    };
  }

  /**
   * 獲取假期資源
   */
  private async getHolidaysResource(year: number) {
    const holidays = await this.holidayService.getHolidaysForYear(year);
    
    return {
      contents: [
        {
          uri: `taiwan-holidays://holidays/${year}`,
          mimeType: 'application/json',
          text: JSON.stringify({
            success: true,
            data: {
              year: year,
              holidays: holidays,
              totalCount: holidays.length,
              holidayCount: holidays.filter(h => h.isHoliday).length,
              description: `${year}年台灣假期完整資料`,
              source: 'TaiwanCalendar'
            },
            timestamp: new Date().toISOString(),
            resource: `holidays/${year}`
          }, null, 2),
        } as TextResourceContents,
      ],
    };
  }

  /**
   * 獲取統計資源
   */
  private async getStatsResource(year: number) {
    const stats = await this.holidayService.getHolidayStats(year);
    
    return {
      contents: [
        {
          uri: `taiwan-holidays://stats/${year}`,
          mimeType: 'application/json',
          text: JSON.stringify({
            success: true,
            data: {
              year: year,
              statistics: stats,
              description: `${year}年台灣假期統計資訊`,
              source: 'TaiwanCalendar'
            },
            timestamp: new Date().toISOString(),
            resource: `stats/${year}`
          }, null, 2),
        } as TextResourceContents,
      ],
    };
  }

  /**
   * 獲取健康狀態資源
   */
  private async getHealthResource() {
    try {
      const healthData = await this.healthMonitor.performHealthCheck();
      
      return {
        contents: [
          {
            uri: 'taiwan-holidays://health',
            mimeType: 'application/json',
            text: JSON.stringify({
              success: true,
              data: healthData,
              description: '系統健康狀態詳細報告',
              timestamp: new Date().toISOString(),
            }, null, 2),
          } as TextResourceContents,
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: 'taiwan-holidays://health',
            mimeType: 'application/json',
            text: JSON.stringify({
              success: false,
              error: '健康檢查失敗',
              details: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            }, null, 2),
          } as TextResourceContents,
        ],
      };
    }
  }

  /**
   * 獲取快速健康狀態資源
   */
  private getQuickHealthResource() {
    try {
      const quickStatus = this.healthMonitor.getQuickStatus();
      
      return {
        contents: [
          {
            uri: 'taiwan-holidays://health/quick',
            mimeType: 'application/json',
            text: JSON.stringify({
              success: true,
              data: quickStatus,
              description: '快速健康狀態檢查',
              timestamp: new Date().toISOString(),
            }, null, 2),
          } as TextResourceContents,
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: 'taiwan-holidays://health/quick',
            mimeType: 'application/json',
            text: JSON.stringify({
              success: false,
              error: '快速健康檢查失敗',
              details: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            }, null, 2),
          } as TextResourceContents,
        ],
      };
    }
  }

  /**
   * 處理檢查假期工具
   */
  private async handleCheckHoliday(args: any) {
    const { date } = args;
    
    if (!date || typeof date !== 'string') {
      throw new Error('缺少必要參數：date');
    }

    const holiday = await this.holidayService.checkHoliday(date);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              date: date,
              isHoliday: holiday?.isHoliday || false,
              description: holiday?.description || '一般工作日',
              week: holiday?.week || '',
              normalizedDate: holiday?.date || ''
            },
            timestamp: new Date().toISOString(),
            tool: 'check_holiday'
          }, null, 2),
        },
      ],
    };
  }

  /**
   * 處理獲取範圍假期工具
   */
  private async handleGetHolidaysInRange(args: any) {
    const { start_date, end_date } = args;
    
    if (!start_date || typeof start_date !== 'string') {
      throw new Error('缺少必要參數：start_date');
    }
    
    if (!end_date || typeof end_date !== 'string') {
      throw new Error('缺少必要參數：end_date');
    }

    const holidays = await this.holidayService.getHolidaysInRange(start_date, end_date);
    
    // 只返回實際的假期（isHoliday: true）
    const actualHolidays = holidays.filter(h => h.isHoliday);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              startDate: start_date,
              endDate: end_date,
              holidays: actualHolidays,
              totalCount: actualHolidays.length,
              summary: `在 ${start_date} 到 ${end_date} 期間共有 ${actualHolidays.length} 個假期`
            },
            timestamp: new Date().toISOString(),
            tool: 'get_holidays_in_range'
          }, null, 2),
        },
      ],
    };
  }

  /**
   * 處理獲取假期統計工具
   */
  private async handleGetHolidayStats(args: any) {
    const { year, month } = args;
    
    if (!year || typeof year !== 'number') {
      throw new Error('缺少必要參數：year');
    }

    const stats = await this.holidayService.getHolidayStats(year, month);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              year: year,
              month: month,
              statistics: stats,
              summary: month 
                ? `${year} 年 ${month} 月共有 ${stats.totalHolidays} 個假期`
                : `${year} 年共有 ${stats.totalHolidays} 個假期`
            },
            timestamp: new Date().toISOString(),
            tool: 'get_holiday_stats'
          }, null, 2),
        },
      ],
    };
  }

  /**
   * 設定健康檢查
   */
  private setupHealthChecks(): void {
    // 基本存活檢查
    this.healthMonitor.registerCheck('aliveness', DefaultHealthChecks.aliveness());

    // 記憶體使用檢查
    this.healthMonitor.registerCheck('memory', DefaultHealthChecks.memoryUsage(85));

    // 外部 API 檢查
    this.healthMonitor.registerCheck(
      'taiwan-calendar-api',
      DefaultHealthChecks.externalApi('https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/2024.json', 5000)
    );

    // 服務狀態檢查
    this.healthMonitor.registerCheck('holiday-service', async () => {
      try {
        const circuitBreakerStats = this.holidayService.getCircuitBreakerStats();
        const cacheStats = this.holidayService.getCacheStats();
        const throttlerStats = this.holidayService.getThrottlerStats();

        let status = HealthStatus.HEALTHY;
        
        // 檢查 Circuit Breaker 狀態
        if (circuitBreakerStats.state === 'OPEN') {
          status = HealthStatus.DEGRADED;
        }

        // 檢查快取命中率
        if (cacheStats.hitRate < 50 && cacheStats.totalRequests > 10) {
          status = HealthStatus.DEGRADED;
        }

        // 檢查請求佇列
        if (throttlerStats.droppedRequests > throttlerStats.totalRequests * 0.1) {
          status = HealthStatus.DEGRADED;
        }

        return {
          name: 'holiday-service',
          status,
          responseTime: 0,
          details: {
            circuitBreaker: circuitBreakerStats,
            cache: cacheStats,
            throttler: throttlerStats,
          },
          timestamp: Date.now(),
        };
      } catch (error) {
        return {
          name: 'holiday-service',
          status: HealthStatus.UNHEALTHY,
          responseTime: 0,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        };
      }
    });
  }

  /**
   * 設定關機處理器
   */
  private setupShutdownHandlers(): void {
    if (!this.gracefulShutdown) {
      return;
    }
    // 清理快取
    this.gracefulShutdown.registerHandler(async () => {
      this.holidayService.clearCache();
    });

    // 清理過期快取
    this.gracefulShutdown.registerHandler(async () => {
      this.holidayService.clearExpiredCache();
    });

    // 銷毀服務
    this.gracefulShutdown.registerHandler(async () => {
      this.holidayService.destroy();
    });

    // 清理健康監控
    this.gracefulShutdown.registerHandler(async () => {
      this.healthMonitor.clearResults();
    });
  }

  /**
   * 設定錯誤處理
   */
  private setupErrorHandling(): void {
    // 在測試環境中跳過全域事件監聽器設定
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
      return;
    }

    // 檢查是否已經設定過監聽器，避免重複註冊
    const existingListeners = {
      uncaughtException: process.listenerCount('uncaughtException'),
      unhandledRejection: process.listenerCount('unhandledRejection'),
      SIGINT: process.listenerCount('SIGINT'),
      SIGTERM: process.listenerCount('SIGTERM'),
    };

    // 注意：錯誤處理已由 GracefulShutdown 類別統一管理
    // 這裡只保留 MCP 特定的錯誤處理邏輯
  }

  /**
   * 啟動伺服器
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    if (process.env.DEBUG === 'true') {
      console.error('Taiwan Holiday MCP 伺服器已啟動 - 完整功能版本'); // 使用 stderr 避免干擾 JSON-RPC
    }
  }
}

// 注意：直接執行檢查移至 index.ts，避免測試環境問題 