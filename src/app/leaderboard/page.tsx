import Link from 'next/link';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  LeaderboardTable,
  LeaderboardRowItem,
  ContestSetItem,
} from '@/app/competitions/[slug]/leaderboard/LeaderboardTable';
import { FatFooter } from '@/components/FatFooter';
import type { Competition } from '@/types/database';

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

export const metadata = {
  title: 'Live Leaderboard | Code Clash 2026',
  description: 'Consolidated standings and Top-K qualifiers for Code Clash 2026',
};

export const instant = false;

interface PageProps {
  searchParams?: Promise<{ comp?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  await connection();
  const resolvedParams = searchParams ? await searchParams : undefined;
  const requestedSlug = resolvedParams?.comp;
  const supabase = await createClient();

  // 1. Fetch competition + latest PUBLISHED snapshot in a single query
  interface PublishedSnapshotRow {
    snapshot_id: string;
    competition_id: string;
    version: number;
    generated_at: string;
    published_at: string | null;
    status: string;
  }

  let activeComp: Competition | null = null;
  let currentSnapshot: PublishedSnapshotRow | null = null;

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
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col justify-between">
          <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-16 flex items-center px-4 sm:px-8">
            <Link href="/" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400">
              Code Clash 2026
            </Link>
          </header>

          <main className="max-w-md mx-auto p-8 text-center">
            <svg className="size-8 mx-auto text-zinc-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <h1 className="text-xl font-medium">Leaderboard not published yet</h1>
            <p className="text-xs text-zinc-500 mt-2">
              The competition <span className="font-mono text-zinc-700 dark:text-zinc-300">{requestedSlug}</span> either does not exist or has not been published yet.
            </p>
            <Link href="/leaderboard" className="mt-4 inline-block text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              View latest published leaderboard &rarr;
            </Link>
          </main>

          <FatFooter />
        </div>
      );
    }

    activeComp = compWithSnap as unknown as Competition;
    const snaps = (compWithSnap.leaderboard_snapshots as unknown as PublishedSnapshotRow[]) ?? [];
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
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col justify-between">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-16 flex items-center px-4 sm:px-8">
          <Link href="/" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400">
            Code Clash 2026
          </Link>
        </header>

        <main className="max-w-md mx-auto p-8 text-center">
          <svg className="size-8 mx-auto text-zinc-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <h1 className="text-xl font-medium">No active competition</h1>
          <p className="text-xs text-zinc-500 mt-2">
            There are currently no published competitions available for public view. Please check back later.
          </p>
          <Link href="/" className="mt-4 inline-block text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
            &larr; Return to homepage
          </Link>
        </main>

        <FatFooter />
      </div>
    );
  }

  // 2. Fetch contest sets, tie-breaker rules, and snapshot entries in parallel
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

  const contestSets: ContestSetItem[] = contestSetsData || [];
  let rowItems: LeaderboardRowItem[] = [];
  if (entriesResult.data) {
    rowItems = (entriesResult.data as unknown as RawEntry[]).map((e) => ({
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
  }

  const isDraft = currentSnapshot?.status === 'DRAFT';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      {/* Clean Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                Code Clash 2026
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-xs sm:max-w-md">
                Official Leaderboard
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span className="size-2 rounded-sm bg-emerald-600" />
              <span>Live standings</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Contest Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 pb-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
                {activeComp.competition_name} Standings
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
                {activeComp.description || 'Consolidated rankings across all contest sets with automated tiebreaker resolution and qualifier cutoff evaluation.'}
              </p>
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono whitespace-nowrap">
              {new Date(activeComp.contest_date).toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })} &bull; Top {activeComp.top_k} Qualifiers
            </div>
          </div>
        </div>

        {/* Contestant Leaderboard Table */}
        {currentSnapshot && rowItems.length > 0 ? (
          <LeaderboardTable
            entries={rowItems}
            sets={contestSets}
            topK={activeComp.top_k}
            competitionName={activeComp.competition_name}
            isDraft={isDraft}
            tieBreakers={tieBreakersData || []}
            lastUpdated={currentSnapshot.published_at || currentSnapshot.generated_at}
          />
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 sm:p-16 text-center">
            <svg className="size-8 mx-auto text-zinc-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Results under evaluation
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              Contest submissions are currently being verified across participating contest sets. Official rankings will appear here once verified.
            </p>
          </div>
        )}
      </main>

      <FatFooter currentCompetitionSlug={activeComp.slug} />
    </div>
  );
}
