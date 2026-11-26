'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { assignLabAdminNameAction, type ActionResponse } from '@/app/admin/actions';

export interface LabAdminAccount {
  user_id: string;
  name: string;
  email: string;
  account_status: string;
}

const initialState: ActionResponse = { error: null };

export function AssignLabAdminCard({ labAdmins }: { labAdmins: LabAdminAccount[] }) {
  const [state, formAction, isPending] = useActionState(assignLabAdminNameAction, initialState);
  const [selectedUserId, setSelectedUserId] = useState(labAdmins[0]?.user_id ?? '');
  const [labAdminName, setLabAdminName] = useState(labAdmins[0]?.name ?? '');

  function handleAccountChange(nextId: string) {
    setSelectedUserId(nextId);
    const match = labAdmins.find((a) => a.user_id === nextId);
    if (match) {
      setLabAdminName(match.name);
    }
  }

  const assignedData = state?.success
    ? (state.data as { name?: string } | undefined)
    : undefined;

  return (
    <div className="mt-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Assign Lab Admin Name
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Set or update the display name for a Master Lab Admin account.
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          + New Lab Admin Account
        </Link>
      </div>

      {labAdmins.length === 0 ? (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 text-xs text-zinc-600 dark:text-zinc-300">
          <span>No Master Lab Admin accounts exist yet. Provision one to assign a name.</span>
          <Link
            href="/admin/users/new"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors self-start sm:self-auto"
          >
            Provision Lab Admin
          </Link>
        </div>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          {state?.error && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-600 dark:text-red-400"
            >
              {state.error}
            </div>
          )}

          {state?.success && (
            <div
              role="status"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              Assigned Lab Admin name: <span className="font-semibold">{assignedData?.name}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label
                htmlFor="assign-lab-admin-user"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Lab Admin Account
              </label>
              <select
                id="assign-lab-admin-user"
                name="user_id"
                value={selectedUserId}
                onChange={(e) => handleAccountChange(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {labAdmins.map((admin) => (
                  <option key={admin.user_id} value={admin.user_id}>
                    {admin.name} ({admin.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="assign-lab-admin-name"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Lab Admin Name
              </label>
              <input
                id="assign-lab-admin-name"
                name="lab_admin_name"
                type="text"
                required
                maxLength={100}
                value={labAdminName}
                onChange={(e) => setLabAdminName(e.target.value)}
                placeholder="Enter Lab Admin Name"
                className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {isPending ? 'Saving...' : 'Assign Name'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
