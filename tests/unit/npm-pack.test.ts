import { parseNpmPackJson } from '../e2e/npm-pack.js';

describe('parseNpmPackJson', () => {
  const files = [
    { path: 'package.json', size: 1, mode: 420 },
    { path: 'dist/index.js', size: 2, mode: 493 },
    { path: 'dist/index.d.ts', size: 3, mode: 420 },
    { path: 'README.md', size: 4, mode: 420 },
    { path: 'LICENSE', size: 5, mode: 420 },
  ];

  test('npm 10/11 的陣列格式', () => {
    const stdout = JSON.stringify([
      {
        filename: 'taiwan-holiday-mcp-2.1.0.tgz',
        files,
      },
    ]);

    expect(parseNpmPackJson(stdout)).toEqual({
      filename: 'taiwan-holiday-mcp-2.1.0.tgz',
      files: ['package.json', 'dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE'],
    });
  });

  test('npm 12 以套件名稱為鍵的物件格式', () => {
    const stdout = JSON.stringify({
      'taiwan-holiday-mcp': {
        filename: 'taiwan-holiday-mcp-2.1.0.tgz',
        files,
      },
    });

    expect(parseNpmPackJson(stdout).files).toContain('dist/index.js');
  });

  test('單一 packument 物件', () => {
    const stdout = `\n${JSON.stringify({
      filename: 'taiwan-holiday-mcp-2.1.0.tgz',
      files: ['dist/index.js'],
    })}\n`;

    expect(parseNpmPackJson(stdout).files).toEqual(['dist/index.js']);
  });
});
