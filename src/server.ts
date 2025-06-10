#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Taiwan Holiday MCP Server
 * 
 * 提供台灣假期查詢功能的 MCP 伺服器
 * 目前階段：早期 Cursor 整合驗證點
 */
export class TaiwanHolidayMcpServer {
  private server: Server;

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
            name: 'ping',
            description: '測試 MCP 伺服器連接狀態',
            inputSchema: {
              type: 'object',
              properties: {},
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
          case 'ping':
            return await this.handlePing();

          default:
            throw new Error(`未知的工具: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        return {
          content: [
            {
              type: 'text',
              text: `錯誤: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * 處理 ping 工具
   */
  private async handlePing() {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: 'pong',
            timestamp: new Date().toISOString(),
            server: 'taiwan-holiday-mcp',
            version: '1.0.0',
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
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未處理的 Promise 拒絕:', reason);
      process.exit(1);
    });

    // 優雅關閉
    process.on('SIGINT', () => {
      console.log('\n正在關閉 Taiwan Holiday MCP 伺服器...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n正在關閉 Taiwan Holiday MCP 伺服器...');
      process.exit(0);
    });
  }

  /**
   * 啟動伺服器
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Taiwan Holiday MCP 伺服器已啟動'); // 使用 stderr 避免干擾 JSON-RPC
  }
}

// 注意：直接執行檢查移至 index.ts，避免測試環境問題 