/**
 * `npm pack --dry-run --json` 的檔案清單。
 *
 * npm 10/11 印出 packument 陣列；npm 12 印出以套件名稱為鍵的物件。
 * 巢狀在 `npm test` / `npm publish` 裡時，人類可讀的 lifecycle 與
 * Tarball Contents 不會出現在 stdout，所以測試只解析 JSON。
 */

export interface PackedPackage {
  filename: string;
  files: string[];
}

interface Packument {
  filename?: unknown;
  files?: unknown;
}

export function parseNpmPackJson(stdout: string): PackedPackage {
  const trimmed = stdout.trim();
  const objectAt = trimmed.indexOf('{');
  const arrayAt = trimmed.indexOf('[');
  const starts = [objectAt, arrayAt].filter((index) => index >= 0);
  if (starts.length === 0) {
    throw new Error(`npm pack --json 沒有輸出 JSON：${trimmed}`);
  }

  const parsed: unknown = JSON.parse(trimmed.slice(Math.min(...starts)));
  const pack = pickPackument(parsed);
  if (!pack || typeof pack.filename !== 'string' || !Array.isArray(pack.files)) {
    throw new Error(`npm pack --json 格式無法辨識：${trimmed}`);
  }

  return {
    filename: pack.filename,
    files: pack.files.map((file) => {
      if (typeof file === 'string') {
        return file;
      }
      if (file && typeof file === 'object' && typeof (file as { path?: unknown }).path === 'string') {
        return (file as { path: string }).path;
      }
      throw new Error(`npm pack 檔案項目格式無法辨識：${JSON.stringify(file)}`);
    }),
  };
}

function pickPackument(parsed: unknown): Packument | undefined {
  if (Array.isArray(parsed)) {
    return parsed[0] as Packument | undefined;
  }
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record.filename === 'string') {
    return record;
  }

  const first = Object.values(record)[0];
  if (first && typeof first === 'object') {
    return first as Packument;
  }
  return undefined;
}
