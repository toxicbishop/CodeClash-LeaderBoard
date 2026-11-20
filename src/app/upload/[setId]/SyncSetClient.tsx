'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { syncContestSetFromHackerRank } from '@/app/upload/actions';

interface SyncSetClientProps {
  setId: string;
  defaultSlug: string;
}

export default function SyncSetClient({ setId, defaultSlug }: SyncSetClientProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(defaultSlug);
  const [cookie, setCookie] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const res = await syncContestSetFromHackerRank(setId, slug, cookie || undefined);
    setIsLoading(false);

    if (res.error) {
      setMessage({ text: res.error, type: 'error' });
    } else {
      setMessage({
        text: `Successfully synced ${res.recordsCount} participants from HackerRank!`,
        type: 'success',
      });
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSync} className="space-y-4">
      {message && (
        <div
          className={`p-3 text-xs rounded-lg border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          HackerRank Contest Slug
        </label>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          The unique contest identifier from the URL: hackerrank.com/contests/[slug]
        </p>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="mt-1.5 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. codeclash-2026-setA"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Private Contest Session Cookie (Optional)
        </label>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Only required if this contest is invite-only or password-protected. Stored server-side.
        </p>
        <input
          type="password"
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          className="mt-1.5 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="_hr_session=..."
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
      >
        {isLoading ? 'Syncing with HackerRank API...' : '⚡ Trigger Live HackerRank Sync'}
      </button>
    </form>
  );
}
