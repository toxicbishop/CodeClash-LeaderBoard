import Link from 'next/link';

interface FatFooterProps {
  currentCompetitionSlug?: string;
}

export function FatFooter({ currentCompetitionSlug }: FatFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand & Platform Summary */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Code Clash 2026
              </span>
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Leaderboard Arena
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm">
              Centralized competition management system engineered to validate, consolidate, rank, and publish
              real-time results across distributed computer laboratories.
            </p>

            {/* Live System Operational Indicator */}
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>System Operational • Multi-Lab Ingestion Online</span>
            </div>

            <div className="pt-2 text-[11px] text-zinc-400 font-mono">
              PostgreSQL Schema v2.0 • Supabase RLS Protected
            </div>
          </div>

          {/* Column 1: Live Arena */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Contest Arena
            </h4>
            <ul className="space-y-2">
              {currentCompetitionSlug ? (
                <li>
                  <Link
                    href={`/competitions/${currentCompetitionSlug}/leaderboard`}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    Live Official Leaderboard
                  </Link>
                </li>
              ) : (
                <li>
                  <Link
                    href="/"
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    Active Competitions
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="/"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Contest Overview
                </Link>
              </li>
              <li>
                <span className="text-zinc-500 dark:text-zinc-500">
                  Auditorium Projector Display
                </span>
              </li>
              <li>
                <span className="text-zinc-500 dark:text-zinc-500">
                  Top-K Qualifier Matrix
                </span>
              </li>
              <li>
                <span className="text-zinc-500 dark:text-zinc-500">
                  CSV & Excel Export
                </span>
              </li>
            </ul>
          </div>

          {/* Column 2: Portals & Roles */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Portals & Roles
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/admin"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Competition Administrator
                </Link>
              </li>
              <li>
                <Link
                  href="/lab-admin"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Lab Administrator Portal
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Administrator Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/competitions"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Multi-Lab Management
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/users"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Admin Provisioning
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Rules & Standards */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Contest Standards
            </h4>
            <ul className="space-y-2 text-zinc-500 dark:text-zinc-400">
              <li>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Contest Format:</span> 3 Rounds (100 Marks)
              </li>
              <li>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Round 1 (Easy):</span> 10 Qs • 20 Marks
              </li>
              <li>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Round 2 (Medium):</span> 5 Qs • 30 Marks
              </li>
              <li>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Round 3 (Hard):</span> 3 Qs • 50 Marks
              </li>
              <li>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Tiebreakers:</span> Score ➔ Solved ➔ Penalty
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
          <div>
            &copy; {currentYear} Code Clash Leaderboard System. All rights reserved.
          </div>

          <div className="flex items-center space-x-6">
            <span>HackerRank Community Ingestion</span>
            <span>•</span>
            <span>Immutable Snapshots</span>
            <span>•</span>
            <span>Strict Role-Based Access Control</span>
          </div>
        </div>
      </div>
    </footer>
  );
}