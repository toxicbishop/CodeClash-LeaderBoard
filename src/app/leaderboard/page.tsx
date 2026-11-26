import Link from 'next/link';
import { connection } from 'next/server';
import {
  LeaderboardTable,
  LeaderboardRowItem,
  ContestSetItem,
} from '@/app/competitions/[slug]/leaderboard/LeaderboardTable';
import { FatFooter } from '@/components/FatFooter';
import { getCachedLeaderboardData } from '@/lib/leaderboard/cache';

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
  const requestedSlug = resolvedParams?.comp?.trim() || undefined;

  const data = await getCachedLeaderboardData(requestedSlug);

  if (data.status === 'NOT_FOUND_FOR_SLUG') {
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

  if (data.status === 'NO_ACTIVE_COMPETITION' || !data.competition) {
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

  const activeComp = data.competition;
  const currentSnapshot = data.snapshot;
  const contestSets: ContestSetItem[] = data.sets;
  const rowItems: LeaderboardRowItem[] = data.entries;
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
            key={activeComp.competition_id}
            entries={rowItems}
            sets={contestSets}
            topK={activeComp.top_k}
            competitionName={activeComp.competition_name}
            competitionSlug={activeComp.slug}
            snapshotVersion={currentSnapshot.version}
            isDraft={isDraft}
            tieBreakers={data.tieBreakers}
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
