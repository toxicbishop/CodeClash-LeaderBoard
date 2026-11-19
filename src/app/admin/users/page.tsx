import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AdminNav } from '@/components/AdminNav';
import { NewLabAdminForm } from './NewLabAdminForm';
import type { User } from '@/types/database';

export const instant = false;

export default async function AdminUsersPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch current admin profile
  const { data: currentProfile } = await supabase
    .from('users')
    .select('name, role')
    .eq('user_id', user.id)
    .single();

  if (currentProfile?.role !== 'COMPETITION_ADMIN') {
    redirect('/login');
  }

  // Fetch all Lab Admins
  const { data: labAdmins } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'LAB_ADMIN')
    .order('created_at', { ascending: false });

  // Fetch lab assignments to show which lab they belong to
  const { data: labs } = await supabase
    .from('labs')
    .select('assigned_admin_id, lab_name, competitions(competition_name)');

  const labMap = new Map<string, { lab_name: string; competition_name: string }>();
  labs?.forEach((l: any) => {
    labMap.set(l.assigned_admin_id, {
      lab_name: l.lab_name,
      competition_name: l.competitions?.competition_name || 'Unassigned',
    });
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/users" adminName={currentProfile.name} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Lab Administrators
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Provision and manage authorized proctor accounts for computer labs.
            </p>
          </div>
          <NewLabAdminForm />
        </div>

        <div className="mt-8">
          {(!labAdmins || labAdmins.length === 0) ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <span className="text-4xl">👥</span>
              <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                No Lab Administrators Yet
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Provision administrator accounts to assign proctors to computer labs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Current Assignment</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {labAdmins.map((admin: User) => {
                    const assignment = labMap.get(admin.user_id);
                    return (
                      <tr key={admin.user_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                          {admin.name}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                          {admin.email}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {assignment ? (
                            <div>
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {assignment.lab_name}
                              </span>
                              <span className="text-zinc-400 block text-[11px]">
                                {assignment.competition_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">Not yet assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              admin.account_status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                            }`}
                          >
                            {admin.account_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(admin.created_at).toLocaleDateString()}
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
