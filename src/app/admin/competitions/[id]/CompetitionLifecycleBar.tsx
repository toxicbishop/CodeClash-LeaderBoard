'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { consolidateLeaderboard, publishLeaderboard } from '@/app/admin/actions';

interface CompetitionLifecycleBarProps {
  competitionId: string;
  slug: string;
  status: string;
  labCount: number;
  submittedCount: number;
  approvedCount: number;
  topK: number;
}

export function CompetitionLifecycleBar({
  competitionId,
  slug,
  status,
  labCount,
  submittedCount,
  approvedCount,
  topK,
}: CompetitionLifecycleBarProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Stepper state computation
  const isSetupDone = labCount > 0;
  const isUploadsDone = labCount > 0 && submittedCount === labCount;
  const isApprovedDone = labCount > 0 && approvedCount === labCount;
  const isConsolidatedDone = status === 'READY_FOR_REVIEW' || status === 'PUBLISHED';
  const isPublishedDone = status === 'PUBLISHED';

  function handleConsolidate() {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('competition_id', competitionId);
      const res = await consolidateLeaderboard({}, fd);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg('Consolidated ranking generated successfully! Review the draft below.');
      }
    });
  }

  function handlePublish() {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('competition_id', competitionId);
      const res = await publishLeaderboard({}, fd);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg('Official leaderboard published successfully! It is now live on the public URL.');
      }
    });
  }

  const steps = [
    { label: '1. Labs Setup', completed: isSetupDone, active: !isUploadsDone },
    { label: '2. Submissions', completed: isUploadsDone, active: isSetupDone && !isApprovedDone },
    { label: '3. Admin Approval', completed: isApprovedDone, active: isUploadsDone && !isConsolidatedDone },
    { label: '4. Consolidation', completed: isConsolidatedDone, active: isApprovedDone && !isPublishedDone },
    { label: '5. Published Live', completed: isPublishedDone, active: isConsolidatedDone },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-6">
      {/* Visual Stepper */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Contest Pipeline Lifecycle
          </span>
          <span className="text-xs font-mono text-zinc-400">
            Labs: {approvedCount}/{labCount} Approved • Top {topK} Cutoff
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition-colors ${
                s.completed
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                  : s.active
                  ? 'border-indigo-500/40 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400'
              }`}
            >
              <span>{s.completed ? '✓' : idx + 1}</span>
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
          <span className="font-bold">Error: </span>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
          <span className="font-bold">Success: </span>
          {successMsg}
        </div>
      )}

      {/* Action Gates */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        {/* State A: Ready to Consolidate */}
        {isApprovedDone && !isConsolidatedDone && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 gap-4">
            <div>
              <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                All Participating Labs Approved
              </h4>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                Merge results across all labs, compute global ranks with tie-breaking, and build the draft Top-{topK} leaderboard.
              </p>
            </div>
            <button
              onClick={handleConsolidate}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors cursor-pointer shrink-0"
            >
              {isPending ? 'Consolidating...' : '⚡ Consolidate & Rank Leaderboard'}
            </button>
          </div>
        )}

        {/* State B: Ready for Review (Draft Snapshot exists) */}
        {status === 'READY_FOR_REVIEW' && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  Draft Leaderboard Ready for Review
                </h4>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-xl">
                Consolidated standings are calculated. Inspect the preview snapshot before publishing the official results to auditorium screens.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <Link
                href={`/leaderboard?comp=${slug}`}
                target="_blank"
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                Preview Draft ↗
              </Link>
              <button
                onClick={handlePublish}
                disabled={isPending}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
              >
                {isPending ? 'Publishing...' : '🚀 Publish Official Leaderboard'}
              </button>
            </div>
          </div>
        )}

        {/* State C: Published (Live) */}
        {status === 'PUBLISHED' && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                  Official Leaderboard Published & Live
                </h4>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                The authoritative leaderboard is active on public displays, lab terminals, and auditorium screens.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleConsolidate}
                disabled={isPending}
                className="px-3 py-2 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Re-run ranking if any updates were made"
              >
                {isPending ? 'Re-consolidating...' : 'Re-consolidate'}
              </button>
              <Link
                href={`/leaderboard?comp=${slug}`}
                target="_blank"
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
              >
                Launch Projector Arena ↗
              </Link>
            </div>
          </div>
        )}

        {/* State D: Still awaiting uploads */}
        {!isApprovedDone && status !== 'READY_FOR_REVIEW' && status !== 'PUBLISHED' && (
          <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 p-2">
            <div>
              {labCount === 0
                ? 'Add computer labs below to start the competition workflow.'
                : `${submittedCount}/${labCount} labs have submitted their results. Review each upload below.`}
            </div>
            {isUploadsDone && approvedCount < labCount && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold mt-1 sm:mt-0">
                All files uploaded! Please inspect and approve all labs to unlock consolidation.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}