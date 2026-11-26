'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { syncContestSetFromHackerRank } from '@/app/upload/actions';

interface SyncSetClientProps {
  setId: string;
  defaultSlug: string;
  hasSavedCookie?: boolean;
}

const AUTO_SYNC_INTERVAL_MS = 10_000;

export default function SyncSetClient({ setId, defaultSlug, hasSavedCookie = false }: SyncSetClientProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(defaultSlug);
  const [cookie, setCookie] = useState('');
  const [cookieSaved, setCookieSaved] = useState(hasSavedCookie);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const autoSyncRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugRef = useRef(slug);
  const cookieRef = useRef(cookie);

  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    cookieRef.current = cookie;
  }, [cookie]);

  useEffect(() => {
    return () => {
      autoSyncRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function runSyncCycle() {
    if (!autoSyncRef.current) return;

    setIsSyncingNow(true);
    const activeCookie = cookieRef.current;
    const res = await syncContestSetFromHackerRank(
      setId,
      slugRef.current,
      activeCookie || undefined,
    );
    setIsSyncingNow(false);

    if (!autoSyncRef.current) return;

    if (res.error) {
      setMessage({ text: res.error, type: 'error' });
    } else {
      if (activeCookie.trim()) {
        setCookieSaved(true);
        setCookie('');
        cookieRef.current = '';
      }
      setSyncCount((c) => c + 1);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setMessage({
        text: res.unchanged
          ? `Up to date — ${res.recordsCount} participants (no new changes on HackerRank).`
          : `Synced ${res.recordsCount} participants from HackerRank.${res.warningsCount ? ` (${res.warningsCount} warning(s))` : ''}`,
        type: 'success',
      });
      router.refresh();
    }

    if (autoSyncRef.current) {
      timerRef.current = setTimeout(() => {
        void runSyncCycle();
      }, AUTO_SYNC_INTERVAL_MS);
    }
  }

  function handleToggleAutoSync(e: React.FormEvent) {
    e.preventDefault();

    if (autoSyncRef.current) {
      autoSyncRef.current = false;
      setIsAutoSyncing(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    setMessage(null);
    autoSyncRef.current = true;
    setIsAutoSyncing(true);
    void runSyncCycle();
  }

  return (
    <form onSubmit={handleToggleAutoSync} className="space-y-4">
      {isAutoSyncing && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-semibold">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Auto Sync active {isSyncingNow ? '— syncing now...' : '— syncing every 10s until stopped'}
            </span>
          </div>
          <span className="font-mono text-[11px]">
            Cycles: {syncCount}{lastSyncedAt ? ` · Last: ${lastSyncedAt}` : ''}
          </span>
        </div>
      )}

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
          Enter the slug from hackerrank.com/contests/[slug] or paste the full contest URL
        </p>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={isAutoSyncing}
          required
          className="mt-1.5 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          disabled={isAutoSyncing}
          className="mt-1.5 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={
            cookieSaved
              ? 'Leave blank to use saved cookie (or paste new value)'
              : 'Paste _hrank_session value (or full cookie string)'
          }
        />
      </div>

      <button
        type="submit"
        className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold text-white transition-colors shadow-sm cursor-pointer ${
          isAutoSyncing
            ? 'bg-rose-600 hover:bg-rose-500'
            : 'bg-indigo-600 hover:bg-indigo-500'
        }`}
      >
        {isAutoSyncing ? 'Stop Auto Sync' : 'Auto Sync'}
      </button>
    </form>
  );
}
