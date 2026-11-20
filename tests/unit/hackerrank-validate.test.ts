import { describe, it, expect } from 'vitest';
import { validateHackerRankEntries } from '@/lib/hackerrank/validate';

describe('validateHackerRankEntries', () => {
  it('passes valid entries with non-negative scores and unique handles', () => {
    const entries = [
      { rank: 1, hacker: 'alice', score: 100, time_taken: 45, solved_challenges: 3 },
      { rank: 2, hacker: 'bob', score: 85, time_taken: 60, solved_challenges: 2 },
    ];
    const { valid, errors, duplicateHandles } = validateHackerRankEntries(entries);
    expect(valid.length).toBe(2);
    expect(errors.length).toBe(0);
    expect(duplicateHandles.length).toBe(0);
  });

  it('flags entries with missing hacker username', () => {
    const entries = [
      { rank: 1, hacker: '', score: 100, time_taken: 45, solved_challenges: 3 },
    ];
    const { valid, errors } = validateHackerRankEntries(entries);
    expect(valid.length).toBe(0);
    expect(errors.some((e) => e.field === 'hacker')).toBe(true);
  });

  it('flags entries with negative scores', () => {
    const entries = [
      { rank: 1, hacker: 'charlie', score: -10, time_taken: 45, solved_challenges: 3 },
    ];
    const { valid, errors } = validateHackerRankEntries(entries);
    expect(valid.length).toBe(0);
    expect(errors.some((e) => e.field === 'score' && e.message.includes('Negative'))).toBe(true);
  });

  it('detects duplicate participant handles within the same contest set', () => {
    const entries = [
      { rank: 1, hacker: 'alice', score: 100, time_taken: 45, solved_challenges: 3 },
      { rank: 2, hacker: 'ALICE', score: 80, time_taken: 50, solved_challenges: 2 },
    ];
    const { valid, errors, duplicateHandles } = validateHackerRankEntries(entries);
    expect(valid.length).toBe(1);
    expect(duplicateHandles).toContain('alice');
    expect(errors.some((e) => e.message.includes('Duplicate participant handle'))).toBe(true);
  });
});
