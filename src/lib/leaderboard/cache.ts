import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import type { Competition } from '@/types/database';

export interface CachedLeaderboardRow {
  entry_id: string;
  overall_rank: number;
  total_score: number;
  problems_solved: number | null;
  penalty: number | null;
  qualification_status: 'QUALIFIED' | 'NOT_QUALIFIED' | 'BOUNDARY_REVIEW';
  participant_id: string;
  external_id: string;
  participant_name: string;
  set_name: string;
  set_code: string;
  set_id: string;
}

export interface CachedContestSet {
  set_id: string;
  set_name: string;
  set_code: string;
}

export interface CachedSnapshot {
  snapshot_id: string;
  competition_id: string;
  version: number;
  generated_at: string;
  published_at: string | null;
  status: string;
}

export interface CachedLeaderboardPayload {
  status: 'PUBLISHED' | 'NOT_FOUND_FOR_SLUG' | 'NO_ACTIVE_COMPETITION';
  competition: Competition | null;
  snapshot: CachedSnapshot | null;
  sets: CachedContestSet[];
  tieBreakers: { criterion: string; direction: string }[];
  entries: CachedLeaderboardRow[];
}

interface RawEntry {
  entry_id: string;
  overall_rank: number;
  total_score: number | string;
  problems_solved: number | null;
  penalty: number | null;
  qualification_status: 'QUALIFIED' | 'NOT_QUALIFIED' | 'BOUNDARY_REVIEW';
  participant_id: string;
  set_id: string;
  participants: {
    external_id: string;
    participant_name: string;
  } | null;
  contest_sets: {
    set_name: string;
    set_code: string;
  } | null;
}

export const LEADERBOARD_CACHE_TAG = 'leaderboard';

/**
 * Cached public leaderboard loader (`'use cache'`).
 * Invalidated on-demand via `updateTag('leaderboard')` whenever a snapshot
 * is published, auto-updated, ended, or tie-breaker rules change.
 */
export async function getCachedLeaderboardData(
  requestedSlug?: string,
): Promise<CachedLeaderboardPayload> {
  'use cache';
  cacheTag(LEADERBOARD_CACHE_TAG);
  cacheLife('hours');

  const supabase = createPublicClient();

  let activeComp: Competition | null = null;
  let currentSnapshot: CachedSnapshot | null = null;

  if (requestedSlug) {
    const { data: compWithSnap } = await supabase
      .from('competitions')
      .select(
        'competition_id, slug, competition_name, description, contest_date, top_k, status, created_at, leaderboard_snapshots(snapshot_id, competition_id, version, generated_at, published_at, status)',
      )
      .eq('slug', requestedSlug)
      .eq('status', 'PUBLISHED')
      .maybeSingle();

    if (!compWithSnap) {
      return {
        status: 'NOT_FOUND_FOR_SLUG',
        competition: null,
        snapshot: null,
        sets: [],
        tieBreakers: [],
        entries: [],
      };
    }

    activeComp = compWithSnap as unknown as Competition;
    const snaps = (compWithSnap.leaderboard_snapshots as unknown as CachedSnapshot[]) ?? [];
    currentSnapshot =
      snaps
        .filter((s) => Boolean(s) && s.status === 'PUBLISHED')
        .sort((a, b) => b.version - a.version)[0] ?? null;
  }

  if (!activeComp) {
    const { data: latestSnapshots } = await supabase
      .from('leaderboard_snapshots')
      .select(
        'snapshot_id, competition_id, version, generated_at, published_at, status, competitions!inner(competition_id, slug, competition_name, description, contest_date, top_k, status, created_at)',
      )
      .eq('status', 'PUBLISHED')
      .eq('competitions.status', 'PUBLISHED')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(1);

    const latestRow = latestSnapshots?.[0];
    if (latestRow) {
      const joinedComp = latestRow.competitions;
      activeComp = (Array.isArray(joinedComp) ? joinedComp[0] : joinedComp) as Competition;
      currentSnapshot = {
        snapshot_id: latestRow.snapshot_id,
        competition_id: latestRow.competition_id,
        version: latestRow.version,
        generated_at: latestRow.generated_at,
        published_at: latestRow.published_at,
        status: latestRow.status,
      };
    } else {
      const { data: competitions } = await supabase
        .from('competitions')
        .select('competition_id, slug, competition_name, description, contest_date, top_k, status, created_at')
        .eq('status', 'PUBLISHED')
        .order('created_at', { ascending: false })
        .limit(1);

      activeComp = competitions?.[0] ? (competitions[0] as Competition) : null;
    }
  }

  if (!activeComp) {
    return {
      status: 'NO_ACTIVE_COMPETITION',
      competition: null,
      snapshot: null,
      sets: [],
      tieBreakers: [],
      entries: [],
    };
  }

  const [{ data: contestSetsData }, { data: tieBreakersData }, entriesResult] = await Promise.all([
    supabase
      .from('contest_sets')
      .select('set_id, set_name, set_code')
      .eq('competition_id', activeComp.competition_id)
      .eq('is_active', true)
      .order('set_code', { ascending: true }),
    supabase
      .from('tie_breaker_rules')
      .select('criterion, direction')
      .eq('competition_id', activeComp.competition_id)
      .eq('enabled', true)
      .order('priority', { ascending: true }),
    currentSnapshot
      ? supabase
          .from('leaderboard_entries')
          .select(`
            entry_id,
            overall_rank,
            total_score,
            problems_solved,
            penalty,
            qualification_status,
            participant_id,
            set_id,
            participants!inner(external_id, participant_name),
            contest_sets!inner(set_name, set_code)
          `)
          .eq('snapshot_id', currentSnapshot.snapshot_id)
          .order('overall_rank', { ascending: true })
          .order('total_score', { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const entries: CachedLeaderboardRow[] = (
    (entriesResult.data as unknown as RawEntry[]) ?? []
  ).map((e) => ({
    entry_id: e.entry_id,
    overall_rank: e.overall_rank,
    total_score: Number(e.total_score),
    problems_solved: e.problems_solved,
    penalty: e.penalty !== null ? Number(e.penalty) : null,
    qualification_status: e.qualification_status,
    participant_id: e.participant_id,
    external_id: e.participants?.external_id || 'Unknown',
    participant_name: e.participants?.participant_name || 'Anonymous',
    set_name: e.contest_sets?.set_name || 'Contest Set',
    set_code: e.contest_sets?.set_code || '',
    set_id: e.set_id,
  }));

  return {
    status: 'PUBLISHED',
    competition: activeComp,
    snapshot: currentSnapshot,
    sets: (contestSetsData as CachedContestSet[]) || [],
    tieBreakers: (tieBreakersData as { criterion: string; direction: string }[]) || [],
    entries,
  };
}
