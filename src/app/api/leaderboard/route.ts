import { NextRequest, NextResponse } from 'next/server';
import { getCachedLeaderboardData } from '@/lib/leaderboard/cache';

export async function GET(request: NextRequest) {
  const requestedSlug = request.nextUrl.searchParams.get('comp')?.trim() || undefined;
  const requestedVersionRaw = request.nextUrl.searchParams.get('version');
  const requestedVersion =
    requestedVersionRaw !== null && requestedVersionRaw !== ''
      ? Number(requestedVersionRaw)
      : null;

  const data = await getCachedLeaderboardData(requestedSlug);

  if (data.status !== 'PUBLISHED' || !data.snapshot) {
    return NextResponse.json(
      {
        unchanged: false,
        status: data.status,
        snapshot: null,
        sets: data.sets,
        tieBreakers: data.tieBreakers,
        entries: [],
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (requestedVersion !== null && Number.isFinite(requestedVersion) && requestedVersion === data.snapshot.version) {
    return NextResponse.json(
      { unchanged: true, version: data.snapshot.version },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      unchanged: false,
      status: data.status,
      snapshot: data.snapshot,
      sets: data.sets,
      tieBreakers: data.tieBreakers,
      entries: data.entries,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
