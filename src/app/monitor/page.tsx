import { requireMonitor } from '@/lib/auth/guards';
import { logout } from '@/app/login/actions';
import EmptyStateIcon from '@/components/EmptyStateIcon';

export const instant = false;

export default async function MonitorDashboardPage() {
  const { profile, supabase } = await requireMonitor();

  const { data: competition } = await supabase
    .from('competitions')
    .select('*, contest_sets(set_id, set_name, set_code, uploads(status, record_count))')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: snapshot } = competition
    ? await supabase
        .from('leaderboard_snapshots')
        .select('*, leaderboard_entries(*, participants(external_id, participant_name, has_collision), contest_sets(set_name))')
        .eq('competition_id', competition.competition_id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Monitor Portal
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">Code Clash 2026</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-zinc-500 hidden sm:inline">{profile.name} · {profile.role}</span>
            <form action={logout}>
              <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!competition ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <EmptyStateIcon name="flag" />
            <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">No Competition Data Yet</h2>
            <p className="mt-2 text-sm text-zinc-500">The competition has not been configured yet.</p>
          </div>
        ) : (
          <>
            {/* Overview card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{competition.competition_name}</h1>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Contest Date', value: new Date(competition.contest_date).toLocaleDateString() },
                  { label: 'Top-K', value: `Top ${competition.top_k}` },
                  { label: 'Contest Sets', value: competition.contest_sets?.length ?? 0 },
                  { label: 'Status', value: competition.status.replace(/_/g, ' ') },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{label}</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload status per set */}
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">Upload Status by Contest Set</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(competition.contest_sets as {
                  set_id: string; set_name: string;
                  uploads: { status: string; record_count: number | null }[]
                }[])?.map((set) => {
                  const latestStatus = set.uploads?.[0]?.status ?? 'PENDING';
                  const records = set.uploads?.[0]?.record_count ?? 0;
                  return (
                    <div key={set.set_id}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{set.set_name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{records} participants</p>
                      <span className={`mt-2 inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                        latestStatus === 'APPROVED'         ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        latestStatus === 'PENDING_APPROVAL' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                      }`}>
                        {latestStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leaderboard preview */}
            {snapshot ? (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    Leaderboard — v{snapshot.version}
                    <span className={`ml-3 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                      snapshot.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {snapshot.status}
                    </span>
                  </h2>

                  <a
                    href={`/api/competitions/${competition.competition_id}/export?snapshotId=${snapshot.snapshot_id}`}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-xs"
                  >
                    ↓ Download Official CSV
                  </a>
                </div>
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Rank</th>
                        <th className="px-6 py-3.5">ID</th>
                        <th className="px-6 py-3.5">Name</th>
                        <th className="px-6 py-3.5">Set</th>
                        <th className="px-6 py-3.5">Score</th>
                        <th className="px-6 py-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {(snapshot.leaderboard_entries as {
                        entry_id: string; overall_rank: number; total_score: number;
                        qualification_status: string;
                        participants: { external_id: string; participant_name: string } | null;
                        contest_sets: { set_name: string } | null;
                      }[])?.map((entry) => (
                        <tr key={entry.entry_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="px-6 py-3 text-xs font-bold text-zinc-900 dark:text-zinc-100">#{entry.overall_rank}</td>
                          <td className="px-6 py-3 text-xs font-mono text-zinc-600 dark:text-zinc-300">{entry.participants?.external_id ?? '—'}</td>
                          <td className="px-6 py-3 text-xs font-medium text-zinc-900 dark:text-zinc-100">{entry.participants?.participant_name ?? '—'}</td>
                          <td className="px-6 py-3 text-xs text-zinc-500">{entry.contest_sets?.set_name ?? '—'}</td>
                          <td className="px-6 py-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100">{entry.total_score}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                              entry.qualification_status === 'QUALIFIED'       ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                              entry.qualification_status === 'BOUNDARY_REVIEW' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                              'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                            }`}>
                              {entry.qualification_status.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">Leaderboard not yet generated. Waiting for all sets to be approved.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
