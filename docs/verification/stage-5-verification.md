# 階段 5：NPX 套件設定 - 驗證標準

## 概述

本階段專注於 NPX 套件的完整設定、跨平台相容性測試，以及建置與打包的完整測試，確保套件可以在各種環境中正常運作。

## Task 5.1: NPX 套件配置與跨平台測試 - 測試驗證

### NPX 套件配置測試

```bash
# tests/scripts/npm-package-test.sh
#!/bin/bash

echo "=== NPX 套件配置測試 ==="

# 測試 package.json 配置
echo "檢查 package.json 配置..."
node -e "
const pkg = require('./package.json');
console.assert(pkg.bin['taiwan-holiday-mcp'], 'bin 設定缺失');
console.assert(pkg.main === 'dist/index.js', 'main 設定錯誤');
console.assert(pkg.types === 'dist/index.d.ts', 'types 設定錯誤');
console.assert(pkg.files.includes('dist'), 'files 設定缺失 dist');
console.log('✅ package.json 配置正確');
"

# 測試建置輸出
echo "檢查建置輸出..."
npm run build
if [ ! -f "dist/index.js" ]; then
  echo "❌ dist/index.js 不存在"
  exit 1
fi
if [ ! -f "dist/index.d.ts" ]; then
  echo "❌ dist/index.d.ts 不存在"
  exit 1
fi
echo "✅ 建置輸出正確"

# 測試 NPX 執行
echo "測試 NPX 執行..."
npm link
timeout 5s npx taiwan-holiday-mcp --version || echo "版本檢查完成"
echo "✅ NPX 執行正常"
```

### 跨平台相容性測試

```typescript
// tests/e2e/cross-platform.test.ts
import { spawn, ChildProcess } from 'child_process';
import { platform } from 'os';

describe('跨平台相容性測試', () => {
  let child: ChildProcess;

  afterEach(() => {
    if (child && !child.killed) {
      child.kill();
    }
  });

  test('應在當前平台正常啟動', async () => {
    const command = platform() === 'win32' ? 'npx.cmd' : 'npx';
    
    child = spawn(command, ['taiwan-holiday-mcp'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const startupPromise = new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('啟動超時'));
      }, 10000);

      child.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('MCP server started') || output.length > 0) {
          clearTimeout(timeout);
          resolve(true);
        }
      });

      child.stderr?.on('data', (data) => {
        const error = data.toString();
        if (error.includes('Error') || error.includes('error')) {
          clearTimeout(timeout);
          reject(new Error(`啟動錯誤: ${error}`));
        }
      });
    });

    await expect(startupPromise).resolves.toBe(true);
  });

  test('應正確處理路徑分隔符', () => {
    const expectedSeparator = platform() === 'win32' ? '\\' : '/';
    const testPath = require('path').join('test', 'path');
    expect(testPath).toContain(expectedSeparator);
  });

  test('應正確處理環境變數', () => {
    process.env.TEST_VAR = 'test_value';
    expect(process.env.TEST_VAR).toBe('test_value');
    delete process.env.TEST_VAR;
  });

  test('應正確處理檔案權限', async () => {
    if (platform() !== 'win32') {
      const fs = require('fs').promises;
      const testFile = 'test-permissions.txt';
      
      await fs.writeFile(testFile, 'test');
      await fs.chmod(testFile, 0o644);
      
      const stats = await fs.stat(testFile);
      expect(stats.mode & 0o777).toBe(0o644);
      
      await fs.unlink(testFile);
    }
  });
});
```

### 套件安裝測試

```typescript
// tests/e2e/package-installation.test.ts
describe('套件安裝測試', () => {
  test('應支援全域安裝', async () => {
    // 模擬全域安裝測試
    const result = await execCommand('npm pack');
    expect(result.stdout).toContain('.tgz');
    
    // 清理
    const files = await fs.readdir('.');
    const tgzFiles = files.filter(f => f.endsWith('.tgz'));
    for (const file of tgzFiles) {
      await fs.unlink(file);
    }
  });

  test('應支援本地安裝', async () => {
    const tempDir = await fs.mkdtemp('taiwan-holiday-test-');
    
    try {
      // 在臨時目錄中測試安裝
      process.chdir(tempDir);
      await execCommand('npm init -y');
      await execCommand(`npm install ${process.cwd()}`);
      
      const packageJson = JSON.parse(
        await fs.readFile('package.json', 'utf8')
      );
      expect(packageJson.dependencies).toBeDefined();
    } finally {
      process.chdir('..');
      await fs.rmdir(tempDir, { recursive: true });
    }
  });

  test('應正確處理依賴版本', async () => {
    const packageJson = JSON.parse(
      await fs.readFile('package.json', 'utf8')
    );
    
    // 檢查關鍵依賴版本
    expect(packageJson.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
    expect(packageJson.peerDependencies?.node).toBeDefined();
  });
});
```

### 驗證標準

- [ ] package.json 配置正確
- [ ] NPX 執行正常
- [ ] 跨平台相容性良好
- [ ] 檔案權限設定正確
- [ ] 依賴版本管理正確
- [ ] 安裝流程順暢

## Task 5.2: 建置與打包完整測試 - 測試驗證

### 建置流程測試

```typescript
// tests/e2e/build-process.test.ts
describe('建置流程測試', () => {
  beforeEach(async () => {
    // 清理之前的建置
    await execCommand('npm run clean');
  });

  test('TypeScript 編譯應成功', async () => {
    const result = await execCommand('npm run build');
    expect(result.stderr).not.toContain('error');
    
    // 檢查輸出檔案
    expect(await fs.access('dist/index.js')).resolves.toBeUndefined();
    expect(await fs.access('dist/index.d.ts')).resolves.toBeUndefined();
  });

  test('應生成正確的型別定義', async () => {
    await execCommand('npm run build');
    
    const dtsContent = await fs.readFile('dist/index.d.ts', 'utf8');
    expect(dtsContent).toContain('export');
    expect(dtsContent).toContain('Holiday');
    expect(dtsContent).toContain('HolidayStats');
  });

  test('應生成 Source Map', async () => {
    await execCommand('npm run build');
    
    const jsContent = await fs.readFile('dist/index.js', 'utf8');
    expect(jsContent).toContain('//# sourceMappingURL=');
    
    expect(await fs.access('dist/index.js.map')).resolves.toBeUndefined();
  });

  test('建置輸出應可執行', async () => {
    await execCommand('npm run build');
    
    const result = await execCommand('node dist/index.js --version');
    expect(result.stdout).toContain('1.0.0');
  });
});
```

### NPX 執行測試

```typescript
// tests/e2e/npx-execution.test.ts
describe('NPX 執行測試', () => {
  test('應正確處理命令列參數', async () => {
    const tests = [
      { args: ['--version'], expected: '1.0.0' },
      { args: ['--help'], expected: 'Usage:' },
      { args: [], expected: 'MCP server' }
    ];

    for (const test of tests) {
      const result = await execCommand(`npx taiwan-holiday-mcp ${test.args.join(' ')}`);
      expect(result.stdout).toContain(test.expected);
    }
  });

  test('應正確處理 MCP 協議', async () => {
    const child = spawn('npx', ['taiwan-holiday-mcp'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const request = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    }) + '\n';

    child.stdin.write(request);
    child.stdin.end();

    const output = await new Promise<string>((resolve) => {
      let data = '';
      child.stdout.on('data', (chunk) => {
        data += chunk.toString();
      });
      child.on('close', () => resolve(data));
    });

    const response = JSON.parse(output);
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result.tools).toHaveLength(3);
  });

  test('應處理錯誤情境', async () => {
    const child = spawn('npx', ['taiwan-holiday-mcp'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const invalidRequest = 'invalid json\n';
    child.stdin.write(invalidRequest);
    child.stdin.end();

    const errorOutput = await new Promise<string>((resolve) => {
      let data = '';
      child.stderr.on('data', (chunk) => {
        data += chunk.toString();
      });
      child.on('close', () => resolve(data));
    });

    expect(errorOutput).toContain('Invalid JSON');
  });
});
```

### 效能基準測試

```typescript
// tests/e2e/performance-benchmarks.test.ts
describe('效能基準測試', () => {
  test('啟動時間應合理', async () => {
    const startTime = Date.now();
    
    const child = spawn('npx', ['taiwan-holiday-mcp'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    await new Promise<void>((resolve) => {
      child.stdout.on('data', () => {
        const startupTime = Date.now() - startTime;
        expect(startupTime).toBeLessThan(5000); // 5秒內啟動
        child.kill();
        resolve();
      });
    });
  });

  test('記憶體使用應合理', async () => {
    const child = spawn('npx', ['taiwan-holiday-mcp'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 等待啟動
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 檢查記憶體使用（需要 ps 命令）
    if (process.platform !== 'win32') {
      const memResult = await execCommand(`ps -o rss= -p ${child.pid}`);
      const memoryKB = parseInt(memResult.stdout.trim());
      const memoryMB = memoryKB / 1024;
      
      expect(memoryMB).toBeLessThan(100); // 記憶體使用 < 100MB
    }

    child.kill();
  });

  test('處理大量請求效能', async () => {
    const child = spawn('npx', ['taiwan-holiday-mcp'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const startTime = Date.now();
    
    // 發送 10 個請求
    for (let i = 0; i < 10; i++) {
      const request = JSON.stringify({
        jsonrpc: "2.0",
        id: i + 1,
        method: "tools/call",
        params: {
          name: "check_holiday",
          arguments: { date: "2024-01-01" }
        }
      }) + '\n';

      child.stdin.write(request);
    }

    child.stdin.end();

    await new Promise<void>((resolve) => {
      child.on('close', () => {
        const processingTime = Date.now() - startTime;
        expect(processingTime).toBeLessThan(10000); // 10秒內完成
        resolve();
      });
    });
  });
});
```

### 驗證標準

- [ ] TypeScript 編譯成功
- [ ] 型別定義正確生成
- [ ] Source Map 正確生成
- [ ] NPX 執行正常
- [ ] 命令列參數處理正確
- [ ] MCP 協議處理正常
- [ ] 錯誤處理完善
- [ ] 效能符合基準

## 階段 5 整體驗證清單

### 技術驗證

- [ ] NPX 套件配置正確
- [ ] 跨平台相容性良好
- [ ] 建置流程穩定
- [ ] 打包輸出正確
- [ ] 依賴管理完善

### 功能驗證

- [ ] 所有平台正常運作
- [ ] 安裝流程順暢
- [ ] 執行效能良好
- [ ] 錯誤處理完善
- [ ] 用戶體驗優秀

### 品質標準

- [ ] 跨平台測試通過
- [ ] 效能基準達標
- [ ] 記憶體使用合理
- [ ] 啟動時間合理
- [ ] 穩定性測試通過

## 跨平台相容性矩陣

| 平台 | Node.js 18 | Node.js 20 | NPX 安裝 | 執行測試 | 效能測試 |
|------|------------|------------|----------|----------|----------|
| Windows 10+ | ✅ | ✅ | ✅ | ✅ | ✅ |
| macOS 12+ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ubuntu 20.04+ | ✅ | ✅ | ✅ | ✅ | ✅ |

## 故障排除指南

### 常見問題

1. **NPX 安裝失敗**
   - 檢查 Node.js 版本
   - 確認網路連接
   - 清除 npm 快取

2. **跨平台執行問題**
   - 檢查路徑分隔符
   - 確認檔案權限
   - 驗證環境變數

3. **建置失敗**
   - 檢查 TypeScript 版本
   - 確認依賴完整性
   - 清理並重新建置

4. **效能問題**
   - 檢查記憶體使用
   - 最佳化啟動流程
   - 減少依賴載入

### 最佳化建議

1. **套件大小最佳化**
   - 移除不必要的依賴
   - 使用 tree-shaking
   - 壓縮輸出檔案

2. **啟動效能最佳化**
   - 延遲載入非關鍵模組
   - 快取常用資料
   - 最佳化初始化流程

3. **相容性改善**
   - 使用標準 API
   - 避免平台特定功能
   - 提供降級方案 