/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  rootDir: '.',
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  modulePathIgnorePatterns: ['<rootDir>/.stryker-tmp/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.test.json',
    }],
  },
  // Mutation runs must not rebuild dist or collect coverage.
  setupFiles: ['<rootDir>/tests/mutation-env-setup.js'],
  collectCoverage: false,
  testTimeout: 20000,
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: 1,
};
