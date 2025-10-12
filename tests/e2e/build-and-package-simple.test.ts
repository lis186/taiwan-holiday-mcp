import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('Task 5.2: 建置與打包完整測試', () => {
  const projectRoot = process.cwd();
  const distPath = join(projectRoot, 'dist');

  describe('T5.2.1: 建置腳本測試', () => {
    test('應該生成所有必要的檔案', async () => {
      const requiredFiles = [
        'index.js',
        'index.d.ts',
        'server.js',
        'server.d.ts',
        'holiday-service.js',
        'holiday-service.d.ts',
        'types.js',
        'types.d.ts',
        'utils/date-parser.js',
        'utils/date-parser.d.ts'
      ];

      for (const file of requiredFiles) {
        const filePath = join(distPath, file);
        await expect(fs.access(filePath)).resolves.toBeUndefined();
      }
    });

    test('應該設定正確的檔案權限', async () => {
      const indexPath = join(distPath, 'index.js');
      const stats = await fs.stat(indexPath);
      
      // 檢查檔案是否可執行
      const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
      expect(isExecutable).toBe(true);
    });

    test('應該生成有效的 Source Maps', async () => {
      const sourceMapPath = join(distPath, 'index.js.map');
      const sourceMapContent = await fs.readFile(sourceMapPath, 'utf-8');
      const sourceMap = JSON.parse(sourceMapContent);

      expect(sourceMap.version).toBe(3);
      expect(sourceMap.sources).toBeDefined();
      expect(sourceMap.mappings).toBeDefined();
    });
  });

  describe('T5.2.2: NPX 執行測試', () => {
    test('應該正確處理 --version 參數', async () => {
      const result = await runCommand('node', [join(distPath, 'index.js'), '--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Taiwan Holiday MCP Server v1.0.5');
      expect(result.stderr).toContain('Node.js');
      expect(result.stderr).toContain('Platform:');
    });

    test('應該正確處理 --help 參數', async () => {
      const result = await runCommand('node', [join(distPath, 'index.js'), '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Taiwan Holiday MCP Server');
      expect(result.stderr).toContain('用法:');
      expect(result.stderr).toContain('選項:');
    });

    test('效能測試：啟動時間應該合理', async () => {
      const startTime = Date.now();
      
      const result = await runCommand('node', [join(distPath, 'index.js'), '--version']);
      
      const endTime = Date.now();
      const startupTime = endTime - startTime;
      
      expect(result.exitCode).toBe(0);
      expect(startupTime).toBeLessThan(2000); // 啟動時間應該少於 2 秒
    });
  });

  describe('T5.2.3: 基本 MCP 功能測試', () => {
    test('應該能夠啟動 MCP 伺服器', async () => {
      const result = await runCommandWithTimeoutAndEnv('node', [join(distPath, 'index.js')], 1000, { DEBUG: 'true' });
      
      // MCP 伺服器的啟動訊息會輸出到 stderr，避免干擾 JSON-RPC 通訊
      expect(result.stderr).toContain('Taiwan Holiday MCP 伺服器已啟動');
    });
  });

  describe('套件打包測試', () => {
    test('應該能夠成功打包', async () => {
      const result = await runCommand('npm', ['run', 'package:test']);
      
      expect(result.exitCode).toBe(0);
      // npm pack 的輸出會包含套件檔名
      expect(result.stdout).toContain('taiwan-holiday-mcp-1.0.5.tgz');
      // 檢查建置過程是否成功
      expect(result.stdout).toContain('prepare');
      expect(result.stdout).toContain('build');
    }, 40000); // Jest 測試 timeout，npm pack + build 需要較長時間
  });
});

// 輔助函數
interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
  });
}

function runCommandWithTimeout(command: string, args: string[], timeout: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
  });
}

function runCommandWithTimeoutAndEnv(command: string, args: string[], timeout: number, env: Record<string, string>): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      cwd: process.cwd(),
      env: { ...process.env, ...env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
  });
} 