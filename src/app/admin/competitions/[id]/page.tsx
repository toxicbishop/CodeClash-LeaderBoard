import Link from 'next/link';
import EmptyStateIcon from '@/components/EmptyStateIcon';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { AddLabForm } from './AddLabForm';
import type { User } from '@/types/database';
import { requireCompetitionAdmin } from '@/lib/auth/guards';

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompetitionDetailPage({ params }: PageProps) {
  const { profile, supabase } = await requireCompetitionAdmin();
  const { id: competitionId } = await params;

  // Fetch competition
  const { data: competition } = await supabase
    .from('competitions')
    .select('*')
    .eq('competition_id', competitionId)
    .single();

  if (!competition) {
    notFound();
  }

  // Fetch labs for this competition along with assigned admin profiles
  const { data: labs } = await supabase
    .from('labs')
    .select('*, users!labs_assigned_admin_id_fkey(user_id, name, email)')
    .eq('competition_id', competitionId)
    .order('created_at', { ascending: true });

  // Fetch latest upload per lab to determine upload status
  const { data: uploads } = await supabase
    .from('uploads')
    .select('upload_id, lab_id, status, file_name, record_count, uploaded_at')
    .eq('competition_id', competitionId)
    .order('upload_version', { ascending: false });

  const latestUploadByLab = new Map<string, NonNullable<typeof uploads>[number]>();
  uploads?.forEach((up) => {
    if (!latestUploadByLab.has(up.lab_id)) {
      latestUploadByLab.set(up.lab_id, up);
    }
  });

  // Fetch all active Lab Admins to populate the AddLab select dropdown
  const { data: allLabAdmins } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'LAB_ADMIN')
    .eq('account_status', 'ACTIVE');

  // Filter out admins already assigned to a lab in this competition
  const assignedAdminIds = new Set(labs?.map((l) => l.assigned_admin_id) || []);
  const availableAdmins = (allLabAdmins || []).filter(
    (adm: User) => !assignedAdminIds.has(adm.user_id)
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/competitions" adminName={profile.name} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/admin/competitions"
            className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1"
          >
            <span>← Back to Competitions</span>
          </Link>
        </div>

        {/* Competition Banner */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {competition.status.replaceAll('_', ' ')}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  Slug: /{competition.slug}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {competition.competition_name}
              </h1>
              {competition.description && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
                  {competition.description}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:items-end text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
              <div>
                Date:{' '}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {new Date(competition.contest_date).toLocaleDateString()}
                </span>
              </div>
              <div>
                Deadline:{' '}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {new Date(competition.upload_deadline).toLocaleString()}
                </span>
              </div>
              <div>
                Top-K Qualifier:{' '}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Top {competition.top_k}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Participating Laboratories */}
        <div className="mt-10">
          <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                Participating Labs ({labs?.length || 0})
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Each computer lab is managed by one designated Lab Administrator.
              </p>
            </div>
            <AddLabForm competitionId={competitionId} availableAdmins={availableAdmins} />
          </div>

          {(!labs || labs.length === 0) ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-6 p-8">
              <EmptyStateIcon name="lab" />
              <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                No Labs Added Yet
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Add participating computer labs to this competition and assign an administrator to each one.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Lab Name</th>
                    <th className="px-6 py-3.5">Assigned Admin</th>
                    <th className="px-6 py-3.5">Upload Status</th>
                    <th className="px-6 py-3.5">Submitted File</th>
                    <th className="px-6 py-3.5">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {labs.map((lab) => {
                    const latestUpload = latestUploadByLab.get(lab.lab_id);
                    const uploadStatus = latestUpload ? latestUpload.status : 'AWAITING_UPLOAD';

                    let statusBadgeClass = 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
                    if (uploadStatus === 'APPROVED') {
                      statusBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                    } else if (uploadStatus === 'PENDING_APPROVAL') {
                      statusBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                    } else if (uploadStatus === 'REJECTED') {
                      statusBadgeClass = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
                    }

                    return (
                      <tr key={lab.lab_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                          {lab.lab_name}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {lab.users?.name || 'Unknown'}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                            {lab.users?.email}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${statusBadgeClass}`}
                          >
                            {uploadStatus.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                          {latestUpload?.file_name || '—'}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {latestUpload?.record_count ?? '—'}
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
