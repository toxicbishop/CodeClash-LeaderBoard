'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteContestSet } from '@/app/admin/actions';

interface DeleteSetButtonProps {
  setId: string;
  setName: string;
  setCode: string;
}

export function DeleteSetButton({ setId, setName, setCode }: DeleteSetButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleDelete() {
    if (
      !confirm(
        `Delete contest set "${setName}" (${setCode})? This removes all synced uploads and participant data for this set.`,
      )
    ) {
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await deleteContestSet(setId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleDelete}
        className="px-2 py-1 text-[11px] font-semibold rounded border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
      {errorMsg && <span className="text-[11px] text-red-500 max-w-xs">{errorMsg}</span>}
    </span>
  );
}
