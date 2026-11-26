'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createCompetitionAction, type ActionResponse } from '@/app/admin/actions';

const initialState: ActionResponse = { error: null };

export function NewCompetitionForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction, isPending] = useActionState(createCompetitionAction, initialState);
  const [competitionName, setCompetitionName] = useState('');
  const [description, setDescription] = useState('');
  const [contestDate, setContestDate] = useState(defaultDate);
  const [topK, setTopK] = useState('10');

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-600 dark:text-red-400"
        >
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Competition Name
        </label>
        <input
          name="competition_name"
          type="text"
          required
          value={competitionName}
          onChange={(e) => setCompetitionName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Code Clash 2026 Finals"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Description (Optional)
        </label>
        <textarea
          name="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Department-wide annual coding showdown across Sets A, B, C, and D."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Contest Date
          </label>
          <input
            name="contest_date"
            type="date"
            required
            value={contestDate}
            onChange={(e) => setContestDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Top-K Qualifier Limit
          </label>
          <input
            name="top_k"
            type="number"
            min="1"
            required
            value={topK}
            onChange={(e) => setTopK(e.target.value)}
            className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
        <Link
          href="/admin/competitions"
          className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
        >
          {isPending ? 'Creating...' : 'Create Competition'}
        </button>
      </div>
    </form>
  );
}
