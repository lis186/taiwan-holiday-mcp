#!/usr/bin/env node

/**
 * Taiwan Holiday MCP Server
 * Entry point for the MCP server
 */

import { TaiwanHolidayMcpServer } from './server.js';

/**
 * 主函數 - 啟動 Taiwan Holiday MCP 伺服器
 */
async function main(): Promise<void> {
  try {
    // 檢查 Node.js 版本
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      console.error(`錯誤: 需要 Node.js 18 或更高版本，當前版本: ${nodeVersion}`);
      process.exit(1);
    }

    // 建立並啟動伺服器
    const server = new TaiwanHolidayMcpServer();
    await server.run();
    
  } catch (error) {
    console.error('Taiwan Holiday MCP 伺服器啟動失敗:', error);
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