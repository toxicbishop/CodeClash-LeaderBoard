'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { generateLeaderboard, publishLeaderboard, endLeaderboard } from '@/app/admin/actions';

export interface Snapshot {
  snapshot_id: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  generated_at: string;
  published_at: string | null;
}

interface LeaderboardControlPanelProps {
  competitionId: string;
  competitionSlug: string;
  competitionStatus: string;
  snapshots: Snapshot[];
  hasApprovedUploads: boolean;
}

export function LeaderboardControlPanel({
  competitionId,
  competitionSlug,
  competitionStatus,
  snapshots,
  hasApprovedUploads,
}: LeaderboardControlPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const isLive = competitionStatus === 'PUBLISHED' || snapshots.some((s) => s.status === 'PUBLISHED');

  function handleGenerate() {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await generateLeaderboard(competitionId);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        const data = res?.data as { version?: number } | undefined;
        setSuccessMsg(`Leaderboard snapshot v${data?.version ?? ''} generated and published live!`);
        router.refresh();
      }
    });
  }

  function handlePublish(snapshotId: string, version: number) {
    if (!confirm(`Are you sure you want to officially publish Leaderboard Snapshot v${version} to contestants and projectors?`)) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await publishLeaderboard(snapshotId);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(`Leaderboard snapshot v${version} is now LIVE on the public leaderboard!`);
        router.refresh();
      }
    });
  }

  function handleEndLeaderboard() {
    if (
      !confirm(
        'End the live leaderboard? Public viewers will no longer see it on /leaderboard, and you can adjust sets or publish a new snapshot later.',
      )
    ) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await endLeaderboard(competitionId);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg('Live leaderboard has been ended and taken offline.');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Alert banners */}
      {errorMsg && (
        <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-medium flex justify-between items-center">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-zinc-400 hover:text-zinc-600 text-xs">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-zinc-400 hover:text-zinc-600 text-xs">Dismiss</button>
        </div>
      )}

      {/* Control Actions Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Leaderboard Snapshots & Official Publishing
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Consolidate verified contest sets, resolve ties using approved rules, and release official standings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/leaderboard?comp=${competitionSlug}`}
            target="_blank"
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Public leaderboard &rarr;
          </Link>

          {isLive && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleEndLeaderboard}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors cursor-pointer"
            >
              End leaderboard
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Manual Controls */}
      <details className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-xs">
        <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-300 select-none">
          Manual Snapshot &amp; Tiebreaker Controls
        </summary>
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/competitions/${competitionId}/rules`}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Configure tiebreakers
          </Link>

          <button
            type="button"
            disabled={isPending || !hasApprovedUploads}
            onClick={handleGenerate}
            className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 disabled:opacity-50 transition-colors cursor-pointer"
            title={!hasApprovedUploads ? 'At least one set upload must be APPROVED before generating' : ''}
          >
            {isPending ? 'Processing...' : 'Generate manual snapshot'}
          </button>
        </div>
      </details>

      {/* Snapshots Table */}
      {snapshots.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <p className="text-xs text-zinc-500">
            No snapshots have been generated yet. Approve set uploads and click &quot;Generate manual snapshot&quot; above.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold uppercase text-zinc-500 tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Version</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Generated At</th>
                <th className="px-6 py-3.5">Published At</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {snapshots.map((snap) => {
                const isPublished = snap.status === 'PUBLISHED';
                const isDraft = snap.status === 'DRAFT';

                return (
                  <tr key={snap.snapshot_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-6 py-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      v{snap.version}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                          isPublished
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : isDraft
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                            : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                        }`}
                      >
                        {snap.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                      {new Date(snap.generated_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                      {snap.published_at ? new Date(snap.published_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <a
                        href={`/api/competitions/${competitionId}/export?snapshotId=${snap.snapshot_id}`}
                        className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        download
                      >
                        ↓ Download CSV
                      </a>

                      {isDraft && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handlePublish(snap.snapshot_id, snap.version)}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Publish Live →
                        </button>
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
  );
}
