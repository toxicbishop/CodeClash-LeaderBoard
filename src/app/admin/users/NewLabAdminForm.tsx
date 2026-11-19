'use client';

import { useActionState, useState } from 'react';
import { createLabAdmin, type ActionResponse } from '../actions';

const initialState: ActionResponse = {};

export function NewLabAdminForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createLabAdmin, initialState);

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
      >
        + Provision Lab Admin
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xl">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Provision New Lab Admin
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
              {state?.error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-600 dark:text-red-400">
                  {state.error}
                </div>
              )}

              {state?.success && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ Account provisioned successfully!
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Full Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Dr. Alan Turing"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Email Address
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="lab1-admin@university.edu"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Initial Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Must be at least 8 characters. Share this password with the Lab Admin.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
