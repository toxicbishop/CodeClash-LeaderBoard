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
 * Fetch the full leaderboard for a HackerRank contest.
 *
 * @param slug           Contest slug, e.g. "codeclash-2026-setA"
 * @param sessionCookie  Optional _hr_session cookie for private contests
 */
export async function fetchContestLeaderboard(
  slug: string,
  sessionCookie?: string,
): Promise<HackerRankFetchResult> {
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
    const url = `https://www.hackerrank.com/rest/contests/${slug}/leaderboard?offset=${offset}&limit=100`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        // Cache for 60s so the projector view doesn't hammer HR on every refresh
        next: { revalidate: 60 },
      });
    } catch (err) {
      throw new HackerRankError(
        `Network error fetching HackerRank leaderboard for "${slug}": ${String(err)}`,
        undefined,
        slug,
      );
    }

    if (res.status === 404) {
      throw new HackerRankError(
        `Contest not found on HackerRank. Check the slug: "${slug}"`,
        404,
        slug,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new HackerRankError(
        `Access denied for contest "${slug}". This contest may be private — provide a session cookie.`,
        res.status,
        slug,
      );
    }
    if (!res.ok) {
      throw new HackerRankError(
        `HackerRank returned HTTP ${res.status} for contest "${slug}"`,
        res.status,
        slug,
      );
    }

    const json = await res.json() as {
      models: HackerRankEntry[];
      total: number;
    };

    total = json.total ?? 0;
    allEntries.push(...(json.models ?? []));
    page++;

  } while (allEntries.length < total && page < 50); // 50 pages max = 5000 participants

  return { entries: allEntries, total, slug };
}
