'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createLab, type ActionResponse } from '../../actions';
import type { User } from '@/types/database';

interface AddLabFormProps {
  competitionId: string;
  availableAdmins: User[];
}

const initialState: ActionResponse = {};

export function AddLabForm({ competitionId, availableAdmins }: AddLabFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createLab, initialState);

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
      >
        + Add Lab
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xl">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Add Participating Lab
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData) => {
                await formAction(formData);
              }}
              className="mt-6 space-y-4"
            >
              <input type="hidden" name="competition_id" value={competitionId} />

              {state?.error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-600 dark:text-red-400">
                  {state.error}
                </div>
              )}

              {state?.success && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ Lab added successfully!
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Lab Name *
                </label>
                <input
                  name="lab_name"
                  type="text"
                  required
                  placeholder="e.g. Lab 1 - Turing Hall"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Assigned Lab Administrator *
                </label>
                {availableAdmins.length === 0 ? (
                  <div className="mt-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                    No Lab Admins available.{' '}
                    <Link
                      href="/admin/users"
                      className="underline font-semibold hover:text-amber-700"
                    >
                      Provision a Lab Admin first →
                    </Link>
                  </div>
                ) : (
                  <select
                    name="assigned_admin_id"
                    required
                    className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select an administrator...</option>
                    {availableAdmins.map((adm) => (
                      <option key={adm.user_id} value={adm.user_id}>
                        {adm.name} ({adm.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || availableAdmins.length === 0}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Adding...' : 'Add Lab'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
