import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMasterLabAdmin } from '@/lib/auth/guards';
import SyncSetClient from './SyncSetClient';

export const instant = false;

interface PageProps {
  params: Promise<{ setId: string }>;
}

export default async function ContestSetSyncDetailPage({ params }: PageProps) {
  const { setId } = await params;
  const { supabase } = await requireMasterLabAdmin();

  const { data: set } = await supabase
    .from('contest_sets')
    .select('*, competitions(*)')
    .eq('set_id', setId)
    .single();

  if (!set) notFound();

  // Fetch recent uploads for this set
  const { data: uploads } = await supabase
    .from('uploads')
    .select('*')
    .eq('set_id', setId)
    .order('upload_version', { ascending: false });

  const latest = uploads?.[0];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
          <Link
            href="/upload"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1"
          >
            <span>← Back to Upload Portal</span>
          </Link>
          <span className="text-xs font-mono text-zinc-400">
            {set.competitions?.competition_name} / {set.set_name}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Contest Set Ingestion
              </span>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {set.set_name} ({set.set_code})
              </h1>
              <p className="text-xs text-zinc-500 mt-1">
                Target HackerRank Contest Slug: <span className="font-mono text-zinc-700 dark:text-zinc-300">{set.hackerrank_slug}</span>
              </p>
            </div>
            {latest && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${
                  latest.status === 'APPROVED'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : latest.status === 'PENDING_APPROVAL'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : latest.status === 'REJECTED'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                }`}
              >
                {latest.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-4">
              Trigger HackerRank Sync
            </h2>
            <SyncSetClient setId={set.set_id} defaultSlug={set.hackerrank_slug} />
          </div>
        </div>

        {/* Sync History & Validation Report */}
        {latest && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Latest Sync Report (v{latest.upload_version})
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-zinc-500">Participants Staged:</span>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {latest.record_count ?? 0}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Synced At:</span>
                <p className="font-medium text-zinc-900 dark:text-zinc-200 mt-0.5">
                  {new Date(latest.uploaded_at).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Validation:</span>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {latest.validation_errors?.length ? `${latest.validation_errors.length} Issues` : 'Passed Clean'}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Cross-Set Collisions:</span>
                <p className={`font-semibold mt-0.5 ${latest.collision_flags?.length ? 'text-amber-600' : 'text-zinc-400'}`}>
                  {latest.collision_flags?.length ? `${latest.collision_flags.length} Flagged` : 'None'}
                </p>
              </div>
            </div>

            {/* Rejection Alert if rejected */}
            {latest.status === 'REJECTED' && latest.rejection_reason && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                <span className="font-bold">Rejection Feedback from Super Admin:</span>{' '}
                {latest.rejection_reason}
              </div>
            )}

            {/* Collision Flags Warning */}
            {latest.collision_flags && latest.collision_flags.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <span className="font-bold">⚠ Cross-Set Participant Collisions Detected:</span>
                <ul className="list-disc pl-5 space-y-0.5 mt-1">
                  {latest.collision_flags.map((c: { external_id: string; conflicting_set_name: string }, i: number) => (
                    <li key={i}>
                      User <strong className="font-mono">{c.external_id}</strong> also appears in{' '}
                      <strong>{c.conflicting_set_name}</strong>.
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
