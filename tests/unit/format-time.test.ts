import { describe, expect, it } from 'vitest';
import { formatTimeTaken } from '@/lib/format/time';

describe('formatTimeTaken', () => {
  it('formats durations into zero-padded MM:SS with total minutes', () => {
    expect(formatTimeTaken(0)).toBe('00:00');
    expect(formatTimeTaken(9)).toBe('00:09');
    expect(formatTimeTaken(65)).toBe('01:05');
    expect(formatTimeTaken(2576)).toBe('42:56');
    expect(formatTimeTaken(4200)).toBe('70:00');
  });

  it('returns fallback for missing or invalid values', () => {
    expect(formatTimeTaken(null)).toBe('—');
    expect(formatTimeTaken(undefined)).toBe('—');
    expect(formatTimeTaken(-5)).toBe('—');
    expect(formatTimeTaken(Number.NaN, '')).toBe('');
    expect(formatTimeTaken(null, '')).toBe('');
  });
});
