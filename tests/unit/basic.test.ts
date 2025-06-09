/**
 * Basic test to verify test environment setup
 */

describe('Test Environment', () => {
  it('should be properly configured', () => {
    expect(true).toBe(true);
  });

  it('should have Jest globals available', () => {
    expect(jest).toBeDefined();
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });
}); 