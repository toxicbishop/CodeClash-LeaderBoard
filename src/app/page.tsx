import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: 'Code Clash 2026 | Multi-Lab Contest Arena',
  description: 'Centralized leaderboard management and live auditorium display for multi-laboratory programming contests.',
};

export const instant = false;

export default async function HomePage() {
  const adminClient = createAdminClient();
  const sessionClient = await createClient();

  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  let userRole: string | null = null;
  let userName: string | null = null;
  if (user) {
    const { data: profile } = await sessionClient
      .from('users')
      .select('name, role')
      .eq('user_id', user.id)
      .maybeSingle();
    userRole = profile?.role || null;
    userName = profile?.name || null;
  }

  // Fetch competitions with lab count
  const { data: competitions } = await adminClient
    .from('competitions')
    .select('*, labs(lab_id)')
    .order('created_at', { ascending: false });

  // Featured competition is either the first published, or the latest active
  const featured =
    competitions?.find((c) => c.status === 'PUBLISHED') ||
    competitions?.find((c) => c.status === 'READY_FOR_REVIEW') ||
    competitions?.[0] ||
    null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Code Clash 2026
              </span>
              <span className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 hidden sm:inline">
                Contest Arena
              </span>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4">
              {featured && (
                <Link
                  href={`/competitions/${featured.slug}/leaderboard`}
                  className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Live Leaderboard
                </Link>
              )}

              {user ? (
                <Link
                  href={userRole === 'COMPETITION_ADMIN' ? '/admin' : '/lab-admin'}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                >
                  {userRole === 'COMPETITION_ADMIN' ? 'Admin Console' : 'Lab Portal'} ({userName?.split(' ')[0] || 'Dashboard'}) →
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-xs transition-colors"
                >
                  Sign In →
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="relative rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-12 lg:p-16 shadow-sm overflow-hidden">
          {/* Subtle accent glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-4">
              <span>● Distributed Multi-Lab Architecture</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
              Multi-Lab Programming Contest Arena
            </h1>

            <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Centralized result consolidation, automated verification, and auditorium-grade live leaderboards
              engineered for simultaneous multi-lab coding competitions.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {featured ? (
                <Link
                  href={`/competitions/${featured.slug}/leaderboard`}
                  className="px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  View Live Leaderboard ({featured.competition_name}) →
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-colors"
                >
                  Access Administrator Console →
                </Link>
              )}

              <Link
                href="/login"
                className="px-5 py-3 rounded-xl text-sm font-semibold border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Administrator Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* Featured Competition Spotlight */}
        {featured && (
          <div className="mt-10 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Featured Event
                </span>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                  {featured.competition_name}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                  /{featured.slug} • Contest Date: {new Date(featured.contest_date).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                    featured.status === 'PUBLISHED'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : featured.status === 'READY_FOR_REVIEW'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                  }`}
                >
                  {featured.status.replaceAll('_', ' ')}
                </span>
                <Link
                  href={`/competitions/${featured.slug}/leaderboard`}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                >
                  Launch Leaderboard ↗
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block">Top-K Threshold</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                  Top {featured.top_k} Qualify
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block">Participating Labs</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                  {featured.labs?.length || 0} Computer Labs
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block">Submission Deadline</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                  {new Date(featured.upload_deadline).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block">Visibility</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                  {featured.visibility}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* System Capabilities Section */}
        <div className="mt-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50">
              Contest Architecture
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              Built to guarantee data integrity, eliminate manual spreadsheets, and provide instant results.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Independent Lab Ingestion
              </h3>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Dedicated lab admin workspaces with dynamic CSV/XLSX header mapping, automatic magic-byte validation,
                and secure disk archiving.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Centralized Verification Gate
              </h3>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Super administrator approval matrix with itemized validation issue inspection, sample participant preview,
                and one-click approve/reject actions.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Auditorium Projector Display
              </h3>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Immutable published snapshots with standard tie-breaking (Score, Solved, Penalty), live search,
                lab filtering, and large-format auditorium projector mode.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Fat Footer */}
      <FatFooter currentCompetitionSlug={featured?.slug} />
    </div>
  );
}