import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { provisionUser } from '@/app/admin/actions';

export const instant = false;

export default async function NewUserPage() {
  const { profile } = await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/users" adminName={profile.name} />

      <main className="max-w-xl mx-auto px-4 py-8">
        <Link
          href="/admin/users"
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1"
        >
          <span>← Back to User Management</span>
        </Link>

        <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Provision User Account</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Create Master Lab Admin (HackerRank sync) or institutional monitor (HOD, Principal) accounts.
          </p>

          <form action={provisionUser} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Full Name
              </label>
              <input
                name="name"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Dr. Rajesh Kumar"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="hod.cse@institution.edu"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Role
              </label>
              <select
                name="role"
                required
                className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="MASTER_LAB_ADMIN">Master Lab Admin (Central HackerRank Uploads)</option>
                <option value="HOD">HOD (Departmental Monitor - Read Only)</option>
                <option value="PRINCIPAL">Principal (Institutional Monitor - Read Only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Initial Password
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
              <Link
                href="/admin/users"
                className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
              >
                Provision Account
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
