'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCompetition } from '@/app/admin/actions';

interface DeleteCompetitionButtonProps {
  competitionId: string;
  competitionName: string;
  redirectToList?: boolean;
}

export function DeleteCompetitionButton({
  competitionId,
  competitionName,
  redirectToList = false,
}: DeleteCompetitionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleDelete() {
    if (
      !confirm(
        `Delete competition "${competitionName}"? This permanently removes all its contest sets, synced uploads, participant results, and leaderboard snapshots regardless of approval or publish status.`,
      )
    ) {
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await deleteCompetition(competitionId);
      if (res.error) {
        setErrorMsg(res.error);
      } else if (redirectToList) {
        router.push('/admin/competitions');
        router.refresh();
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleDelete}
        className="px-2.5 py-1 text-xs font-semibold rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
      {errorMsg && <p className="text-[11px] text-red-500">{errorMsg}</p>}
    </div>
  );
}
