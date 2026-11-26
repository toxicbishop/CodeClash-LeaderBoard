import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { NewCompetitionForm } from './NewCompetitionForm';

export const instant = false;

export default async function NewCompetitionPage() {
  const { profile } = await requireSuperAdmin();
  const defaultDate = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/competitions" adminName={profile.name} />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/admin/competitions"
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1"
        >
          <span>← Back to Competitions</span>
        </Link>

        <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Create Competition</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Configure contest parameters, event date, and qualification Top-K quota.
          </p>

          <NewCompetitionForm defaultDate={defaultDate} />
        </div>
      </main>
    </div>
  );
}
