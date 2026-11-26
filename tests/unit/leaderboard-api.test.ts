import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/leaderboard/route';

const { cachedDataMock } = vi.hoisted(() => ({
  cachedDataMock: vi.fn(),
}));

vi.mock('@/lib/leaderboard/cache', () => ({
  getCachedLeaderboardData: cachedDataMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/leaderboard', () => {
  it('returns unchanged: true when client version matches cached snapshot version', async () => {
    cachedDataMock.mockResolvedValue({
      status: 'PUBLISHED',
      competition: { slug: 'cc-2026' },
      snapshot: {
        snapshot_id: 'snap-1',
        competition_id: 'comp-1',
        version: 4,
        generated_at: '2026-11-26T00:00:00Z',
        published_at: '2026-11-26T00:00:00Z',
        status: 'PUBLISHED',
      },
      sets: [{ set_id: 's1', set_name: 'Set A', set_code: 'seta' }],
      tieBreakers: [],
      entries: [{ entry_id: 'e1', overall_rank: 1 }],
    });

    const req = new NextRequest('http://localhost:3000/api/leaderboard?comp=cc-2026&version=4');
    const res = await GET(req);
    const json = (await res.json()) as { unchanged: boolean; version?: number };

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(json).toEqual({ unchanged: true, version: 4 });
    expect(cachedDataMock).toHaveBeenCalledWith('cc-2026');
  });

  it('returns full snapshot payload when client version is stale', async () => {
    cachedDataMock.mockResolvedValue({
      status: 'PUBLISHED',
      competition: { slug: 'cc-2026' },
      snapshot: {
        snapshot_id: 'snap-2',
        competition_id: 'comp-1',
        version: 5,
        generated_at: '2026-11-26T00:01:00Z',
        published_at: '2026-11-26T00:01:00Z',
        status: 'PUBLISHED',
      },
      sets: [{ set_id: 's1', set_name: 'Set A', set_code: 'seta' }],
      tieBreakers: [{ criterion: 'total_score', direction: 'DESC' }],
      entries: [{ entry_id: 'e1', overall_rank: 1 }],
    });

    const req = new NextRequest('http://localhost:3000/api/leaderboard?version=4');
    const res = await GET(req);
    const json = (await res.json()) as {
      unchanged: boolean;
      snapshot: { version: number };
      entries: unknown[];
    };

    expect(json.unchanged).toBe(false);
    expect(json.snapshot.version).toBe(5);
    expect(json.entries).toHaveLength(1);
    expect(cachedDataMock).toHaveBeenCalledWith(undefined);
  });

  it('returns empty entries when no published competition is active', async () => {
    cachedDataMock.mockResolvedValue({
      status: 'NO_ACTIVE_COMPETITION',
      competition: null,
      snapshot: null,
      sets: [],
      tieBreakers: [],
      entries: [],
    });

    const req = new NextRequest('http://localhost:3000/api/leaderboard?version=1');
    const res = await GET(req);
    const json = (await res.json()) as {
      unchanged: boolean;
      status: string;
      snapshot: null;
      entries: unknown[];
    };

    expect(json.unchanged).toBe(false);
    expect(json.status).toBe('NO_ACTIVE_COMPETITION');
    expect(json.snapshot).toBeNull();
    expect(json.entries).toEqual([]);
  });
});
