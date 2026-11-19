import Link from 'next/link';
import EmptyStateIcon from '@/components/EmptyStateIcon';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AdminNav } from '@/components/AdminNav';

export const instant = false;

export default async function AdminDashboardPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'COMPETITION_ADMIN') {
    redirect('/');
  }

  // Fetch summary counts
  const [{ count: competitionsCount }, { count: labsCount }, { count: adminsCount }] =
    await Promise.all([
      supabase.from('competitions').select('*', { count: 'exact', head: true }),
      supabase.from('labs').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'LAB_ADMIN'),
    ]);

  // Fetch recent competitions
  const { data: recentCompetitions } = await supabase
    .from('competitions')
    .select('*, labs(lab_id)')
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin" adminName={profile.name} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Competition Overview
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Centralized monitoring matrix for Code Clash multi-lab competitions.
            </p>
          </div>
          <div className="flex space-x-3">
            <Link
              href="/admin/users"
              className="px-3.5 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              + Provision Lab Admin
            </Link>
            <Link
              href="/admin/competitions"
              className="px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
            >
              + Create Competition
            </Link>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Competitions
            </span>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
              {competitionsCount ?? 0}
            </p>
            <Link
              href="/admin/competitions"
              className="mt-4 inline-block text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all competitions →
            </Link>
          </div>

          <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Configured Labs
            </span>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
              {labsCount ?? 0}
            </p>
            <span className="mt-4 block text-xs text-zinc-500 dark:text-zinc-400">
              Distributed across competitions
            </span>
          </div>

          <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Active Lab Administrators
            </span>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
              {adminsCount ?? 0}
            </p>
            <Link
              href="/admin/users"
              className="mt-4 inline-block text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Manage accounts →
            </Link>
          </div>
        </div>

        {/* Recent Competitions Table */}
        <div className="mt-10">
          <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Recent Competitions
            </h2>
            <Link
              href="/admin/competitions"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all
            </Link>
          </div>

          {(!recentCompetitions || recentCompetitions.length === 0) ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-6 p-8">
              <EmptyStateIcon name="flag" />
              <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Ready to host your first competition
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Get started by creating a competition and adding your participating labs.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Contest Date</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Labs</th>
                    <th className="px-6 py-3.5">Top-K</th>
                    <th className="px-6 py-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {recentCompetitions.map((comp: any) => (
                    <tr key={comp.competition_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {comp.competition_name}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          /{comp.slug}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-300">
                        {new Date(comp.contest_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          {comp.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {comp.labs?.length || 0}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-300">
                        Top {comp.top_k}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/competitions/${comp.competition_id}`}
                          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Manage Labs →
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
