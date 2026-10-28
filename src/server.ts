#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource,
  ResourceTemplate,
  TextResourceContents,
} from '@modelcontextprotocol/sdk/types.js';
import { getTyphoonService } from 'taiwan-holiday-cli';
import type { TyphoonQueryResult, TyphoonVerdict } from 'taiwan-holiday-cli';
import { HolidayService, HolidayServiceError } from './holiday-service.js';
import { ErrorType, getQueryableYearRange, getCurrentYearInTaipei } from './types.js';
import { HealthMonitor, DefaultHealthChecks, HealthStatus } from './utils/health-monitor.js';
import { GracefulShutdown, DefaultShutdownHandlers } from './utils/graceful-shutdown.js';
/**
 * 找不到注入版本時的預設值。
 *
 * 版本由進入點（src/index.ts）從 package.json 讀出後注入，server 類別本身
 * 不做檔案 I/O —— 先前在此用 import.meta.url 讀檔，會讓以 CJS 轉譯的單元測試
 * 整個套件無法載入。也不再於原始碼寫死版本（曾是 '1.0.2' 而 HealthMonitor
 * 是 '1.0.0'，兩者都與 package.json 不同步）。
 */
const FALLBACK_VERSION = '0.0.0-dev';

/**
 * 資源清單裡列出最近幾年的 holidays / stats，避免把所有年份都塞進去
 */
const RECENT_YEARS_IN_RESOURCE_LIST = 3;

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

  constructor(version: string = FALLBACK_VERSION) {
    this.server = new Server(
      {
        name: 'taiwan-holiday-mcp',
        version,
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
    this.healthMonitor = new HealthMonitor(version);
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
                  minimum: getQueryableYearRange().start,
                  maximum: getQueryableYearRange().end
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
          {
            name: 'check_typhoon_closure',
            description: [
              '查詢台灣颱風假（天然災害停止上班上課）。今天、明天讀行政院人事行政總處（DGPA）即時頁，其他日期讀 2001-07-30 起的歸檔。',
              '頂層 work／school 的 status 判讀規則：',
              '- stopped：全縣市停止，時段見 period／from。',
              '- conditional：只有部分地區、學制或時段停止，必須逐一讀 cities[].rows 判斷是否適用使用者所在地；未指定縣市時只要有任何停止就是 conditional。',
              '- normal：有公告且照常，或確定當日無公告。',
              '- unknown：無法判斷。絕對不可當成「照常上班上課」回答，應告知無法確認並請使用者查看縣市政府或 DGPA 公告。',
              'reason 非 null 代表結果仍可能改變：live 為即時頁、當天仍可能更新；pending 為歸檔可能尚未收錄（昨天到 21 天前常見）；source_not_ready 為當年度資料尚未產生。',
              '回答時請轉述 summary 與 notes，並以各縣市政府公告為準。'
            ].join('\n'),
            inputSchema: {
              type: 'object',
              properties: {
                date: {
                  type: 'string',
                  description: '要查詢的日期（臺灣時間），支援 today、tomorrow、YYYY-MM-DD 或 YYYYMMDD；省略為今天。最早 2001-07-30',
                  pattern: '^(today|tomorrow|\\d{4}-\\d{2}-\\d{2}|\\d{8})$'
                },
                city: {
                  type: 'string',
                  description: '縣市名稱（可選），例如「臺北市」；台／臺視為相同。縣市名保留當時名稱，不對應改制前後的行政區。省略則回傳全國'
                }
              },
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

          case 'check_typhoon_closure':
            return await this.handleCheckTyphoonClosure(args);

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
          // 列出上游最近幾年，避免每年手動更新這份清單
          ...this.getRecentYearResources(),
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

    // 宣告 URI 樣板：資源清單只列最近幾年當入口建議，但實際上任何年份都可以嘗試。
    // 有了樣板，client 不必受限於清單裡列出的年份，也就不需要為了「不漏列剛發布
    // 的年度」而在 resources/list 上做網路探測。
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      return {
        resourceTemplates: [
          {
            uriTemplate: 'taiwan-holidays://holidays/{year}',
            name: '指定年份的台灣假期',
            description: `任一年份的完整假期資料（${getQueryableYearRange().start} 起；實際可用年份見 taiwan-holidays://years）`,
            mimeType: 'application/json',
          } as ResourceTemplate,
          {
            uriTemplate: 'taiwan-holidays://stats/{year}',
            name: '指定年份的假期統計',
            description: `任一年份的假期統計（${getQueryableYearRange().start} 起；實際可用年份見 taiwan-holidays://years）`,
            mimeType: 'application/json',
          } as ResourceTemplate,
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
        return await this.getYearsResource();
      
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
    
    const { start: minYear, end: maxYear } = getQueryableYearRange();
    if (year && (year < minYear || year > maxYear)) {
      throw new Error(`不支援的年份: ${year}。可查詢範圍: ${minYear}-${maxYear}`);
    }
    
    return { type, year };
  }

  /**
   * 產生最近幾年的 holidays / stats 資源項目。
   *
   * 刻意**不打網路**：`resources/list` 位於 MCP 握手後的第一個往返上，
   * 原本是純同步、不可能失敗的。若在這裡做探測，離線或上游慢時會等到
   * timeout 才失敗，client 可能判定 server 初始化異常。
   *
   * 年份由當前日期推算，所以會自動滾動、不會像寫死 2024/2025 那樣過期。
   * 「任意年份皆可嘗試」由 `resources/templates/list` 宣告，
   * 精確的可用年份由 `taiwan-holidays://years` 提供。
   */
  private getRecentYearResources(): Resource[] {
    const currentYear = getCurrentYearInTaipei();
    const recentYears = Array.from(
      { length: RECENT_YEARS_IN_RESOURCE_LIST },
      (_, i) => currentYear - (RECENT_YEARS_IN_RESOURCE_LIST - 1 - i)
    );

    return recentYears.flatMap((year) => [
      {
        uri: `taiwan-holidays://holidays/${year}`,
        name: `${year}年台灣假期`,
        description: `${year}年完整的台灣假期資料`,
        mimeType: 'application/json',
      } as Resource,
      {
        uri: `taiwan-holidays://stats/${year}`,
        name: `${year}年假期統計`,
        description: `${year}年台灣假期統計資訊`,
        mimeType: 'application/json',
      } as Resource,
    ]);
  }

  /**
   * 獲取年份列表資源
   */
  private async getYearsResource() {
    const years = await this.holidayService.getAvailableYears();

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
   * 處理颱風假查詢工具
   *
   * 判斷規則與 DGPA 即時頁解析都在 taiwan-holiday-cli，這裡只做參數驗證、
   * 錯誤轉換與一行摘要，避免兩邊規則漂移。
   */
  private async handleCheckTyphoonClosure(args: any) {
    const { date, city } = args ?? {};

    if (date !== undefined && typeof date !== 'string') {
      throw new HolidayServiceError('date 必須是字串', ErrorType.INVALID_DATE);
    }
    if (city !== undefined && typeof city !== 'string') {
      throw new HolidayServiceError('city 必須是字串', ErrorType.UNKNOWN_ERROR);
    }

    let result: TyphoonQueryResult;
    try {
      result = await getTyphoonService().getTyphoonStatus(date ?? 'today', city || undefined);
    } catch (error) {
      throw toHolidayServiceError(error);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            summary: summarizeTyphoon(result),
            data: result,
            timestamp: new Date().toISOString(),
            tool: 'check_typhoon_closure'
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

/**
 * taiwan-holiday-cli 的錯誤類別沒有從套件入口匯出，改以 ExitCode（code 屬性）辨識：
 * 2 驗證、3 網路、4 資料
 */
function toHolidayServiceError(error: unknown): HolidayServiceError {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown } | null)?.code;
  const type =
    code === 2 ? ErrorType.INVALID_DATE :
    code === 3 ? ErrorType.NETWORK_ERROR :
    code === 4 ? ErrorType.DATA_NOT_FOUND :
    ErrorType.UNKNOWN_ERROR;
  return new HolidayServiceError(message, type, error instanceof Error ? error : undefined);
}

const TYPHOON_PERIOD_LABEL: Record<string, string> = {
  allDay: '全天',
  morning: '上午',
  afternoon: '下午',
  evening: '晚間',
};

function typhoonVerdictLabel(v: TyphoonVerdict, kind: '上班' | '上課'): string {
  switch (v.status) {
    case 'stopped': {
      const p = v.period === 'from' ? `${v.from} 起` : (v.period ? TYPHOON_PERIOD_LABEL[v.period] : '');
      return `停止${kind}${p ? `（${p}）` : ''}`;
    }
    case 'conditional':
      return `部分停止${kind}（依地區、學制或時段，須看 cities[].rows）`;
    case 'normal':
      return `照常${kind}`;
    default:
      return `${kind}狀況無法判斷（不可視為照常）`;
  }
}

function typhoonFinalityLabel(result: TyphoonQueryResult): string {
  if (result.reason === 'live') return '即時資料，當天仍可能更新';
  if (result.reason === 'pending') return '尚未定案，歸檔可能尚未收錄';
  if (result.reason === 'source_not_ready') return '資料源尚未就緒';
  if (result.basis === 'no_announcement') return '已定案：當日無停班停課公告';
  return result.basis === 'forecast' ? '依前一日預告' : '已定案';
}

/**
 * 一行結論，例如「2024-10-31 臺北市：停止上班（全天）、停止上課（全天）〔已定案〕」
 */
export function summarizeTyphoon(result: TyphoonQueryResult): string {
  const d = result.date;
  const date = /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
  const where = result.city ?? '全國';
  return `${date} ${where}：${typhoonVerdictLabel(result.work, '上班')}、${typhoonVerdictLabel(result.school, '上課')}〔${typhoonFinalityLabel(result)}〕`;
}
