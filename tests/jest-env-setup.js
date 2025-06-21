// Jest environment setup - runs before each test file
// Only set DEBUG=false if not explicitly set by test
if (!process.env.DEBUG) {
  process.env.DEBUG = 'false';
}