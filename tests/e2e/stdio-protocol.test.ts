/**
 * 以 stdio 啟動真正的伺服器，確認 stdout 每一行都是 JSON-RPC。
 * 關機與除錯日誌必須出現在 stderr。
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { join } from 'path';

interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  result?: unknown;
  error?: unknown;
}

function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const message = value as JsonRpcMessage;
  if (message.jsonrpc !== '2.0') {
    return false;
  }
  const hasResult = Object.prototype.hasOwnProperty.call(message, 'result');
  const hasError = Object.prototype.hasOwnProperty.call(message, 'error');
  const hasId = Object.prototype.hasOwnProperty.call(message, 'id');
  if (hasResult && hasError) {
    return false;
  }
  if (hasResult || hasError) {
    return hasId;
  }
  return typeof message.method === 'string';
}

describe('stdio JSON-RPC 協定衛生', () => {
  test('initialize、tools/list、check_holiday 的 stdout 全部是 JSON-RPC', async () => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production', DEBUG: 'true' };
    delete env.JEST_WORKER_ID;

    const child = spawn(process.execPath, [join(process.cwd(), 'dist', 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    }) as ChildProcessWithoutNullStreams;

    let stdoutBuffer = '';
    let stderr = '';
    const stdoutLines: string[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      let newline = stdoutBuffer.indexOf('\n');
      while (newline >= 0) {
        const line = stdoutBuffer.slice(0, newline).replace(/\r$/, '');
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line.length > 0) {
          stdoutLines.push(line);
        }
        newline = stdoutBuffer.indexOf('\n');
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const pending = new Map<number, (message: JsonRpcMessage) => void>();

    const waitForId = (id: number, timeoutMs: number): Promise<JsonRpcMessage> => {
      const existing = stdoutLines
        .map((line) => JSON.parse(line) as JsonRpcMessage)
        .find((message) => message.id === id);
      if (existing) {
        return Promise.resolve(existing);
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`等待 JSON-RPC id=${id} 逾時。stdout=${stdoutLines.join(' | ')} stderr=${stderr}`));
        }, timeoutMs);
        pending.set(id, (message) => {
          clearTimeout(timer);
          pending.delete(id);
          resolve(message);
        });
      });
    };

    child.stdout.on('data', () => {
      for (const line of stdoutLines) {
        let message: JsonRpcMessage;
        try {
          message = JSON.parse(line) as JsonRpcMessage;
        } catch {
          continue;
        }
        if (typeof message.id === 'number' && pending.has(message.id)) {
          pending.get(message.id)!(message);
        }
      }
    });

    const send = (message: unknown): void => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    try {
      const initializePromise = waitForId(1, 10000);
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'stdio-protocol-test', version: '1.0.0' },
        },
      });
      const initialize = await initializePromise;
      expect(initialize.result).toEqual(expect.objectContaining({
        protocolVersion: '2024-11-05',
        serverInfo: expect.objectContaining({ name: 'taiwan-holiday-mcp' }),
      }));

      send({ jsonrpc: '2.0', method: 'notifications/initialized' });

      const toolsPromise = waitForId(2, 10000);
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
      const tools = await toolsPromise;
      const names = (tools.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);
      expect(names).toEqual(expect.arrayContaining([
        'check_holiday',
        'get_holidays_in_range',
        'get_holiday_stats',
        'get_next_holidays',
        'get_workdays',
      ]));

      const holidayPromise = waitForId(3, 30000);
      send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'check_holiday',
          arguments: { date: '2024-01-01' },
        },
      });
      const holiday = await holidayPromise;
      expect(holiday.result).toEqual(expect.objectContaining({
        content: expect.any(Array),
      }));
      const body = JSON.parse((holiday.result as { content: Array<{ text: string }> }).content[0].text);
      expect(body.tool).toBe('check_holiday');
      expect(body.success).toBe(true);
      expect(body.data.isHoliday).toBe(true);

      child.kill('SIGTERM');
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`伺服器沒有結束。stderr=${stderr}`)), 8000);
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });

      if (stdoutBuffer.trim().length > 0) {
        stdoutLines.push(stdoutBuffer.trim());
      }

      expect(exitCode).toBe(0);
      expect(stderr).toContain('[GracefulShutdown]');
      expect(stderr).toContain('除錯模式已啟用');
      expect(stdoutLines.length).toBeGreaterThanOrEqual(3);

      for (const line of stdoutLines) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          throw new Error(`stdout 不是 JSON: ${line}`);
        }
        expect(isJsonRpcMessage(parsed)).toBe(true);
      }
    } finally {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGKILL');
      }
    }
  }, 60000);
});
