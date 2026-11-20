import { describe, it, expect } from 'vitest';

/**
 * Mirror of CSV escaping and sanitization logic
 */
function sanitizeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  let safeStr = str;
  if (/^[=+\-@\t\r]/.test(safeStr)) {
    safeStr = "'" + safeStr;
  }
  if (safeStr.includes(',') || safeStr.includes('"') || safeStr.includes('\n') || safeStr.includes('\r')) {
    return `"${safeStr.replace(/"/g, '""')}"`;
  }
  return safeStr;
}

describe('CSV Sanitization & Formula Injection Protection', () => {
  it('escapes standard strings without special characters as bare strings', () => {
    expect(sanitizeCsvValue('john_doe')).toBe('john_doe');
    expect(sanitizeCsvValue('Alice Smith')).toBe('Alice Smith');
  });

  it('neutralizes spreadsheet formula injection prefixes (=, +, -, @)', () => {
    expect(sanitizeCsvValue('=SUM(A1:B2)')).toBe("'=SUM(A1:B2)");
    expect(sanitizeCsvValue('=CMD|"/C calc"!A0')).toBe('"\'=CMD|""/C calc""!A0"');
    expect(sanitizeCsvValue('+12345')).toBe("'+12345");
    expect(sanitizeCsvValue('-500')).toBe("'-500");
    expect(sanitizeCsvValue('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
  });

  it('quotes cells containing commas and escapes internal double-quotes', () => {
    expect(sanitizeCsvValue('Doe, Jane')).toBe('"Doe, Jane"');
    expect(sanitizeCsvValue('John "Ace" Doe')).toBe('"John ""Ace"" Doe"');
  });

  it('handles null and undefined gracefully', () => {
    expect(sanitizeCsvValue(null)).toBe('');
    expect(sanitizeCsvValue(undefined)).toBe('');
  });
});
