import { AdminNav } from '@/components/AdminNav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import EmptyStateIcon from '@/components/EmptyStateIcon';
import { UserActionsClient } from './UserActionsClient';

export const instant = false;

export default async function AdminUsersPage() {
  const { profile, supabase } = await requireSuperAdmin();

  const { data: users } = await supabase
    .from('users')
    .select('*')
    .in('role', ['MASTER_LAB_ADMIN', 'HOD', 'PRINCIPAL'])
    .order('created_at', { ascending: false });

  const roleLabel: Record<string, string> = {
    MASTER_LAB_ADMIN: 'Master Lab Admin',
    HOD: 'HOD',
    PRINCIPAL: 'Principal',
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/users" adminName={profile.name} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">User Management</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Provision and manage Master Lab Admin, HOD, and Principal accounts.
            </p>
          </div>
          <a href="/admin/users/new"
            className="px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm">
            + Provision User
          </a>
        </div>

        <div className="mt-8">
          {(!users || users.length === 0) ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <EmptyStateIcon name="users" />
              <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">No Users Yet</h3>
              <p className="mt-1 text-sm text-zinc-500 max-w-sm mx-auto">
                Provision user accounts for the Master Lab Admin, HOD, and Principal.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Created</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{u.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          {roleLabel[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                          u.account_status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                        }`}>
                          {u.account_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <UserActionsClient
                          userId={u.user_id}
                          userName={u.name}
                          userRole={roleLabel[u.role] ?? u.role}
                          accountStatus={u.account_status}
                        />
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
