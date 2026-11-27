import { NextRequest, NextResponse } from 'next/server';
import { getCachedLeaderboardData } from '@/lib/leaderboard/cache';

export async function GET(request: NextRequest) {
  const requestedSlug = request.nextUrl.searchParams.get('comp')?.trim() || undefined;
  const requestedVersionRaw = request.nextUrl.searchParams.get('version');
  const requestedVersion =
    requestedVersionRaw !== null && requestedVersionRaw !== ''
      ? Number(requestedVersionRaw)
      : null;

  const requestedRoundRaw = request.nextUrl.searchParams.get('round');
  const parsedRound = requestedRoundRaw ? Number.parseInt(requestedRoundRaw, 10) : NaN;
  const requestedRound =
    Number.isFinite(parsedRound) && parsedRound > 0 ? parsedRound : undefined;

  const clientCurrentRoundRaw = request.nextUrl.searchParams.get('currentRound');
  const parsedClientCurrentRound = clientCurrentRoundRaw
    ? Number.parseInt(clientCurrentRoundRaw, 10)
    : NaN;
  const clientCurrentRound =
    Number.isFinite(parsedClientCurrentRound) && parsedClientCurrentRound > 0
      ? parsedClientCurrentRound
      : null;

  const data =
    requestedRound !== undefined
      ? await getCachedLeaderboardData(requestedSlug, requestedRound)
      : await getCachedLeaderboardData(requestedSlug);

  if (data.status !== 'PUBLISHED' || !data.snapshot) {
    return NextResponse.json(
      {
        unchanged: false,
        status: data.status,
        snapshot: null,
        currentRound: data.currentRound,
        viewingRound: data.viewingRound,
        rounds: data.rounds,
        sets: data.sets,
        tieBreakers: data.tieBreakers,
        entries: [],
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const sameRound =
    clientCurrentRound === null || clientCurrentRound === data.currentRound;

  if (
    sameRound &&
    requestedVersion !== null &&
    Number.isFinite(requestedVersion) &&
    requestedVersion === data.snapshot.version
  ) {
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
      currentRound: data.currentRound,
      viewingRound: data.viewingRound,
      rounds: data.rounds,
      sets: data.sets,
      tieBreakers: data.tieBreakers,
      entries: data.entries,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
