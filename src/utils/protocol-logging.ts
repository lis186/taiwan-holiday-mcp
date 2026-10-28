/**
 * MCP stdio 傳輸把 stdout 留給 JSON-RPC（一行一則訊息）。
 * console.log / console.info / console.debug 預設寫入 stdout，
 * 任何非協定輸出都必須改走 stderr。
 */

/**
 * 把一則伺服器日誌寫到 stderr。
 */
export function logToStderr(message: string): void {
  console.error(message);
}

/**
 * 伺服器進程啟動後呼叫。
 * SDK 的 StdioServerTransport 直接使用 process.stdout.write，不受這裡影響。
 */
export function redirectStdoutConsoleToStderr(): void {
  const writeToStderr = (...args: unknown[]): void => {
    console.error(...args);
  };

  console.log = writeToStderr as typeof console.log;
  console.info = writeToStderr as typeof console.info;
  console.debug = writeToStderr as typeof console.debug;
}
