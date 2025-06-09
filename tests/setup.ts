/**
 * Jest test setup file
 * This file is executed before each test suite
 */

// Set test timeout
jest.setTimeout(10000);

// Mock console methods in test environment
const originalConsole = global.console;

beforeEach(() => {
  // Reset console mocks before each test
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };
});

afterEach(() => {
  // Restore original console after each test
  global.console = originalConsole;
}); 