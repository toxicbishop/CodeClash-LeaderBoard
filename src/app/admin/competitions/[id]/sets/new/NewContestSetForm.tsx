'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createContestSetAction, type ActionResponse } from '@/app/admin/actions';

export interface ExistingSetSummary {
  set_id: string;
  set_name: string;
  set_code: string;
  hackerrank_slug: string;
}

const initialState: ActionResponse = { error: null };

function suggestNextSetCode(existingSets: ExistingSetSummary[]): string {
  const taken = new Set(existingSets.map((s) => s.set_code.trim().toLowerCase()));
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i); // A..Z
    const candidate = `set${letter}`;
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return '';
}

export function NewContestSetForm({
  competitionId,
  existingSets,
}: {
  competitionId: string;
  existingSets: ExistingSetSummary[];
}) {
  const [state, formAction, isPending] = useActionState(createContestSetAction, initialState);
  const suggestedCode = suggestNextSetCode(existingSets);
  const suggestedLetter = suggestedCode.replace(/^set/i, '');

  const [setName, setSetName] = useState(suggestedLetter ? `Set ${suggestedLetter}` : '');
  const [setCode, setSetCode] = useState(suggestedCode);
  const [hackerrankSlug, setHackerrankSlug] = useState('');
  const [sessionCookie, setSessionCookie] = useState('');

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="competition_id" value={competitionId} />

      {existingSets.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs text-zinc-600 dark:text-zinc-300">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
            Existing sets in this competition ({existingSets.length}):
          </p>
          <ul className="mt-1.5 space-y-1">
            {existingSets.map((s) => (
              <li key={s.set_id} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span>
                  <strong className="font-sans text-zinc-800 dark:text-zinc-100">{s.set_name}</strong>{' '}
                  ({s.set_code})
                </span>
                <span className="text-zinc-500 truncate max-w-[220px]">{s.hackerrank_slug}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-zinc-500">
            Each set requires a unique Set Code. To replace or remove an existing set, go back to the competition page.
          </p>
        </div>
      )}

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
          Set Name
        </label>
        <input
          name="set_name"
          type="text"
          required
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Set A"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Set Code (Short Identifier)
        </label>
        <input
          name="set_code"
          type="text"
          required
          maxLength={20}
          value={setCode}
          onChange={(e) => setSetCode(e.target.value)}
          className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="setA"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          HackerRank Contest Slug or URL
        </label>
        <input
          name="hackerrank_slug"
          type="text"
          required
          value={hackerrankSlug}
          onChange={(e) => setHackerrankSlug(e.target.value)}
          className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="codeclash-2026-setA or https://www.hackerrank.com/contests/..."
        />
        <p className="mt-1 text-[11px] text-zinc-500">
          Enter the slug (letters, numbers, hyphens, underscores) or paste the full hackerrank.com/contests/[slug] URL.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          HackerRank Session Cookie (Optional)
        </label>
        <input
          name="hr_session_cookie"
          type="password"
          value={sessionCookie}
          onChange={(e) => setSessionCookie(e.target.value)}
          className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Paste _hrank_session value so lab admins don't need to"
        />
        <p className="mt-1 text-[11px] text-zinc-500">
          Encrypted with AES-256-GCM before storing. Leave blank if you prefer entering it during sync.
        </p>
      </div>

      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
        <Link
          href={`/admin/competitions/${competitionId}`}
          className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
        >
          {isPending ? 'Adding...' : 'Add Set'}
        </button>
      </div>
    </form>
  );
}
