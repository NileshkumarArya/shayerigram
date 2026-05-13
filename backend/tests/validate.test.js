// Test validation helpers directly
const { sanitizeString, parseCookies } = require('../middleware/security');

describe('Security utilities', () => {
  test('sanitizeString strips control chars', () => {
    const result = sanitizeString('hello\u0000world', 100);
    expect(result).toBe('helloworld');
  });

  test('sanitizeString enforces max length', () => {
    const result = sanitizeString('a'.repeat(200), 50);
    expect(result.length).toBe(50);
  });

  test('sanitizeString returns undefined for null/undefined', () => {
    expect(sanitizeString(null)).toBeUndefined();
    expect(sanitizeString(undefined)).toBeUndefined();
  });

  test('parseCookies parses simple cookie', () => {
    const cookies = parseCookies('token=abc123; theme=dark');
    expect(cookies.token).toBe('abc123');
    expect(cookies.theme).toBe('dark');
  });

  test('parseCookies handles empty string', () => {
    const cookies = parseCookies('');
    expect(cookies).toEqual({});
  });
});
