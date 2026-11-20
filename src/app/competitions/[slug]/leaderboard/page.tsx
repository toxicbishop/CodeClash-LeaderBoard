import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { LeaderboardTable, LeaderboardRowItem } from './LeaderboardTable';
import { FatFooter } from '@/components/FatFooter';

export const instant = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const adminClient = createAdminClient();
  const { data: comp } = await adminClient
    .from('competitions')
    .select('competition_name')
    .eq('slug', slug)
    .maybeSingle();

  return {
    title: comp ? `${comp.competition_name} | Official Leaderboard` : 'Contest Leaderboard',
    description: 'Live unified leaderboard and official standings for Code Clash 2026',
  };
}

export default async function CompetitionLeaderboardPage({ params }: PageProps) {
  const { slug } = await params;
  const adminClient = createAdminClient();

  // 1. Fetch competition by slug
  const { data: comp } = await adminClient
    .from('competitions')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!comp) {
    notFound();
  }

  // 2. Check viewer identity
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  let isCompetitionAdmin = false;
  if (user) {
    const { data: profile } = await sessionClient
      .from('users')
      .select('role, account_status')
      .eq('user_id', user.id)
      .maybeSingle();
    isCompetitionAdmin = profile?.role === 'COMPETITION_ADMIN' && profile?.account_status === 'ACTIVE';
  }

  // 3. Fetch snapshots
  // If admin, can see DRAFT or PUBLISHED. If public, only PUBLISHED.
  const snapshotQuery = adminClient
    .from('leaderboard_snapshots')
    .select('*')
    .eq('competition_id', comp.competition_id)
    .order('version', { ascending: false });

  if (!isCompetitionAdmin) {
    snapshotQuery.eq('status', 'PUBLISHED');
  }

  const { data: snapshots } = await snapshotQuery.limit(1);
  const currentSnapshot = snapshots && snapshots.length > 0 ? snapshots[0] : null;

  // 4. Fetch labs
  const { data: labs } = await adminClient
    .from('labs')
    .select('lab_id, lab_name')
    .eq('competition_id', comp.competition_id)
    .eq('status', 'ACTIVE')
    .order('lab_name', { ascending: true });

  // 5. Fetch leaderboard entries if snapshot exists
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

  const isDraft = currentSnapshot?.status === 'DRAFT';
  const highScore = rowItems.length > 0 ? Math.max(...rowItems.map((r) => r.total_score)) : 0;
  const qualifiedCount = rowItems.filter((r) => r.is_qualified).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 selection:bg-indigo-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Link
                href="/"
                className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
              >
                <span>Code Clash Arena</span>
              </Link>
              <span className="text-zinc-400">/</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-xs sm:max-w-md">
                {comp.competition_name}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              {isCompetitionAdmin && (
                <Link
                  href={`/admin/competitions/${comp.competition_id}`}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 transition-colors"
                >
                  Admin Console →
                </Link>
              )}
              {!user && (
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                >
                  Admin Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Hero Section */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-sm relative overflow-hidden mb-8">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Official Standings
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    currentSnapshot?.status === 'PUBLISHED'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}
                >
                  {currentSnapshot?.status === 'PUBLISHED'
                    ? `● Live v${currentSnapshot.version}.0`
                    : '○ Draft Snapshot'}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {new Date(comp.contest_date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                {comp.competition_name}
              </h1>

              {comp.description && (
                <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
                  {comp.description}
                </p>
              )}
            </div>

            {/* Quick Stats Grid */}
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
                  Top Score
                </span>
                <div className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-100 mt-1">
                  {highScore}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Qualifiers
                </span>
                <div className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                  Top {comp.top_k} ({qualifiedCount})
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Table or Awaiting State */}
        {currentSnapshot && rowItems.length > 0 ? (
          <LeaderboardTable
            entries={rowItems}
            labs={labs || []}
            topK={comp.top_k}
            competitionName={comp.competition_name}
            isDraft={isDraft}
          />
        ) : (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 sm:p-16 text-center shadow-sm">
            <div className="inline-flex p-4 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-4 text-3xl">
              ⏱
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Leaderboard In Progress
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              Contest submissions are currently being evaluated and verified across participating computer labs.
              Official rankings will appear here as soon as the administrator publishes them.
            </p>

            {isCompetitionAdmin && (
              <div className="mt-6">
                <Link
                  href={`/admin/competitions/${comp.competition_id}`}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <span>Go to Admin Console to Consolidate & Publish →</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      <FatFooter currentCompetitionSlug={slug} />
    </div>
  );
}