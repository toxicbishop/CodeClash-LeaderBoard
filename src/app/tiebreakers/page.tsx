import Link from 'next/link';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: 'Tiebreaking Criteria | Code Clash 2026',
  description: 'Deterministic tiebreaking rules, Olympic ranking calculation, and boundary resolution for Code Clash 2026.',
};

export default function TiebreakersPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400">
            &larr; Code Clash Portal
          </Link>
          <span className="text-xs text-zinc-400 font-mono">Last updated: November 2026</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-12 space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-medium text-zinc-900 dark:text-zinc-50">
              Tiebreaking Specification
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              How the Code Clash scoring engine computes deterministic rankings, handles shared positions, and resolves qualification cutoffs.
            </p>
          </div>

          <div className="space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">1. Evaluation Hierarchy</h2>
              <p>
                When contestants finish with identical scores, the leaderboard engine evaluates tiebreaker criteria
                in strict priority order:
              </p>

              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 divide-y divide-zinc-200 dark:divide-zinc-800">
                <div className="p-4 flex items-start gap-4">
                  <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                    Tier 1
                  </span>
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Total Score (Descending)</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Sum of points awarded across all problem test cases in the participant&apos;s contest set (max 100). Higher score ranks above lower.
                    </p>
                  </div>
                </div>

                <div className="p-4 flex items-start gap-4">
                  <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                    Tier 2
                  </span>
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Problems Solved (Descending)</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Total count of problems with 100% test case clearance without partial deduction. More problems solved ranks above fewer.
                    </p>
                  </div>
                </div>

                <div className="p-4 flex items-start gap-4">
                  <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                    Tier 3
                  </span>
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Penalty Time (Ascending)</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Total cumulative time in seconds from contest start to the last accepted submission, plus any incorrect submission penalty seconds. Lower penalty time ranks above higher.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">2. Olympic Shared Ranks</h2>
              <p>
                If two or more contestants have identical values across all active tiebreaker criteria, they are assigned
                an identical rank designated with an equals prefix (e.g. <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">=2</code>).
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                In accordance with standard Olympic ranking rules, subsequent ranks skip by the number of tied contestants. For example, if two contestants share Rank 2, the next ranked participant receives Rank 4.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">3. Cutoff Boundary Resolution</h2>
              <p>
                The competition defines a Top-K qualification threshold (typically the top 10 contestants).
                If a tie exists across the qualification cutoff boundary:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm">
                <li>Affected contestants are assigned status <code className="font-mono text-xs bg-rose-500/10 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded">Boundary tie</code>.</li>
                <li>The leaderboard displays a boundary review banner informing spectators and administrators.</li>
                <li>Automatic promotion is paused until the Competition Admin reviews detailed timestamps or executes an administrative tiebreak.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">4. Rule Reconfiguration</h2>
              <p>
                Authorized competition administrators may reorder tiebreaker priorities, invert sort direction, or enable additional criteria
                in the competition control panel before snapshot publication. Once published, the snapshot version freezes
                the exact tiebreaker specification used for that release.
              </p>
            </section>
          </div>
        </div>
      </main>

      <FatFooter />
    </div>
  );
}
