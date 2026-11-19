import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/login/actions';

export const instant = false;

export default async function LabAdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'LAB_ADMIN' && profile?.role !== 'COMPETITION_ADMIN') {
    redirect('/login');
  }

  // Fetch lab assigned to this admin (with parent competition info)
  const { data: assignedLab } = await supabase
    .from('labs')
    .select('*, competitions(*)')
    .eq('assigned_admin_id', user.id)
    .maybeSingle();

  // Fetch latest upload if lab exists
  let latestUpload = null;
  if (assignedLab) {
    const { data: uploadData } = await supabase
      .from('uploads')
      .select('*')
      .eq('lab_id', assignedLab.lab_id)
      .order('upload_version', { ascending: false })
      .limit(1)
      .maybeSingle();
    latestUpload = uploadData;
  }

  const uploadStatus = latestUpload?.status || 'AWAITING_UPLOAD';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Lab Admin Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Lab Portal
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                Code Clash 2026
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                {profile?.name} ({profile?.email})
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!assignedLab ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
            <span className="text-4xl">🔬</span>
            <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">
              No Lab Assigned Yet
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Your account is active as a Lab Administrator, but the Competition Administrator has not yet mapped your account to a participating computer laboratory.
            </p>
            <p className="mt-4 text-xs font-mono text-zinc-400">
              User ID: {user.id}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Lab & Competition Profile Card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Your Assigned Lab
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                    {assignedLab.lab_name}
                  </h1>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    Participating in{' '}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {assignedLab.competitions?.competition_name}
                    </span>
                  </p>
                </div>

                <div className="flex flex-col sm:items-end text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                  <div>
                    Contest Date:{' '}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {new Date(assignedLab.competitions?.contest_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    Upload Deadline:{' '}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {new Date(assignedLab.competitions?.upload_deadline).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 gap-4">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Leaderboard Submission Status
                  </span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${
                        uploadStatus === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : uploadStatus === 'PENDING_APPROVAL'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : uploadStatus === 'REJECTED'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                          : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                      }`}
                    >
                      {uploadStatus.replace('_', ' ')}
                    </span>
                    {latestUpload && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        v{latestUpload.upload_version} ({latestUpload.file_name})
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <button
                    disabled
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
                    title="Upload engine unlocks in Phase 2"
                  >
                    Upload Leaderboard (Phase 2)
                  </button>
                </div>
              </div>

              {/* Rejection Alert if rejected */}
              {latestUpload?.status === 'REJECTED' && latestUpload?.rejection_reason && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                  <span className="font-bold">Correction Feedback from Admin:</span>{' '}
                  {latestUpload.rejection_reason}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
