import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { LeaderboardTable, LeaderboardRowItem } from '@/app/competitions/[slug]/leaderboard/LeaderboardTable';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: 'Live Leaderboard | Code Clash 2026',
  description: 'Official live standings and Top-K qualifiers for Code Clash 2026',
};

export const instant = false;

interface PageProps {
  searchParams?: Promise<{ comp?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const requestedSlug = resolvedParams?.comp;
  const adminClient = createAdminClient();

  // 1. Fetch competition: either requested by query, or the active/published one
  let activeComp: any = null;

  if (requestedSlug) {
    const { data } = await adminClient
      .from('competitions')
      .select('*')
      .eq('slug', requestedSlug)
      .maybeSingle();
    activeComp = data;
  }

  if (!activeComp) {
    const { data: competitions } = await adminClient
      .from('competitions')
      .select('*')
      .order('created_at', { ascending: false });

    activeComp =
      competitions?.find((c) => c.status === 'PUBLISHED') ||
      competitions?.find((c) => c.status === 'READY_FOR_REVIEW') ||
      competitions?.[0] ||
      null;
  }

  if (!activeComp) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col justify-between">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-16 flex items-center px-4 sm:px-8">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Code Clash 2026
          </Link>
        </header>

        <main className="max-w-md mx-auto p-8 text-center">
          <div className="text-4xl mb-4">⏱</div>
          <h1 className="text-xl font-bold">No Active Competition</h1>
          <p className="text-xs text-zinc-500 mt-2">
            There are currently no active competitions scheduled. Please check back later.
          </p>
          <Link href="/" className="mt-4 inline-block text-xs text-indigo-600 hover:underline">
            ← Return to Homepage
          </Link>
        </main>

        <FatFooter />
      </div>
    );
  }

  // 2. Fetch latest snapshot (prefer PUBLISHED, fallback to DRAFT if in review)
  const { data: snapshots } = await adminClient
    .from('leaderboard_snapshots')
    .select('*')
    .eq('competition_id', activeComp.competition_id)
    .order('version', { ascending: false })
    .limit(1);

  const currentSnapshot = snapshots && snapshots.length > 0 ? snapshots[0] : null;

  // 3. Fetch active labs for filtering
  const { data: labs } = await adminClient
    .from('labs')
    .select('lab_id, lab_name')
    .eq('competition_id', activeComp.competition_id)
    .eq('status', 'ACTIVE')
    .order('lab_name', { ascending: true });

  // 4. Fetch entries
  let rowItems: LeaderboardRowItem[] = [];
  if (currentSnapshot) {
    const { data: entries } = await adminClient
      .from('leaderboard_entries')
      .select(`
        entry_id,
        overall_rank,
        total_score,
        problems_solved,
        penalty,
        is_qualified,
        participant_id,
        lab_id,
        participants!inner(external_participant_id, participant_name),
        labs!inner(lab_name)
      `)
      .eq('leaderboard_id', currentSnapshot.leaderboard_id)
      .order('overall_rank', { ascending: true })
      .order('total_score', { ascending: false });

    if (entries) {
      rowItems = entries.map((e: any) => ({
        entry_id: e.entry_id,
        overall_rank: e.overall_rank,
        total_score: Number(e.total_score),
        problems_solved: e.problems_solved,
        penalty: e.penalty !== null ? Number(e.penalty) : null,
        is_qualified: e.is_qualified,
        participant_id: e.participant_id,
        external_id: e.participants?.external_participant_id || 'Unknown',
        participant_name: e.participants?.participant_name || 'Anonymous',
        lab_name: e.labs?.lab_name || 'Lab',
        lab_id: e.lab_id,
      }));
    }
  }

  const highScore = rowItems.length > 0 ? Math.max(...rowItems.map((r) => r.total_score)) : 0;
  const qualifiedCount = rowItems.filter((r) => r.is_qualified).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 selection:bg-indigo-500 selection:text-white">
      {/* Contestant Clean Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Link
                href="/"
                className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
              >
                <span>Code Clash 2026</span>
              </Link>
              <span className="text-zinc-400">/</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-xs sm:max-w-md">
                Official Leaderboard
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                Live Standings
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Contest Header Banner */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-sm relative overflow-hidden mb-8">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {activeComp.competition_name}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {new Date(activeComp.contest_date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                Contest Standings
              </h1>

              {activeComp.description && (
                <p className="mt-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl">
                  {activeComp.description}
                </p>
              )}
            </div>

            {/* Key Contest Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Contestants
                </span>
                <div className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-100 mt-1">
                  {rowItems.length}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Labs Active
                </span>
                <div className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-100 mt-1">
                  {labs?.length || 0}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  High Score
                </span>
                <div className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-100 mt-1">
                  {highScore}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Top Qualifiers
                </span>
                <div className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                  Top {activeComp.top_k} ({qualifiedCount})
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contestant Leaderboard Table */}
        {currentSnapshot && rowItems.length > 0 ? (
          <LeaderboardTable
            entries={rowItems}
            labs={labs || []}
            topK={activeComp.top_k}
            competitionName={activeComp.competition_name}
            isDraft={false}
          />
        ) : (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 sm:p-16 text-center shadow-sm">
            <div className="inline-flex p-4 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-4 text-3xl">
              ⏱
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Results Under Evaluation
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              Contest submissions are currently being verified across participating computer laboratories.
              Official rankings will appear on this screen as soon as they are finalized.
            </p>
          </div>
        )}
      </main>

      <FatFooter currentCompetitionSlug={activeComp.slug} />
    </div>
  );
}