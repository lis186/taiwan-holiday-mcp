#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { HolidayService, HolidayServiceError } from './holiday-service.js';
import { ErrorType } from './types.js';

/**
 * Taiwan Holiday MCP Server
 * 
 * 提供台灣假期查詢功能的 MCP 伺服器
 * 階段：完整功能 Cursor 驗證點
 */
export class TaiwanHolidayMcpServer {
  private server: Server;
  private holidayService: HolidayService;

  constructor() {
    this.server = new Server(
      {
        name: 'taiwan-holiday-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 初始化假期服務
    this.holidayService = new HolidayService();

    this.setupToolHandlers();
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
        console.error(`工具執行錯誤 [${name}]:`, error);
        
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
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
   * 設定錯誤處理
   */
  private setupErrorHandling(): void {
    // 處理未捕獲的錯誤
    process.on('uncaughtException', (error) => {
      console.error('未捕獲的例外:', error);
      // 清理資源
      this.holidayService.clearCache();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未處理的 Promise 拒絕:', reason);
      // 清理資源
      this.holidayService.clearCache();
      process.exit(1);
    });

    // 優雅關閉
    process.on('SIGINT', () => {
      console.log('\n正在關閉 Taiwan Holiday MCP 伺服器...');
      this.holidayService.clearCache();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n正在關閉 Taiwan Holiday MCP 伺服器...');
      this.holidayService.clearCache();
      process.exit(0);
    });
  }

  /**
   * 啟動伺服器
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Taiwan Holiday MCP 伺服器已啟動 - 完整功能版本'); // 使用 stderr 避免干擾 JSON-RPC
  }
}

// 注意：直接執行檢查移至 index.ts，避免測試環境問題 