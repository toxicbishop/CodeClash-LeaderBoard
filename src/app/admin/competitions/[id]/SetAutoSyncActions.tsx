'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveContestSetAutoSync,
  rejectContestSetAutoSync,
} from '@/app/admin/actions';
import type { AutoSyncStatus } from '@/types/database';

interface SetAutoSyncActionsProps {
  setId: string;
  setName: string;
  autoSyncStatus: AutoSyncStatus;
  hasPendingUpload: boolean;
}

export function SetAutoSyncActions({
  setId,
  setName,
  autoSyncStatus,
  hasPendingUpload,
}: SetAutoSyncActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleApprove() {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await approveContestSetAutoSync(setId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleRejectOrCancel() {
    const label = autoSyncStatus === 'APPROVED' ? 'cancel live auto-sync for' : 'reject';
    if (!confirm(`Are you sure you want to ${label} "${setName}"?`)) {
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      const res = await rejectContestSetAutoSync(
        setId,
        autoSyncStatus === 'APPROVED'
          ? 'Auto-sync cancelled by Super Admin.'
          : 'Approval request rejected by Super Admin.',
      );
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex flex-wrap items-center gap-2">
        {autoSyncStatus === 'PENDING' && hasPendingUpload && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={handleApprove}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isPending ? 'Approving...' : 'Approve & Auto-Sync'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleRejectOrCancel}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Reject
            </button>
          </>
        )}

        {autoSyncStatus === 'PENDING' && !hasPendingUpload && (
          <span className="text-[11px] text-zinc-400">Waiting for lab request</span>
        )}

        {autoSyncStatus === 'APPROVED' && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleRejectOrCancel}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isPending ? 'Cancelling...' : 'Cancel Sync'}
          </button>
        )}

        {autoSyncStatus === 'REJECTED' && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleApprove}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isPending ? 'Approving...' : 'Re-approve'}
          </button>
        )}
      </span>
      {errorMsg && <span className="text-[11px] text-red-500 max-w-xs">{errorMsg}</span>}
    </span>
  );
}
