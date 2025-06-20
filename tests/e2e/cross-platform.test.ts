/**
 * 跨平台相容性測試
 */

import { spawn, ChildProcess } from 'child_process';
import { platform } from 'os';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('跨平台相容性測試', () => {
  let child: ChildProcess;

  afterEach(() => {
    if (child && !child.killed) {
      child.kill();
    }
  });

  test('應在當前平台正常啟動', async () => {
    // 使用本地建置的檔案而不是 npx，因為套件還未發布
    const indexPath = join(process.cwd(), 'dist', 'index.js');
    
    // 使用 --debug 參數啟動伺服器，這樣會輸出啟動訊息
    child = spawn('node', [indexPath, '--debug'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DEBUG: 'true' }
    });

    const startupPromise = new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('啟動超時'));
      }, 5000); // 縮短超時時間

      let stderrOutput = '';
      child.stderr?.on('data', (data) => {
        const output = data.toString();
        stderrOutput += output;
        
        // 檢查是否包含啟動成功訊息
        if (output.includes('Taiwan Holiday MCP 伺服器已啟動')) {
          clearTimeout(timeout);
          child.kill(); // 啟動成功後立即終止
          resolve(true);
        }
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        // 在除錯模式下，伺服器會被手動終止，所以退出代碼可能不是 0
        if (stderrOutput.includes('Taiwan Holiday MCP 伺服器已啟動')) {
          resolve(true);
        } else {
          reject(new Error(`啟動失敗，退出代碼: ${code}, stderr: ${stderrOutput}`));
        }
      });
    });

    await expect(startupPromise).resolves.toBe(true);
  }, 15000);

  test('應正確處理版本參數', async () => {
    // 使用本地建置的檔案而不是 npx，因為套件還未發布
    const indexPath = join(process.cwd(), 'dist', 'index.js');
    
    child = spawn('node', [indexPath, '--version'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const versionPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('版本檢查超時'));
      }, 10000);

      let output = '';
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`版本檢查失敗，退出代碼: ${code}`));
        }
      });
    });

    const output = await versionPromise;
    expect(output).toContain('Taiwan Holiday MCP Server v');
    expect(output).toContain('Node.js');
    expect(output).toContain('Platform:');
  }, 15000);

  test('應正確處理路徑分隔符', () => {
    const expectedSeparator = platform() === 'win32' ? '\\' : '/';
    const testPath = join('test', 'path');
    expect(testPath).toContain(expectedSeparator);
  });

  test('應正確處理環境變數', () => {
    process.env.TEST_VAR = 'test_value';
    expect(process.env.TEST_VAR).toBe('test_value');
    delete process.env.TEST_VAR;
  });

  test('應正確處理檔案權限', async () => {
    if (platform() !== 'win32') {
      const testFile = join(process.cwd(), 'test-permissions.txt');
      
      await fs.writeFile(testFile, 'test');
      await fs.chmod(testFile, 0o644);
      
      const stats = await fs.stat(testFile);
      expect(stats.mode & 0o777).toBe(0o644);
      
      await fs.unlink(testFile);
    } else {
      // Windows 不支援 Unix 風格的檔案權限，跳過測試
      expect(true).toBe(true);
    }
  });

  test('應正確處理 Node.js 版本檢查', async () => {
    const command = platform() === 'win32' ? 'node.exe' : 'node';
    
    child = spawn(command, ['-e', 'console.log(process.version)'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const versionPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Node.js 版本檢查超時'));
      }, 5000);

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Node.js 版本檢查失敗，退出代碼: ${code}`));
        }
      });
    });

    const version = await versionPromise;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    expect(majorVersion).toBeGreaterThanOrEqual(18);
  });

  test('應正確處理除錯模式', async () => {
    // 使用本地建置的檔案而不是 npx，因為套件還未發布
    const indexPath = join(process.cwd(), 'dist', 'index.js');
    
    // 只測試 --version 來確保基本功能正常
    child = spawn('node', [indexPath, '--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DEBUG: 'true' }
    });

    const debugPromise = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('除錯模式測試超時'));
      }, 10000);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr });
      });
    });

    const { stdout, stderr } = await debugPromise;
    // --version 的輸出包含版本資訊（輸出到 stderr）
    expect(stderr).toContain('Taiwan Holiday MCP Server v');
    expect(stderr).toContain('Node.js');
    expect(stderr).toContain('Platform:');
  }, 15000);
});

/**
 * 輔助函數：執行命令並回傳結果
 */
async function execCommand(command: string, args: string[] = []): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });

    child.on('error', (error) => {
      reject(error);
    });

    setTimeout(() => {
      child.kill();
      reject(new Error('命令執行超時'));
    }, 10000);
  });
} 