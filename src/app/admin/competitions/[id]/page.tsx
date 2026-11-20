import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import EmptyStateIcon from '@/components/EmptyStateIcon';

export const instant = false;

interface PageProps { params: Promise<{ id: string }>; }

export default async function CompetitionDetailPage({ params }: PageProps) {
  const { profile, supabase } = await requireSuperAdmin();
  const { id: competitionId } = await params;

  const { data: competition } = await supabase
    .from('competitions')
    .select('*')
    .eq('competition_id', competitionId)
    .single();

  if (!competition) notFound();

  const { data: sets } = await supabase
    .from('contest_sets')
    .select('*, uploads(upload_id, status, record_count, upload_version, uploaded_at, rejection_reason)')
    .eq('competition_id', competitionId)
    .order('set_code', { ascending: true });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/competitions" adminName={profile.name} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin/competitions"
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Back to Competitions
        </Link>

        {/* Competition banner */}
        <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {competition.status.replace(/_/g, ' ')}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {competition.competition_name}
              </h1>
              {competition.description && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">{competition.description}</p>
              )}
            </div>
            <div className="flex flex-col sm:items-end text-xs text-zinc-500 space-y-1">
              <div>Contest Date: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{new Date(competition.contest_date).toLocaleDateString()}</span></div>
              <div>Top-K: <span className="font-semibold text-indigo-600 dark:text-indigo-400">Top {competition.top_k}</span></div>
            </div>
          </div>
        </div>

        {/* Contest Sets */}
        <div className="mt-10">
          <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Contest Sets ({sets?.length ?? 0})</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Each set maps to one HackerRank contest. The Master Lab Admin syncs each one.</p>
            </div>
            <Link href={`/admin/competitions/${competitionId}/sets/new`}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors">
              + Add Set
            </Link>
          </div>

          {(!sets || sets.length === 0) ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-6 p-8">
              <EmptyStateIcon name="lab" />
              <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">No Contest Sets Yet</h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
                Add contest sets (e.g. Set A, Set B) each linked to a HackerRank contest slug.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Set</th>
                    <th className="px-6 py-3.5">HackerRank Slug</th>
                    <th className="px-6 py-3.5">Upload Status</th>
                    <th className="px-6 py-3.5">Records</th>
                    <th className="px-6 py-3.5">Version</th>
                    <th className="px-6 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {sets.map((set) => {
                    const uploads = (set.uploads as { upload_id: string; status: string; record_count: number | null; upload_version: number; uploaded_at: string; rejection_reason: string | null }[]) ?? [];
                    // Latest upload = highest version number
                    const latest = uploads.sort((a, b) => b.upload_version - a.upload_version)[0];
                    const status = latest?.status ?? 'PENDING';

                    const statusClass =
                      status === 'APPROVED'          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                      status === 'PENDING_APPROVAL'   ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                      status === 'REJECTED'           ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                      status === 'VALIDATION_FAILED'  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' :
                      'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';

                    return (
                      <tr key={set.set_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                          {set.set_name}
                          <div className="text-[11px] font-mono text-zinc-400">{set.set_code}</div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-zinc-600 dark:text-zinc-300">
                          {set.hackerrank_slug}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${statusClass}`}>
                            {status.replace(/_/g, ' ')}
                          </span>
                          {latest?.rejection_reason && (
                            <p className="mt-1 text-[10px] text-red-500 max-w-xs">{latest.rejection_reason}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {latest?.record_count ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500">
                          {latest ? `v${latest.upload_version}` : '—'}
                        </td>
                        <td className="px-6 py-4 space-x-3 text-xs">
                          {status === 'PENDING_APPROVAL' && (
                            <Link href={`/admin/competitions/${competitionId}/uploads/${latest.upload_id}/review`}
                              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                              Review →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
