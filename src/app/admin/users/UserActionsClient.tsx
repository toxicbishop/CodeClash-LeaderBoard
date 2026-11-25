'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteUser, toggleUserStatus } from '@/app/admin/actions';

interface UserActionsClientProps {
  userId: string;
  userName: string;
  userRole: string;
  accountStatus: string;
}

export function UserActionsClient({
  userId,
  userName,
  userRole,
  accountStatus,
}: UserActionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isActive = accountStatus === 'ACTIVE';

  function handleToggle() {
    setErrorMsg(null);
    const nextStatus = isActive ? 'INACTIVE' : 'ACTIVE';
    startTransition(async () => {
      const res = await toggleUserStatus(userId, nextStatus);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Permanently delete ${userName} (${userRole})? They will immediately lose access and cannot sign in again.`,
      )
    ) {
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      const res = await deleteUser(userId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleToggle}
          className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isPending ? '...' : 'Delete'}
        </button>
      </div>
      {errorMsg && (
        <p className="text-[11px] text-red-500 max-w-xs text-right">{errorMsg}</p>
      )}
    </div>
  );
}
