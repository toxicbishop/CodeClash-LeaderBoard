'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createContestSetAction, type ActionResponse } from '@/app/admin/actions';

export interface ExistingSetSummary {
  set_id: string;
  round_number?: number;
  set_name: string;
  set_code: string;
  hackerrank_slug: string;
}

const initialState: ActionResponse = { error: null };

function suggestNextSetCode(existingSets: ExistingSetSummary[]): string {
  const taken = new Set(
    existingSets
      .filter((s) => (s.round_number ?? 1) === 1)
      .map((s) => s.set_code.trim().toLowerCase()),
  );
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
  const [roundsCount, setRoundsCount] = useState(1);
  const [roundSlugs, setRoundSlugs] = useState<string[]>(['']);
  const [sessionCookie, setSessionCookie] = useState('');

  function handleRoundsChange(nextCount: number) {
    const clamped = Math.max(1, Math.min(10, Number.isFinite(nextCount) ? nextCount : 1));
    setRoundsCount(clamped);
    setRoundSlugs((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push('');
      return next.slice(0, clamped);
    });
  }

  function updateRoundSlug(index: number, value: string) {
    setRoundSlugs((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="competition_id" value={competitionId} />
      <input type="hidden" name="rounds_count" value={roundsCount} />

      {existingSets.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs text-zinc-600 dark:text-zinc-300">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
            Existing sets in this competition ({existingSets.length}):
          </p>
          <ul className="mt-1.5 space-y-1">
            {existingSets.map((s) => (
              <li key={s.set_id} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-sans text-[10px] font-semibold">
                    R{s.round_number ?? 1}
                  </span>
                  <strong className="font-sans text-zinc-800 dark:text-zinc-100">{s.set_name}</strong>{' '}
                  ({s.set_code})
                </span>
                <span className="text-zinc-500 truncate max-w-[220px]">{s.hackerrank_slug}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-zinc-500">
            You can reuse the same Set Name and Set Code across different rounds (e.g. Round 1, Round 2, Round 3).
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Number of Rounds
          </label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleRoundsChange(n)}
                className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                  roundsCount === n
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

      </div>

      <div className="space-y-3 pt-1">
        {roundSlugs.map((slugValue, idx) => {
          const roundNum = idx + 1;
          return (
            <div key={roundNum}>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {roundsCount > 1
                  ? `Round ${roundNum} — HackerRank Contest Slug or URL`
                  : 'HackerRank Contest Slug or URL'}
              </label>
              <input
                name={`round_slug_${roundNum}`}
                type="text"
                required
                value={slugValue}
                onChange={(e) => updateRoundSlug(idx, e.target.value)}
                className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={`Enter Round ${roundNum} Slug or URL`}
              />
            </div>
          );
        })}
        <p className="text-[11px] text-zinc-500">
          Enter the slug (letters, numbers, hyphens, underscores) or paste the HackerRank contest URL.
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
          placeholder="Paste _hrank_session value (applied to all rounds)"
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
          className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
        >
          {isPending
            ? 'Adding...'
            : roundsCount > 1
            ? `Add Sets (${roundsCount} Rounds)`
            : 'Add Set'}
        </button>
      </div>
    </form>
  );
}
