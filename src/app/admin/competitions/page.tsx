import Link from 'next/link';
import EmptyStateIcon from '@/components/EmptyStateIcon';
import { AdminNav } from '@/components/AdminNav';
import { NewCompetitionForm } from './NewCompetitionForm';
import { requireCompetitionAdmin } from '@/lib/auth/guards';

export const instant = false;

export default async function AdminCompetitionsPage() {
  const { profile, supabase } = await requireCompetitionAdmin();

  // Fetch competitions with count of attached labs
  const { data: competitions } = await supabase
    .from('competitions')
    .select('*, labs(lab_id)')
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/competitions" adminName={profile.name} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Competitions
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Configure coding contests, set deadlines, and manage participating laboratories.
            </p>
          </div>
          <NewCompetitionForm />
        </div>

        <div className="mt-8">
          {(!competitions || competitions.length === 0) ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
              <EmptyStateIcon name="trophy" />
              <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                No Competitions Created Yet
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Create your first competition to set up labs, assign proctors, and start ingesting leaderboards.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions.map((comp) => {
                const labCount = comp.labs?.length || 0;
                return (
                  <div
                    key={comp.competition_id}
                    className="flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:border-indigo-500/50 transition-colors"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                            comp.status === 'READY_FOR_REVIEW'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : comp.status === 'PUBLISHED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : comp.status === 'PROCESSING'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                              : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                          }`}
                        >
                          {comp.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Top-{comp.top_k}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-3 line-clamp-1">
                        {comp.competition_name}
                      </h3>
                      <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                        /{comp.slug}
                      </p>

                      {comp.description && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-2">
                          {comp.description}
                        </p>
                      )}

                      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="flex justify-between">
                          <span>Contest Date:</span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-200">
                            {new Date(comp.contest_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Deadline:</span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-200">
                            {new Date(comp.upload_deadline).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Labs Attached:</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {labCount} {labCount === 1 ? 'lab' : 'labs'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                      <Link
                        href={`/admin/competitions/${comp.competition_id}`}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Manage Labs & Status →
                      </Link>
                      <span className="text-[11px] text-zinc-400">
                        {comp.visibility}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
