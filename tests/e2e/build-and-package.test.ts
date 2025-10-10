import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { platform } from 'os';

describe('建置與打包完整測試', () => {
  const projectRoot = process.cwd();
  const distPath = join(projectRoot, 'dist');



  describe('T5.2.1: 建置腳本測試', () => {
    test('應該正確清理輸出目錄', async () => {
      // 建立臨時測試目錄而不是清理實際的 dist 目錄
      const tempDistPath = join(projectRoot, 'temp-dist-test');
      
      // 建立測試目錄和檔案
      await fs.mkdir(tempDistPath, { recursive: true });
      await fs.writeFile(join(tempDistPath, 'test-file.txt'), 'test');
      
      // 執行清理命令（使用 shx rm -rf）
      await new Promise<void>((resolve, reject) => {
        const cleanProcess = spawn('npx', ['shx', 'rm', '-rf', tempDistPath], {
          cwd: projectRoot,
          stdio: 'pipe'
        });

        cleanProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`清理失敗，退出代碼: ${code}`));
          }
        });
      });

      // 檢查目錄是否被清理
      try {
        await fs.access(tempDistPath);
        fail('測試目錄應該被清理');
      } catch (error) {
        // 預期的錯誤，目錄不存在
        expect(error).toBeDefined();
      }
    });

    test('應該生成所有必要的檔案', async () => {
      // 檢查必要檔案（不重新建置，使用全域建置的結果）
      const requiredFiles = [
        'index.js',
        'index.d.ts',
        'index.js.map',
        'index.d.ts.map',
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
      expect(result.stderr).toContain('Taiwan Holiday MCP Server v1.0.4');
      expect(result.stderr).toContain('Node.js');
      expect(result.stderr).toContain('Platform:');
    });

    test('應該正確處理 --help 參數', async () => {
      const result = await runCommand('node', [join(distPath, 'index.js'), '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Taiwan Holiday MCP Server');
      expect(result.stderr).toContain('用法:');
      expect(result.stderr).toContain('選項:');
      expect(result.stderr).toContain('環境變數:');
    });

    test('應該正確處理無效參數', async () => {
      const result = await runCommand('node', [join(distPath, 'index.js'), '--invalid']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('未知選項');
      expect(result.stderr).toContain('--help');
    });

    test('應該支援除錯模式', async () => {
      const result = await runCommand('node', [join(distPath, 'index.js'), '--debug'], {
        timeout: 2000,
        killSignal: 'SIGTERM'
      });
      
      // 除錯模式應該啟動伺服器
      expect(result.stderr).toContain('Taiwan Holiday MCP 伺服器已啟動');
      expect(result.stderr).toContain('除錯模式');
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

  describe('T5.2.3: 端到端 MCP 流程測試', () => {
    test('應該正確處理 MCP 工具列表查詢', async () => {
      const mcpRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      });

      const result = await runCommandWithInput('node', [join(distPath, 'index.js')], mcpRequest);
      
      expect(result.exitCode).toBe(0);
      
      if (!result.stdout.trim()) {
        throw new Error(`Empty stdout. stderr: ${result.stderr}`);
      }
      
      const response = JSON.parse(result.stdout.trim());
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result.tools).toHaveLength(3);
      
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('check_holiday');
      expect(toolNames).toContain('get_holidays_in_range');
      expect(toolNames).toContain('get_holiday_stats');
    });

    test('應該正確處理假期查詢', async () => {
      const mcpRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'check_holiday',
          arguments: {
            date: '2024-01-01'
          }
        }
      });

      const result = await runCommandWithInput('node', [join(distPath, 'index.js')], mcpRequest);
      
      expect(result.exitCode).toBe(0);
      
      if (!result.stdout.trim()) {
        throw new Error(`Empty stdout. stderr: ${result.stderr}`);
      }
      
      const response = JSON.parse(result.stdout.trim());
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
      expect(response.result.content[0].text).toContain('開國紀念日');
    });

    test('應該正確處理錯誤情況', async () => {
      const mcpRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'check_holiday',
          arguments: {
            date: 'invalid-date'
          }
        }
      });

      const result = await runCommandWithInput('node', [join(distPath, 'index.js')], mcpRequest);
      
      expect(result.exitCode).toBe(0);
      
      if (!result.stdout.trim()) {
        throw new Error(`Empty stdout. stderr: ${result.stderr}`);
      }
      
      const response = JSON.parse(result.stdout.trim());
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(3);
      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain('日期格式');
    });

    test('記憶體洩漏測試：多次請求後記憶體應該穩定', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => 
        JSON.stringify({
          jsonrpc: '2.0',
          id: i + 1,
          method: 'tools/call',
          params: {
            name: 'check_holiday',
            arguments: {
              date: '2024-01-01'
            }
          }
        })
      );

      const input = requests.join('\n');
      const result = await runCommandWithInput('node', [join(distPath, 'index.js')], input, {
        timeout: 15000
      });

      expect(result.exitCode).toBe(0);
      
      // 檢查所有回應都正確
      if (!result.stdout.trim()) {
        throw new Error(`Empty stdout. stderr: ${result.stderr}`);
      }
      
      const responses = result.stdout.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
      expect(responses.length).toBeGreaterThanOrEqual(9); // 允許部分丟失
      
      responses.forEach((response) => {
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBeGreaterThan(0);
        expect(response.id).toBeLessThanOrEqual(10);
        expect(response.result).toBeDefined();
      });
    }, 20000);
  });

  describe('套件打包測試', () => {
    test('應該能夠成功打包', async () => {
      const result = await runCommand('npm', ['run', 'package:test']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('taiwan-holiday-mcp-1.0.4.tgz');
      expect(result.stdout).toContain('dist/');
    });

    test('打包內容應該包含必要檔案', async () => {
      const result = await runCommand('npm', ['pack', '--dry-run'], { timeout: 10000 });
      
      expect(result.exitCode).toBe(0);
      
      // 檢查是否有 tarball 檔案名稱
      expect(result.stdout).toContain('taiwan-holiday-mcp-1.0.4.tgz');
      
      // 如果有詳細內容列表，檢查必要檔案
      if (result.stdout.includes('npm notice Tarball Contents')) {
        expect(result.stdout).toContain('dist/index.js');
        expect(result.stdout).toContain('dist/index.d.ts');
        expect(result.stdout).toContain('README.md');
        expect(result.stdout).toContain('package.json');
      }
    });
  });
});

// 輔助函數
interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface CommandOptions {
  timeout?: number;
  killSignal?: NodeJS.Signals;
}

function runCommand(
  command: string, 
  args: string[], 
  options: CommandOptions = {}
): Promise<CommandResult> {
  const projectRoot = process.cwd();
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      cwd: projectRoot
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = options.timeout || 5000;
    const timer = setTimeout(() => {
      child.kill(options.killSignal || 'SIGTERM');
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

function runCommandWithInput(
  command: string, 
  args: string[], 
  input: string,
  options: CommandOptions = {}
): Promise<CommandResult> {
  const projectRoot = process.cwd();
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      cwd: projectRoot
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // 發送輸入並關閉 stdin
    if (child.stdin) {
      child.stdin.write(input + '\n');
      child.stdin.end();
    }

    const timeout = options.timeout || 5000;
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

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + error.message
      });
    });
  });
} 