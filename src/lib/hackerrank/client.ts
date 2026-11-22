/**
 * src/lib/hackerrank/client.ts
 *
 * Fetches leaderboard data directly from HackerRank's REST API.
 * Handles pagination (100 entries per page) and optional session cookies
 * for private/invite-only contests.
 *
 * This runs exclusively on the server (called from Server Actions only).
 * Session cookies never reach the browser.
 */

export interface HackerRankEntry {
  rank: number;
  hacker: string;              // username / handle
  score: number;
  time_taken: number;          // penalty in seconds
  solved_challenges: number;
  submissions_total?: number;
  country?: string;
}

export interface HackerRankFetchResult {
  entries: HackerRankEntry[];
  total: number;
  slug: string;
}

export class HackerRankError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly slug?: string,
  ) {
    super(message);
    this.name = 'HackerRankError';
  }
}

/**
 * Strict regex for validating HackerRank contest slugs.
 * HackerRank contest slugs only contain alphanumeric characters, hyphens, and underscores.
 * Any other characters (e.g. '/', '.', '?', '#', '@') are disallowed to prevent SSRF and path traversal.
 */
export const HACKERRANK_SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;
export const HACKERRANK_REQUEST_TIMEOUT_MS = 10000; // 10-second timeout per page fetch
export const MAX_HACKERRANK_PAGES = 50;             // Max 50 pages (5,000 participants)

/**
 * Validates whether a slug is safe and valid for HackerRank API requests.
 */
export function isValidContestSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && HACKERRANK_SLUG_REGEX.test(slug.trim());
}

/**
 * Fetch the full leaderboard for a HackerRank contest.
 *
 * @param slug           Contest slug, e.g. "codeclash-2026-setA"
 * @param sessionCookie  Optional _hr_session cookie for private contests
 */
export async function fetchContestLeaderboard(
  slug: string,
  sessionCookie?: string,
): Promise<HackerRankFetchResult> {
  const trimmedSlug = (slug ?? '').trim();
  if (!isValidContestSlug(trimmedSlug)) {
    throw new HackerRankError(
      `Invalid HackerRank contest slug: "${slug}". Slugs may only contain alphanumeric characters, hyphens, and underscores.`,
      400,
      slug,
    );
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'CodeClash-Leaderboard/2.0',
  };
  if (sessionCookie) {
    headers['Cookie'] = `_hr_session=${sessionCookie}`;
  }

  const allEntries: HackerRankEntry[] = [];
  let page = 0;
  let total = 0;

  do {
    const offset = page * 100;
    const safeSlug = encodeURIComponent(trimmedSlug);
    const targetUrl = new URL(`/rest/contests/${safeSlug}/leaderboard`, 'https://www.hackerrank.com');
    targetUrl.searchParams.set('offset', offset.toString());
    targetUrl.searchParams.set('limit', '100');

    if (targetUrl.hostname !== 'www.hackerrank.com' || targetUrl.protocol !== 'https:') {
      throw new HackerRankError('Invalid URL destination', 400, trimmedSlug);
    }

    const url = targetUrl.toString();

    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(HACKERRANK_REQUEST_TIMEOUT_MS),
        // Cache for 60s so the projector view doesn't hammer HR on every refresh
        next: { revalidate: 60 },
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new HackerRankError(
          `Request to HackerRank timed out after ${HACKERRANK_REQUEST_TIMEOUT_MS}ms for "${trimmedSlug}"`,
          408,
          trimmedSlug,
        );
      }
      throw new HackerRankError(
        `Network error fetching HackerRank leaderboard for "${trimmedSlug}": ${String(err)}`,
        undefined,
        trimmedSlug,
      );
    }

    if (res.status === 404) {
      throw new HackerRankError(
        `Contest not found on HackerRank. Check the slug: "${trimmedSlug}"`,
        404,
        trimmedSlug,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new HackerRankError(
        `Access denied for contest "${trimmedSlug}". This contest may be private — provide a session cookie.`,
        res.status,
        trimmedSlug,
      );
    }
    if (!res.ok) {
      throw new HackerRankError(
        `HackerRank returned HTTP ${res.status} for contest "${trimmedSlug}"`,
        res.status,
        trimmedSlug,
      );
    }

    const json = await res.json() as {
      models: HackerRankEntry[];
      total: number;
    };

    total = json.total ?? 0;
    allEntries.push(...(json.models ?? []));
    page++;

  } while (allEntries.length < total && page < MAX_HACKERRANK_PAGES);

  return { entries: allEntries, total, slug: trimmedSlug };
}
