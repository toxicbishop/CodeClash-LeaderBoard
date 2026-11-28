'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getContestSetSyncStatus,
  syncContestSetFromHackerRank,
} from '@/app/upload/actions';
import type { AutoSyncStatus } from '@/types/database';

interface SyncSetClientProps {
  setId: string;
  defaultSlug: string;
  defaultInchargeName: string;
  initialAutoSyncStatus: AutoSyncStatus;
  initialRejectionReason?: string | null;
  hasSavedCookie?: boolean;
}

const AUTO_SYNC_INTERVAL_MS = 5_000;
const APPROVAL_POLL_INTERVAL_MS = 5_000;

export default function SyncSetClient({
  setId,
  defaultSlug,
  defaultInchargeName,
  initialAutoSyncStatus,
  initialRejectionReason = null,
  hasSavedCookie = false,
}: SyncSetClientProps) {
  const router = useRouter();
  const [inchargeName, setInchargeName] = useState(defaultInchargeName);
  const [slug, setSlug] = useState(defaultSlug);
  const [cookie, setCookie] = useState('');
  const [cookieSaved, setCookieSaved] = useState(hasSavedCookie);

  const [autoSyncStatus, setAutoSyncStatus] = useState<AutoSyncStatus>(initialAutoSyncStatus);
  const [rejectionReason, setRejectionReason] = useState<string | null>(initialRejectionReason);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(initialAutoSyncStatus === 'APPROVED');
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const autoSyncRef = useRef(initialAutoSyncStatus === 'APPROVED');
  const waitingApprovalRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSyncCycleRef = useRef<() => Promise<void>>(async () => {});

  const slugRef = useRef(slug);
  const cookieRef = useRef(cookie);
  const inchargeNameRef = useRef(inchargeName);

  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    cookieRef.current = cookie;
  }, [cookie]);

  useEffect(() => {
    inchargeNameRef.current = inchargeName;
  }, [inchargeName]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSyncCycle = useCallback(async () => {
    if (!autoSyncRef.current) return;

    setIsSyncingNow(true);
    const activeCookie = cookieRef.current;
    const res = await syncContestSetFromHackerRank(
      setId,
      slugRef.current,
      activeCookie || undefined,
      inchargeNameRef.current,
    );
    setIsSyncingNow(false);

    if (!autoSyncRef.current) return;

    if (res.rejected || res.autoSyncStatus === 'REJECTED') {
      autoSyncRef.current = false;
      setIsAutoSyncing(false);
      setAutoSyncStatus('REJECTED');
      setRejectionReason(res.error ?? 'Auto-sync was cancelled by the Super Admin.');
      setMessage({
        text: res.error ?? 'Auto-sync was cancelled by the Super Admin.',
        type: 'error',
      });
      router.refresh();
      return;
    }

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

      if (res.autoSyncStatus === 'PENDING' || res.pendingApproval) {
        autoSyncRef.current = false;
        setIsAutoSyncing(false);
        setAutoSyncStatus('PENDING');
        waitingApprovalRef.current = true;
        setIsWaitingApproval(true);
        setMessage({
          text: `Synced ${res.recordsCount} participants — waiting for one-time Super Admin approval.`,
          type: 'info',
        });
        router.refresh();
        return;
      }

      setMessage({
        text: res.unchanged
          ? `Up to date — ${res.recordsCount} participants (live on leaderboard).`
          : `Live Auto-Sync updated ${res.recordsCount} participants straight to the leaderboard!`,
        type: 'success',
      });
      router.refresh();
    }

    if (autoSyncRef.current) {
      timerRef.current = setTimeout(() => {
        void runSyncCycleRef.current();
      }, AUTO_SYNC_INTERVAL_MS);
    }
  }, [router, setId]);

  useEffect(() => {
    runSyncCycleRef.current = runSyncCycle;
  }, [runSyncCycle]);

  // Auto-start sync loop on mount if already approved by Super Admin
  useEffect(() => {
    if (initialAutoSyncStatus === 'APPROVED') {
      autoSyncRef.current = true;
      void runSyncCycle();
    }
    return () => {
      autoSyncRef.current = false;
      waitingApprovalRef.current = false;
      clearTimer();
    };
  }, [clearTimer, initialAutoSyncStatus, runSyncCycle]);

  // Poll every 5s while waiting for one-time Super Admin approval; auto-start loop once approved
  useEffect(() => {
    if (!isWaitingApproval || autoSyncStatus !== 'PENDING') return;
    waitingApprovalRef.current = true;

    const poll = setInterval(async () => {
      if (!waitingApprovalRef.current) return;
      const statusRes = await getContestSetSyncStatus(setId);
      if (!waitingApprovalRef.current) return;

      if (statusRes.autoSyncStatus === 'APPROVED') {
        waitingApprovalRef.current = false;
        setIsWaitingApproval(false);
        setAutoSyncStatus('APPROVED');
        setRejectionReason(null);
        autoSyncRef.current = true;
        setIsAutoSyncing(true);
        setMessage({
          text: 'Super Admin approved! Live Auto-Sync is now running automatically.',
          type: 'success',
        });
        router.refresh();
        void runSyncCycle();
      } else if (statusRes.autoSyncStatus === 'REJECTED') {
        waitingApprovalRef.current = false;
        setIsWaitingApproval(false);
        setAutoSyncStatus('REJECTED');
        setRejectionReason(statusRes.rejectionReason ?? 'Sync request was rejected by the Super Admin.');
        setMessage({
          text: statusRes.rejectionReason ?? 'Sync request was rejected by the Super Admin.',
          type: 'error',
        });
        router.refresh();
      }
    }, APPROVAL_POLL_INTERVAL_MS);

    return () => {
      waitingApprovalRef.current = false;
      clearInterval(poll);
    };
  }, [autoSyncStatus, isWaitingApproval, router, runSyncCycle, setId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Stop active auto-sync if currently running
    if (autoSyncRef.current) {
      autoSyncRef.current = false;
      setIsAutoSyncing(false);
      clearTimer();
      return;
    }

    if (!inchargeName.trim()) {
      setMessage({ text: 'Please enter the Lab In-Charge Name.', type: 'error' });
      return;
    }

    setMessage(null);
    setRejectionReason(null);
    setIsSyncingNow(true);

    const activeCookie = cookie.trim();
    const res = await syncContestSetFromHackerRank(
      setId,
      slug,
      activeCookie || undefined,
      inchargeName,
      { isRequest: true },
    );
    setIsSyncingNow(false);

    if (res.error) {
      setMessage({ text: res.error, type: 'error' });
      return;
    }

    if (activeCookie) {
      setCookieSaved(true);
      setCookie('');
      cookieRef.current = '';
    }

    setSyncCount((c) => c + 1);
    setLastSyncedAt(new Date().toLocaleTimeString());

    if (res.autoSyncStatus === 'APPROVED') {
      setAutoSyncStatus('APPROVED');
      setIsWaitingApproval(false);
      autoSyncRef.current = true;
      setIsAutoSyncing(true);
      setMessage({
        text: `Synced ${res.recordsCount} participants — Live Auto-Sync is active.`,
        type: 'success',
      });
      router.refresh();
      timerRef.current = setTimeout(() => {
        void runSyncCycle();
      }, AUTO_SYNC_INTERVAL_MS);
    } else {
      setAutoSyncStatus('PENDING');
      setIsWaitingApproval(true);
      setMessage({
        text: `Approval request sent (${res.recordsCount} participants verified). Auto-sync will start automatically once Super Admin approves.`,
        type: 'info',
      });
      router.refresh();
    }
  }

  const inputsLocked = isAutoSyncing || isWaitingApproval;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {autoSyncStatus === 'REJECTED' && rejectionReason && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-400">
          <span className="font-bold">Cancelled / Rejected by Super Admin:</span> {rejectionReason}
          <span className="block mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
            Update your details below if needed and click Re-send Approval Request.
          </span>
        </div>
      )}

      {isWaitingApproval && autoSyncStatus === 'PENDING' && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2 font-semibold">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Waiting for one-time Super Admin approval — Auto-Sync starts automatically once approved.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              waitingApprovalRef.current = false;
              setIsWaitingApproval(false);
            }}
            className="text-[11px] underline hover:no-underline cursor-pointer"
          >
            Edit details
          </button>
        </div>
      )}

      {isAutoSyncing && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-semibold">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Live Auto-Sync active {isSyncingNow ? '— syncing now...' : '— syncing to leaderboard every 5s'}
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
              : message.type === 'info'
              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
              : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Lab In-Charge Name
        </label>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Shown to the Super Admin on the one-time approval request so they know who is syncing this lab.
        </p>
        <input
          type="text"
          value={inchargeName}
          onChange={(e) => setInchargeName(e.target.value)}
          disabled={inputsLocked}
          required
          maxLength={100}
          className="mt-1.5 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. Prof. Rajesh Kumar"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          HackerRank Contest Slug or URL
        </label>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Enter the contest slug or paste the HackerRank contest URL
        </p>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={inputsLocked}
          required
          className="mt-1.5 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter Slug or URL"
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
          disabled={inputsLocked}
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
        disabled={isSyncingNow && !isAutoSyncing}
        className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold text-white transition-colors shadow-sm cursor-pointer disabled:opacity-50 ${
          isAutoSyncing
            ? 'bg-rose-600 hover:bg-rose-500'
            : 'bg-indigo-600 hover:bg-indigo-500'
        }`}
      >
        {isAutoSyncing
          ? 'Stop Auto-Sync'
          : isSyncingNow
          ? 'Verifying with HackerRank...'
          : autoSyncStatus === 'REJECTED'
          ? 'Re-send Approval Request & Auto-Sync'
          : autoSyncStatus === 'APPROVED'
          ? 'Start Live Auto-Sync'
          : 'Send Approval Request & Auto-Sync'}
      </button>
    </form>
  );
}
