import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidContestSlug,
  fetchContestLeaderboard,
  HackerRankError,
} from '@/lib/hackerrank/client';

describe('HackerRank Client SSRF Protection and Slug Validation', () => {
  describe('isValidContestSlug', () => {
    it('accepts valid contest slugs', () => {
      expect(isValidContestSlug('codeclash-2026-setA')).toBe(true);
      expect(isValidContestSlug('contest_123')).toBe(true);
      expect(isValidContestSlug('round-1')).toBe(true);
      expect(isValidContestSlug('simple')).toBe(true);
    });

    it('rejects path traversal attempts', () => {
      expect(isValidContestSlug('../evil')).toBe(false);
      expect(isValidContestSlug('..')).toBe(false);
      expect(isValidContestSlug('/etc/passwd')).toBe(false);
      expect(isValidContestSlug('contest/../../etc')).toBe(false);
      expect(isValidContestSlug('contest/setA')).toBe(false);
      expect(isValidContestSlug('..%2F..%2F')).toBe(false);
    });

    it('rejects URLs, protocols, and host injection attempts', () => {
      expect(isValidContestSlug('http://attacker.com')).toBe(false);
      expect(isValidContestSlug('https://evil.com')).toBe(false);
      expect(isValidContestSlug('//attacker.com/contest')).toBe(false);
      expect(isValidContestSlug('localhost:3000')).toBe(false);
      expect(isValidContestSlug('127.0.0.1')).toBe(false);
      expect(isValidContestSlug('foo@attacker.com')).toBe(false);
    });

    it('rejects query and fragment parameters', () => {
      expect(isValidContestSlug('contest?param=value')).toBe(false);
      expect(isValidContestSlug('contest#hash')).toBe(false);
    });

    it('rejects spaces, empty strings, and non-string inputs', () => {
      expect(isValidContestSlug('')).toBe(false);
      expect(isValidContestSlug('   ')).toBe(false);
      expect(isValidContestSlug('code clash')).toBe(false);
      expect(isValidContestSlug(null)).toBe(false);
      expect(isValidContestSlug(undefined)).toBe(false);
    });
  });

  describe('fetchContestLeaderboard', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('throws HackerRankError without making network requests for malicious slugs', async () => {
      await expect(fetchContestLeaderboard('../../../evil')).rejects.toThrow(HackerRankError);
      await expect(fetchContestLeaderboard('https://internal-service.local')).rejects.toThrow(
        /Invalid HackerRank contest slug/,
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('makes safe requests to hackerrank.com for valid slugs', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              {
                rank: 1,
                hacker: 'alice',
                score: 100,
                time_taken: 45,
                solved_challenges: 3,
              },
            ],
            total: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await fetchContestLeaderboard('codeclash-setA');
      expect(result.entries.length).toBe(1);
      expect(result.slug).toBe('codeclash-setA');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const requestedUrl = vi.mocked(global.fetch).mock.calls[0][0];
      const urlObj = new URL(requestedUrl as string);
      expect(urlObj.origin).toBe('https://www.hackerrank.com');
      expect(urlObj.pathname).toBe('/rest/contests/codeclash-setA/leaderboard');
    });
  });
});
