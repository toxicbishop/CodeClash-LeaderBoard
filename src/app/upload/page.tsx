import { requireMasterLabAdmin } from '@/lib/auth/guards';
import { logout } from '@/app/login/actions';
import EmptyStateIcon from '@/components/EmptyStateIcon';
import Link from 'next/link';

export const instant = false;

export default async function UploadDashboardPage() {
  const { profile, supabase } = await requireMasterLabAdmin();

  // Fetch the active competition (most recent)
  const { data: competition } = await supabase
    .from('competitions')
    .select('*, contest_sets(*, uploads(upload_id, status, record_count, upload_version, uploaded_at))')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const statusClass = (status: string) => {
    switch (status) {
      case 'APPROVED':         return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'PENDING_APPROVAL': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'REJECTED':         return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'VALIDATION_FAILED':return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'SYNCING':          return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:                 return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Upload Portal
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Code Clash 2026</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                {profile.name} · {profile.role.replace(/_/g, ' ')}
              </span>
              <form action={logout}>
                <button type="submit"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!competition ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
            <EmptyStateIcon name="flag" />
            <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">No Active Competition</h2>
            <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto">
              The Super Admin has not yet configured a competition. Contact them to set up the contest sets.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Competition card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Active Competition</span>
                  <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">{competition.competition_name}</h1>
                  <p className="text-sm text-zinc-500 mt-1">
                    Contest Date: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{new Date(competition.contest_date).toLocaleDateString()}</span>
                    &nbsp;·&nbsp; Top-K: <span className="font-semibold text-indigo-600 dark:text-indigo-400">Top {competition.top_k}</span>
                  </p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${statusClass(competition.status)}`}>
                  {competition.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Contest set sync cards */}
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">Contest Sets — Sync from HackerRank</h2>
              {(!competition.contest_sets || competition.contest_sets.length === 0) ? (
                <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <p className="text-sm text-zinc-500">No contest sets configured yet. The Super Admin must add them first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(competition.contest_sets as {
                    set_id: string; set_name: string; set_code: string; hackerrank_slug: string;
                    uploads: { upload_id: string; status: string; record_count: number | null; upload_version: number; uploaded_at: string }[]
                  }[]).map((set) => {
                    const sortedUploads = [...(set.uploads ?? [])].sort((a, b) => b.upload_version - a.upload_version);
                    const latest = sortedUploads[0];
                    const status = latest?.status ?? 'PENDING';

                    return (
                      <div key={set.set_id}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{set.set_name}</h3>
                            <p className="text-xs font-mono text-zinc-500 mt-0.5">{set.hackerrank_slug}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${statusClass(status)}`}>
                            {status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {latest && (
                          <div className="text-xs text-zinc-500 space-y-0.5 mb-4">
                            <div>{latest.record_count ?? 0} participants synced · v{latest.upload_version}</div>
                            <div>Last synced: {new Date(latest.uploaded_at).toLocaleString()}</div>
                          </div>
                        )}

                        <Link
                          href={`/upload/${set.set_id}`}
                          className="inline-block w-full text-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors">
                          {latest ? 'Re-sync from HackerRank' : 'Sync from HackerRank'}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
