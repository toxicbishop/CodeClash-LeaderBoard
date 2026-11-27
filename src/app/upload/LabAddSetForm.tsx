'use client';

import { useActionState, useState } from 'react';
import { upsertLabContestSetAction, type LabSetFormState } from '@/app/upload/actions';

interface ExistingSetMinimal {
  set_code: string;
}

const initialState: LabSetFormState = { error: null };

function suggestNextSetCode(existingSets: ExistingSetMinimal[]): string {
  const taken = new Set(existingSets.map((s) => s.set_code.trim().toLowerCase()));
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    const candidate = `set${letter}`;
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return '';
}

export function LabAddSetForm({
  competitionId,
  defaultInchargeName,
  existingSets,
}: {
  competitionId: string;
  defaultInchargeName: string;
  existingSets: ExistingSetMinimal[];
}) {
  const [isOpen, setIsOpen] = useState(existingSets.length === 0);
  const [state, formAction, isPending] = useActionState(upsertLabContestSetAction, initialState);

  const suggestedCode = suggestNextSetCode(existingSets);
  const suggestedLetter = suggestedCode.replace(/^set/i, '');

  const [inchargeName, setInchargeName] = useState(defaultInchargeName);
  const [setName, setSetName] = useState(suggestedLetter ? `Set ${suggestedLetter}` : '');
  const [setCode, setSetCode] = useState(suggestedCode);
  const [slug, setSlug] = useState('');
  const [cookie, setCookie] = useState('');

  if (!isOpen) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm cursor-pointer"
        >
          + Add Lab / Contest Set
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Add Lab / Contest Set
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Enter your name, HackerRank contest slug, and session cookie to request one-time Super Admin approval.
          </p>
        </div>
        {existingSets.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          >
            Close
          </button>
        )}
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="competition_id" value={competitionId} />

        {state?.error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-600 dark:text-red-400"
          >
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Lab In-Charge Name
            </label>
            <input
              name="lab_incharge_name"
              type="text"
              required
              maxLength={100}
              value={inchargeName}
              onChange={(e) => setInchargeName(e.target.value)}
              placeholder="Your full name"
              className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Set / Lab Name
            </label>
            <input
              name="set_name"
              type="text"
              required
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="Set A"
              className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Set Code
            </label>
            <input
              name="set_code"
              type="text"
              required
              maxLength={20}
              value={setCode}
              onChange={(e) => setSetCode(e.target.value)}
              placeholder="setA"
              className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              HackerRank Contest Slug or URL
            </label>
            <input
              name="hackerrank_slug"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Enter Slug or URL"
              className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              HackerRank Session Cookie (Optional)
            </label>
            <input
              name="hr_session_cookie"
              type="password"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="Paste _hrank_session value for private contests"
              className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          >
            {isPending ? 'Saving...' : 'Continue to Sync →'}
          </button>
        </div>
      </form>
    </div>
  );
}
