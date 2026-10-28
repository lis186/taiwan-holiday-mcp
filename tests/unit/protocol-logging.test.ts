/**
 * 非協定日誌必須走 stderr。MCP stdio 的 stdout 只能是 JSON-RPC。
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { logToStderr, redirectStdoutConsoleToStderr } from '../../src/utils/protocol-logging.js';

function listTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...listTypeScriptFiles(fullPath));
    } else if (fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('protocol logging', () => {
  const originalConsole = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    error: console.error,
  };

  afterEach(() => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    console.error = originalConsole.error;
  });

  test('logToStderr 寫入 stderr', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    logToStderr('[GracefulShutdown] shutting down');

    expect(errorSpy).toHaveBeenCalledWith('[GracefulShutdown] shutting down');
    expect(stdoutSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  test('console.log / info / debug 會被轉到 stderr', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    redirectStdoutConsoleToStderr();
    console.log('[GracefulShutdown] via log');
    console.info('HealthMonitor status');
    console.debug('cache miss');

    expect(errorSpy).toHaveBeenCalledWith('[GracefulShutdown] via log');
    expect(errorSpy).toHaveBeenCalledWith('HealthMonitor status');
    expect(errorSpy).toHaveBeenCalledWith('cache miss');
    expect(stdoutSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  test('伺服器執行路徑沒有寫到 stdout 的日誌呼叫', () => {
    const forbidden = [
      { name: 'console.log', pattern: /console\.log\s*\(/ },
      { name: 'console.info', pattern: /console\.info\s*\(/ },
      { name: 'console.debug', pattern: /console\.debug\s*\(/ },
      { name: 'process.stdout', pattern: /process\.stdout\.(write|end)\s*\(/ },
    ];

    const offenders: string[] = [];
    for (const file of listTypeScriptFiles(join(process.cwd(), 'src'))) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const rule of forbidden) {
        if (rule.pattern.test(source)) {
          offenders.push(`${file} contains ${rule.name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
