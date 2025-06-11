/**
 * 套件安裝測試
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';

/**
 * 輔助函數：執行命令並回傳結果
 */
async function execCommand(command: string, args: string[] = [], cwd?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: cwd || process.cwd()
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
      resolve({ stdout, stderr, code: code || 0 });
    });

    child.on('error', (error) => {
      reject(error);
    });

    setTimeout(() => {
      child.kill();
      reject(new Error('命令執行超時'));
    }, 30000);
  });
}

describe('套件安裝測試', () => {
  test('應支援 npm pack 打包', async () => {
    // 執行 npm pack
    const result = await execCommand('npm', ['pack']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('.tgz');
    
    // 清理打包檔案
    const files = await fs.readdir('.');
    const tgzFiles = files.filter(f => f.endsWith('.tgz'));
    for (const file of tgzFiles) {
      await fs.unlink(file);
    }
  }, 30000);

  test('應支援本地安裝測試', async () => {
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'taiwan-holiday-test-'));
    
    try {
      // 在臨時目錄中建立測試專案
      await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        private: true
      }, null, 2));

      // 建立 npm pack
      const packResult = await execCommand('npm', ['pack']);
      expect(packResult.code).toBe(0);
      
      const files = await fs.readdir('.');
      const tgzFile = files.find(f => f.endsWith('.tgz'));
      expect(tgzFile).toBeDefined();

      if (tgzFile) {
        // 複製打包檔案到臨時目錄
        const tgzPath = join(process.cwd(), tgzFile);
        const tempTgzPath = join(tempDir, tgzFile);
        await fs.copyFile(tgzPath, tempTgzPath);

        // 在臨時目錄中安裝
        const installResult = await execCommand('npm', ['install', tgzFile], tempDir);
        expect(installResult.code).toBe(0);

        // 檢查是否正確安裝
        const nodeModulesPath = join(tempDir, 'node_modules', 'taiwan-holiday-mcp');
        const stats = await fs.stat(nodeModulesPath);
        expect(stats.isDirectory()).toBe(true);

        // 清理打包檔案
        await fs.unlink(tgzPath);
      }
    } finally {
      // 清理臨時目錄
      await fs.rmdir(tempDir, { recursive: true });
    }
  }, 60000);

  test('應正確處理依賴版本', async () => {
    const packageJson = JSON.parse(
      await fs.readFile('package.json', 'utf8')
    );
    
    // 檢查關鍵依賴版本
    expect(packageJson.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
    expect(packageJson.engines?.node).toBeDefined();
    expect(packageJson.engines.node).toMatch(/>=18/);
    
    // 檢查 bin 設定
    expect(packageJson.bin['taiwan-holiday-mcp']).toBe('dist/index.js');
    
    // 檢查 files 設定
    expect(packageJson.files).toContain('dist');
    expect(packageJson.files).toContain('README.md');
    
    // 檢查 main 和 types 設定
    expect(packageJson.main).toBe('dist/index.js');
    expect(packageJson.types).toBe('dist/index.d.ts');
  });

  test('應包含必要的建置檔案', async () => {
    // 確保建置已完成
    const buildResult = await execCommand('npm', ['run', 'build']);
    expect(buildResult.code).toBe(0);

    // 檢查必要檔案是否存在
    const requiredFiles = [
      'dist/index.js',
      'dist/index.d.ts',
      'dist/server.js',
      'dist/server.d.ts',
      'dist/holiday-service.js',
      'dist/holiday-service.d.ts',
      'dist/types.js',
      'dist/types.d.ts'
    ];

    for (const file of requiredFiles) {
      const stats = await fs.stat(file);
      expect(stats.isFile()).toBe(true);
    }

    // 檢查入口點檔案是否可執行
    const indexStats = await fs.stat('dist/index.js');
    if (process.platform !== 'win32') {
      // Unix 系統檢查執行權限
      expect(indexStats.mode & 0o111).toBeGreaterThan(0);
    }
  });

  test('應正確設定 package.json 欄位', async () => {
    const packageJson = JSON.parse(
      await fs.readFile('package.json', 'utf8')
    );

    // 基本資訊
    expect(packageJson.name).toBe('taiwan-holiday-mcp');
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(packageJson.description).toBeTruthy();
    expect(packageJson.license).toBe('MIT');
    expect(packageJson.author).toBeTruthy();

    // 模組設定
    expect(packageJson.type).toBe('module');
    expect(packageJson.main).toBe('dist/index.js');
    expect(packageJson.types).toBe('dist/index.d.ts');

    // 執行檔設定
    expect(packageJson.bin).toBeDefined();
    expect(packageJson.bin['taiwan-holiday-mcp']).toBe('dist/index.js');

    // 發布檔案設定
    expect(packageJson.files).toContain('dist');
    expect(packageJson.files).toContain('README.md');

    // 腳本設定
    expect(packageJson.scripts.build).toBeTruthy();
    expect(packageJson.scripts.test).toBeTruthy();
    expect(packageJson.scripts.prepare).toBeTruthy();

    // 引擎要求
    expect(packageJson.engines.node).toMatch(/>=18/);

    // 關鍵字
    expect(packageJson.keywords).toContain('mcp');
    expect(packageJson.keywords).toContain('taiwan');
    expect(packageJson.keywords).toContain('holiday');

    // 儲存庫資訊
    expect(packageJson.repository).toBeDefined();
    expect(packageJson.repository.type).toBe('git');
    expect(packageJson.repository.url).toBeTruthy();
  });

  test('應正確處理 npm scripts', async () => {
    // 測試建置腳本
    const buildResult = await execCommand('npm', ['run', 'build']);
    expect(buildResult.code).toBe(0);

    // 測試 lint 腳本
    const lintResult = await execCommand('npm', ['run', 'lint']);
    expect(lintResult.code).toBe(0);

    // 測試 prepare 腳本（模擬 npm install 時的行為）
    const prepareResult = await execCommand('npm', ['run', 'prepare']);
    expect(prepareResult.code).toBe(0);
  }, 30000);
}); 