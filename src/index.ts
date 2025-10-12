#!/usr/bin/env node

/**
 * Taiwan Holiday MCP Server
 * Entry point for the MCP server
 */

import { TaiwanHolidayMcpServer } from './server.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 取得 package.json 版本資訊
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');

/**
 * 顯示版本資訊
 */
function showVersion(): void {
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    console.error(`Taiwan Holiday MCP Server v${packageJson.version}`);
    console.error(`Node.js ${process.version}`);
    console.error(`Platform: ${process.platform} ${process.arch}`);
  } catch (error) {
    console.error('Taiwan Holiday MCP Server (版本資訊不可用)');
  }
  process.exit(0);
}

/**
 * 顯示幫助資訊
 */
function showHelp(): void {
  console.error(`
Taiwan Holiday MCP Server - 台灣假期 MCP 伺服器

用法:
  taiwan-holiday-mcp [選項]

選項:
  -v, --version     顯示版本資訊
  -h, --help        顯示此幫助資訊
  --debug           啟用除錯模式
  --port <port>     指定伺服器埠號 (預設: stdio)

環境變數:
  DEBUG             設定為 'true' 啟用除錯模式
  MCP_LOG_LEVEL     設定日誌等級 (error, warn, info, debug)
  NODE_ENV          設定執行環境 (development, production)

範例:
  taiwan-holiday-mcp
  taiwan-holiday-mcp --debug
  DEBUG=true taiwan-holiday-mcp
`);
  process.exit(0);
}

/**
 * 解析命令列參數
 */
function parseArgs(): { debug: boolean; showVersion: boolean; showHelp: boolean; port?: number } {
  const args = process.argv.slice(2);
  const result = {
    debug: false,
    showVersion: false,
    showHelp: false,
    port: undefined as number | undefined
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-v':
      case '--version':
        result.showVersion = true;
        break;
      case '-h':
      case '--help':
        result.showHelp = true;
        break;
      case '--debug':
        result.debug = true;
        break;
      case '--port':
        if (i + 1 < args.length) {
          result.port = parseInt(args[i + 1]);
          i++; // 跳過下一個參數
        }
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`未知選項: ${arg}`);
          console.error('使用 --help 查看可用選項');
          process.exit(1);
        }
    }
  }

  return result;
}

/**
 * 設定環境變數
 */
function setupEnvironment(debug: boolean): void {
  // 設定除錯模式
  if (debug || process.env.DEBUG === 'true') {
    process.env.DEBUG = 'true';
    process.env.MCP_LOG_LEVEL = process.env.MCP_LOG_LEVEL || 'debug';
  }

  // 設定預設日誌等級
  if (!process.env.MCP_LOG_LEVEL) {
    process.env.MCP_LOG_LEVEL = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  }

  // 設定預設環境
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }
}

/**
 * 主函數 - 啟動 Taiwan Holiday MCP 伺服器
 */
async function main(): Promise<void> {
  try {
    // 解析命令列參數
    const args = parseArgs();

    // 處理版本和幫助選項
    if (args.showVersion) {
      showVersion();
      return;
    }

    if (args.showHelp) {
      showHelp();
      return;
    }

    // 檢查 Node.js 版本
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      console.error(`錯誤: 需要 Node.js 18 或更高版本，當前版本: ${nodeVersion}`);
      process.exit(1);
    }

    // 設定環境
    setupEnvironment(args.debug);

    // 除錯資訊
    if (process.env.DEBUG === 'true') {
      console.error('Taiwan Holiday MCP 伺服器已啟動');
      console.error('除錯模式已啟用');
      console.error(`Node.js 版本: ${process.version}`);
      console.error(`平台: ${process.platform} ${process.arch}`);
      console.error(`工作目錄: ${process.cwd()}`);
      console.error(`環境變數: NODE_ENV=${process.env.NODE_ENV}, MCP_LOG_LEVEL=${process.env.MCP_LOG_LEVEL}`);
    }

    // 建立並啟動伺服器
    const server = new TaiwanHolidayMcpServer();
    await server.run();
    
  } catch (error) {
    console.error('Taiwan Holiday MCP 伺服器啟動失敗:', error);
    if (process.env.DEBUG === 'true') {
      console.error('錯誤堆疊:', error);
    }
    process.exit(1);
  }
}

/**
 * 處理未捕獲的錯誤
 */
process.on('uncaughtException', (error) => {
  console.error('未捕獲的例外:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

// 啟動應用程式
main(); 