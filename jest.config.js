/** @type {import('jest').Config} */
export default {
  // 測試環境
  testEnvironment: 'node',

  // TypeScript 支援
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],

  // 根目錄
  rootDir: '.',

  // 測試檔案匹配模式
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts'
  ],

  // 忽略的測試檔案
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],

  // 模組檔案副檔名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // 模組路徑對應
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // 轉換設定
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.test.json'
    }]
  },

  // 設定檔案
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // 覆蓋率設定
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts'  // 排除主要啟動檔案
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // 測試超時時間（毫秒）
  testTimeout: 10000,

  // 詳細輸出
  verbose: true,

  // 清除模擬
  clearMocks: true,
  restoreMocks: true,

  // 錯誤處理
  errorOnDeprecated: true,

  // 限制並行執行以避免競態條件
  maxWorkers: 1,

  // 測試環境變數設定
  setupFiles: ['<rootDir>/tests/jest-env-setup.js']
}; 