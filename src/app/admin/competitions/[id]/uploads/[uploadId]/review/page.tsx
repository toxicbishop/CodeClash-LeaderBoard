import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import ReviewActionsClient from './ReviewActionsClient';

export const instant = false;

interface PageProps {
  params: Promise<{ id: string; uploadId: string }>;
}

export default async function UploadReviewPage({ params }: PageProps) {
  const { id: competitionId, uploadId } = await params;
  const { profile, supabase } = await requireSuperAdmin();

  const [{ data: upload }, { data: participants }] = await Promise.all([
    supabase
      .from('uploads')
      .select('*, contest_sets(*), competitions(*)')
      .eq('upload_id', uploadId)
      .single(),
    supabase
      .from('participants')
      .select('*, results(*)')
      .eq('upload_id', uploadId)
      .order('participant_name', { ascending: true })
      .limit(100),
  ]);

  if (!upload) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/competitions" adminName={profile.name} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link
          href={`/admin/competitions/${competitionId}`}
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1"
        >
          <span>← Back to Competition Overview</span>
        </Link>

        {/* Upload summary header */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Submission Review
                </span>
                <span className="text-xs text-zinc-400 font-mono">v{upload.upload_version}</span>
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {upload.contest_sets?.set_name} ({upload.contest_sets?.set_code})
              </h1>
              <p className="text-xs font-mono text-zinc-500 mt-1">
                Slug: {upload.hackerrank_slug} · Total Records: {upload.record_count ?? 0}
              </p>
            </div>

            <ReviewActionsClient
              uploadId={upload.upload_id}
              competitionId={competitionId}
              currentStatus={upload.status}
            />
          </div>

          {/* Collisions Warning if present */}
          {upload.collision_flags && upload.collision_flags.length > 0 && (
            <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold">{upload.collision_flags.length} Cross-Set Participant Collisions:</span>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                These usernames appear in more than one contest set. Please verify before approving.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {upload.collision_flags.map((c: { external_id: string; conflicting_set_name: string }, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-amber-500/20 text-[11px] font-mono border border-amber-500/30"
                  >
                    {c.external_id} ({c.conflicting_set_name})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Participants & Scores Table */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-4">
            Staged Participants & Raw Scores ({participants?.length ?? 0})
          </h2>

          {(!participants || participants.length === 0) ? (
            <p className="text-xs text-zinc-500">No participants recorded in this sync.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 uppercase text-zinc-500 font-semibold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Hacker Username</th>
                    <th className="px-4 py-3">Total Score</th>
                    <th className="px-4 py-3">Penalty / Time</th>
                    <th className="px-4 py-3">Collision Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {participants.map((p) => {
                    const res = (p.results as unknown as Array<{
                      total_score: number;
                      penalty: number | null;
                    }>)?.[0];
                    return (
                      <tr key={p.participant_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="px-4 py-3 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          {p.external_id}
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                          {res?.total_score ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                          {res?.penalty ?? '—'}s
                        </td>
                        <td className="px-4 py-3">
                          {p.has_collision ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              COLLISION
                            </span>
                          ) : (
                            <span className="text-zinc-400">Clean</span>
                          )}
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
