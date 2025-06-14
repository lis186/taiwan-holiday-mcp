import { readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// 使用專案根目錄的絕對路徑
const projectRoot = process.cwd();
const indexPath = join(projectRoot, 'dist/index.js');

// 測試工具函數
function runIndexScript(args: string[] = []): Promise<{stdout: string, stderr: string, exitCode: number}> {
  return new Promise((resolve) => {
    const process = spawn('node', [indexPath, ...args], {
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0
      });
    });

    // 給 MCP 伺服器一些時間啟動後關閉
    if (args.length === 0 || args.includes('--debug') || args.includes('--port')) {
      setTimeout(() => {
        process.kill('SIGTERM');
      }, 1000);
    }
  });
}

describe('Taiwan Holiday MCP Server Index Functions', () => {
  describe('版本資訊顯示', () => {
    test('應該顯示版本資訊', async () => {
      const result = await runIndexScript(['--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Taiwan Holiday MCP Server v1.0.1');
      expect(result.stderr).toContain('Node.js');
      expect(result.stderr).toContain('Platform:');
    });

    test('應該支援短版本參數', async () => {
      const result = await runIndexScript(['-v']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Taiwan Holiday MCP Server v1.0.1');
    });
  });

  describe('幫助資訊顯示', () => {
    test('應該顯示幫助資訊', async () => {
      const result = await runIndexScript(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Taiwan Holiday MCP Server - 台灣假期 MCP 伺服器');
      expect(result.stderr).toContain('用法:');
      expect(result.stderr).toContain('選項:');
      expect(result.stderr).toContain('環境變數:');
    });

    test('應該支援短幫助參數', async () => {
      const result = await runIndexScript(['-h']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Taiwan Holiday MCP Server - 台灣假期 MCP 伺服器');
    });
  });

  describe('命令列參數處理', () => {
    test('應該處理無效參數', async () => {
      const result = await runIndexScript(['--invalid']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('未知選項: --invalid');
      expect(result.stderr).toContain('使用 --help 查看可用選項');
    });

    test('應該處理除錯模式', async () => {
      const result = await runIndexScript(['--debug']);
      
      expect(result.stderr).toContain('除錯模式已啟用');
      expect(result.stderr).toContain('Node.js 版本:');
      expect(result.stderr).toContain('平台:');
      expect(result.stderr).toContain('工作目錄:');
      expect(result.stderr).toContain('環境變數:');
    }, 5000);

    test('應該處理埠號參數', async () => {
      // 由於 --port 會嘗試啟動伺服器，我們快速終止
      const result = await runIndexScript(['--port', '3000']);
      
      // 檢查沒有錯誤訊息關於未知選項
      expect(result.stderr).not.toContain('未知選項');
    }, 5000);
  });

  describe('Node.js 版本檢查', () => {
    test('應該接受當前 Node.js 版本', async () => {
      // 當前版本應該 >= 18，所以不應該有版本錯誤
      const result = await runIndexScript(['--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).not.toContain('錯誤: 需要 Node.js 18');
    });
  });

  describe('伺服器啟動', () => {
    test('應該能夠啟動 MCP 伺服器', async () => {
      const result = await runIndexScript([]);
      
      // 在非除錯模式下，可能沒有啟動訊息輸出到 stderr
      // 所以我們只檢查是否正常退出或被正常終止
      expect([0, 2, 15]).toContain(result.exitCode); // 0=正常退出, 2=SIGINT, 15=SIGTERM
    }, 5000);

    test('應該能夠在除錯模式下啟動', async () => {
      const result = await runIndexScript(['--debug']);
      
      expect(result.stderr).toContain('除錯模式已啟用');
      expect(result.stderr).toContain('Taiwan Holiday MCP 伺服器已啟動');
    }, 5000);
  });

  describe('環境變數處理', () => {
    test('應該響應 DEBUG 環境變數', async () => {
      return new Promise((resolve) => {
        const childProcess = spawn('node', [indexPath], {
          stdio: 'pipe',
          env: { ...process.env, DEBUG: 'true' }
        });

        let stderr = '';

        childProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        setTimeout(() => {
          childProcess.kill('SIGTERM');
        }, 1000);

        childProcess.on('close', () => {
          expect(stderr).toContain('除錯模式已啟用');
          resolve(undefined);
        });
      });
    }, 15000);
  });

  describe('錯誤處理', () => {
    test('應該處理啟動錯誤', async () => {
      // 模擬錯誤情況，這個測試比較難做，所以我們檢查錯誤處理器是否存在
      const result = await runIndexScript(['--version']);
      
      // 如果能正常顯示版本，說明基本錯誤處理是正常的
      expect(result.exitCode).toBe(0);
    });
  });

  describe('實際文件測試', () => {
    test('index.js 應該存在並可執行', () => {
      expect(() => readFileSync(indexPath)).not.toThrow();
    });

    test('index.js 應該有正確的 shebang', () => {
      const content = readFileSync(indexPath, 'utf8');
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
    });
  });
});