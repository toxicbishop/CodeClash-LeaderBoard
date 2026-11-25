'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { syncContestSetFromHackerRank } from '@/app/upload/actions';

interface SyncSetClientProps {
  setId: string;
  defaultSlug: string;
  hasSavedCookie?: boolean;
}

export default function SyncSetClient({ setId, defaultSlug, hasSavedCookie = false }: SyncSetClientProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(defaultSlug);
  const [cookie, setCookie] = useState('');
  const [cookieSaved, setCookieSaved] = useState(hasSavedCookie);
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
      if (cookie.trim()) {
        setCookieSaved(true);
        setCookie('');
      }
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
          pattern="[a-zA-Z0-9_-]+"
          title="Slugs may only contain letters, numbers, hyphens, and underscores."
          className="mt-1.5 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. codeclash-2026-setA"
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Private Contest Session Cookie (Optional)
          </label>
          {cookieSaved && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Saved server-side
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {cookieSaved
            ? 'A session cookie is already saved for this set. Leave blank to reuse it, or paste a new one to replace it.'
            : 'Encrypted and saved server-side after a successful sync so future syncs work without re-entering it.'}
        </p>
        <input
          type="password"
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          className="mt-1.5 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={
            cookieSaved
              ? 'Leave blank to use saved cookie (or paste new value)'
              : 'Paste _hrank_session value (or full cookie string)'
          }
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
      >
        {isLoading ? 'Syncing with HackerRank API...' : 'Trigger HackerRank sync'}
      </button>
    </form>
  );
}
