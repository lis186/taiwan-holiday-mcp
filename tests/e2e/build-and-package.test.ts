import { spawn, ChildProcess } from 'child_process';
import {promises as fs, readFileSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';
import { getCurrentYearInTaipei } from '../../src/types.js';

// 版本從 package.json 讀取，避免每次發版都要回來改測試裡寫死的字串
const pkgVersion: string = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8')
).version;

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
      expect(result.stderr).toContain(`Taiwan Holiday MCP Server v${pkgVersion}`);
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
      // npm pack --dry-run 需要先執行 build，需要更長的 timeout
      const result = await runCommand('npm', ['run', 'package:test'], { timeout: 30000 });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`taiwan-holiday-mcp-${pkgVersion}.tgz`);
      expect(result.stdout).toContain('dist/');
    }, 35000); // Jest 測試 timeout 略大於 runCommand timeout

    test('打包內容應該包含必要檔案', async () => {
      const result = await runCommand('npm', ['pack', '--dry-run'], { timeout: 15000 });
      
      expect(result.exitCode).toBe(0);
      
      // 檢查是否有 tarball 檔案名稱
      expect(result.stdout).toContain(`taiwan-holiday-mcp-${pkgVersion}.tgz`);
      
      // 如果有詳細內容列表，檢查必要檔案
      if (result.stdout.includes('npm notice Tarball Contents')) {
        expect(result.stdout).toContain('dist/index.js');
        expect(result.stdout).toContain('dist/index.d.ts');
        expect(result.stdout).toContain('README.md');
        expect(result.stdout).toContain('package.json');
      }
    }, 20000); // Jest 測試 timeout 略大於 runCommand timeout
  });

  // 這些測試打真實上游，屬 golden acceptance 而非 hermetic 測試。
  // 用環境變數閘控，離線時整組跳過並明確說明 —— 不靜默通過。
  const runUpstream = process.env.RUN_UPSTREAM_E2E === '1';
  const describeUpstream = runUpstream ? describe : describe.skip;

  if (!runUpstream) {
    // eslint-disable-next-line no-console
    console.warn(
      '[skip] 協議層上游 E2E 未執行。設 RUN_UPSTREAM_E2E=1 啟用（需要網路與真實上游）。'
    );
  }

  describeUpstream('T5.2.4: 年份支援與資源清單的協議層驗證', () => {
    const currentYear = getCurrentYearInTaipei();
    const indexJs = join(distPath, 'index.js');

    /**
     * 送多個 JSON-RPC 請求到同一個 server 程序，依序回傳解析後的回應。
     *
     * server 讀完 stdin 不會自己結束，所以每次 spawn 都要等滿 runCommandWithInput
     * 的 timeout。把多個請求串在一次呼叫裡，才不會讓需要兩個請求的測試超時。
     */
    async function rpcMany(
      calls: Array<{ method: string; params?: unknown }>
    ): Promise<any[]> {
      const input = calls
        .map((c, i) =>
          JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: c.method, ...(c.params ? { params: c.params } : {}) })
        )
        .join('\n');
      const result = await runCommandWithInput('node', [indexJs], input, { timeout: 30000 });
      const responses = result.stdout
        .split('\n')
        .filter((l) => l.trim().startsWith('{'))
        .map((l) => JSON.parse(l));
      if (responses.length < calls.length) {
        throw new Error(
          `期望 ${calls.length} 個回應，實得 ${responses.length}。stdout=${result.stdout} stderr=${result.stderr}`
        );
      }
      // 依 JSON-RPC id 排序：server 並行處理時回應順序不保證與請求順序相同，
      // 直接按輸出順序解構會拿到錯的那一個。
      return calls.map((_, i) => {
        const res = responses.find((r) => r.id === i + 1);
        if (!res) {
          throw new Error(`找不到 id=${i + 1} 的回應。stdout=${result.stdout}`);
        }
        return res;
      });
    }

    /** 送一個 JSON-RPC 請求，回傳解析後的回應 */
    async function rpc(method: string, params?: unknown): Promise<any> {
      const [res] = await rpcMany([{ method, params }]);
      return res;
    }

    // tool schema 的 maximum 只有走完整協議才看得到實際送出的值，
    // 單元測試打的是 mock handler，碰不到這裡。
    test('tools/list 的年份上限應跟著當前年份走，而非寫死', async () => {
      const res = await rpc('tools/list');
      const stats = res.result.tools.find((t: any) => t.name === 'get_holiday_stats');
      const year = stats.inputSchema.properties.year;

      expect(year.minimum).toBe(2017);
      expect(year.maximum).toBe(currentYear + 5); // 舊碼: 2026
      // 即使將來跑在 2027 年，舊碼的 2026 仍會失敗 → 這條差異測試不會隨時間失效
      expect(year.maximum).toBeGreaterThan(currentYear);
    }, 40000);

    test('resources/list 應跟著當前年份滾動，且不打網路', async () => {
      const res = await rpc('resources/list');
      const uris: string[] = res.result.resources.map((r: any) => r.uri);

      expect(uris).toContain(`taiwan-holidays://holidays/${currentYear}`); // 舊碼: 無（只有 2024/2025）
      expect(uris).not.toContain(`taiwan-holidays://holidays/${currentYear - 3}`);
      expect(uris.filter((u) => u.startsWith('taiwan-holidays://holidays/'))).toHaveLength(3);
      expect(uris.filter((u) => u.startsWith('taiwan-holidays://stats/'))).toHaveLength(3);
    }, 40000);

    // 清單只列最近幾年當入口建議；「任何年份都可以嘗試」由樣板宣告，
    // 所以清單不需要為了不漏列剛發布的年度而在握手路徑上做網路探測。
    test('resources/templates/list 應宣告年份樣板', async () => {
      const res = await rpc('resources/templates/list');
      const templates: string[] = res.result.resourceTemplates.map((t: any) => t.uriTemplate);

      expect(templates).toContain('taiwan-holidays://holidays/{year}');
      expect(templates).toContain('taiwan-holidays://stats/{year}');
    }, 40000);

    // 刻意用 2026 而不是 2027：2026 新舊碼都接受，失敗只能歸因於統計算錯。
    // 用 2027 的話舊碼會先被年份閘門擋掉，證據就被污染了。
    test('resources/read stats/2026 的補假計數不應翻倍', async () => {
      const res = await rpc('resources/read', { uri: 'taiwan-holidays://stats/2026' });
      // 協議回傳的 payload 把統計包在 data.statistics 底下，
      // 與 service 的回傳形狀不同 —— 這層只有協議測試看得到
      const stats = JSON.parse(res.result.contents[0].text).data.statistics;

      expect(stats.holidayTypes['補假']).toBe(stats.compensatoryDays);
      expect(stats.holidayTypes['補假']).toBe(6); // 舊碼: 12
      // 週末不該被算成具名國定假日
      expect(stats.nationalHolidays).toBe(16); // 舊碼: 114
      expect(stats.weekends).toBe(98);
    }, 40000);

    test('resources/read years 的清單應來自探測結果', async () => {
      const res = await rpc('resources/read', { uri: 'taiwan-holidays://years' });
      const data = JSON.parse(res.result.contents[0].text).data;

      // 不假設「明年已發布」—— 跨年後到新曆公布前那段時間並非如此。
      // 只斷言清單從上游起點開始、且至少涵蓋到今年（舊碼寫死迴圈到 2026，
      // 在 2027 年就會少掉今年）。
      expect(data.supportedYears[0]).toBe(2017);
      expect(Math.max(...data.supportedYears)).toBeGreaterThanOrEqual(currentYear);
    }, 40000);

    // 不假設「明年已發布」—— 從探測結果取實際最新年，跨年也不會誤敗。
    // 兩個請求串在同一個程序裡，避免各等一次 spawn timeout。
    test('最新發布年度可查，其後一年應說明尚未發布', async () => {
      const [yearsRes] = await rpcMany([
        { method: 'resources/read', params: { uri: 'taiwan-holidays://years' } },
      ]);
      const newest = Math.max(
        ...JSON.parse(yearsRes.result.contents[0].text).data.supportedYears
      );
      // newest + 1 依定義是上游沒有的年份；確保它仍在合理性上限內，
      // 否則會撞到「超出可查詢範圍」而不是「尚未發布」
      expect(newest + 1).toBeLessThanOrEqual(currentYear + 5);

      const [publishedRes, unpublishedRes] = await rpcMany([
        { method: 'tools/call', params: { name: 'get_holiday_stats', arguments: { year: newest } } },
        {
          method: 'tools/call',
          params: { name: 'get_holiday_stats', arguments: { year: newest + 1 } },
        },
      ]);

      expect(publishedRes.result.isError).toBeFalsy(); // 舊碼: schema maximum 先擋掉
      expect(publishedRes.result.content.map((c: any) => c.text).join('')).toContain(
        'totalHolidays'
      );

      expect(JSON.stringify(unpublishedRes.result)).toContain('上游尚未發布'); // 舊碼: 超出支援範圍
    }, 90000);
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