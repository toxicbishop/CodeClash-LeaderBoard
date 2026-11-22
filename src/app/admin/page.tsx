import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import EmptyStateIcon from '@/components/EmptyStateIcon';

export const instant = false;

export default async function AdminDashboardPage() {
  const { profile, supabase } = await requireSuperAdmin();

  const [
    { count: competitionsCount },
    { count: setsCount },
    { count: usersCount },
    { data: recentCompetitions },
  ] = await Promise.all([
    supabase.from('competitions').select('*', { count: 'exact', head: true }),
    supabase.from('contest_sets').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true })
      .in('role', ['MASTER_LAB_ADMIN', 'HOD', 'PRINCIPAL']),
    supabase.from('competitions')
      .select('*, contest_sets(set_id)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin" adminName={profile.name} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Competition Overview</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Centralized leaderboard management — Code Clash 2026.
            </p>
          </div>
          <div className="flex space-x-3">
            <Link href="/admin/users"
              className="px-3.5 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              + Provision User
            </Link>
            <Link href="/admin/competitions"
              className="px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm">
              + Create Competition
            </Link>
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: 'Total Competitions', value: competitionsCount ?? 0, href: '/admin/competitions' },
            { label: 'Contest Sets Configured', value: setsCount ?? 0, href: null },
            { label: 'User Accounts', value: usersCount ?? 0, href: '/admin/users' },
          ].map(({ label, value, href }) => (
            <div key={label} className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">{value}</p>
              {href && (
                <Link href={href} className="mt-4 inline-block text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                  View all →
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Recent Competitions */}
        <div className="mt-10">
          <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Recent Competitions</h2>
            <Link href="/admin/competitions" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">View all</Link>
          </div>

          {(!recentCompetitions || recentCompetitions.length === 0) ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-6 p-8">
              <EmptyStateIcon name="flag" />
              <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">No competitions yet</h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">Create a competition to configure contest sets and begin syncing HackerRank leaderboards.</p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Contest Date</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Sets</th>
                    <th className="px-6 py-3.5">Top-K</th>
                    <th className="px-6 py-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {recentCompetitions.map((comp) => (
                    <tr key={comp.competition_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{comp.competition_name}</div>
                        <div className="text-[11px] font-mono text-zinc-400">/{comp.slug}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-300">
                        {new Date(comp.contest_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                          comp.status === 'PUBLISHED'      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                          comp.status === 'APPROVED'       ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                          comp.status === 'READY_FOR_REVIEW' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                          'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                        }`}>
                          {comp.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {(comp.contest_sets as unknown[])?.length ?? 0}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-300">Top {comp.top_k}</td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/competitions/${comp.competition_id}`}
                          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
