'use client';

import { Fragment, useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatTimeTaken } from '@/lib/format/time';
import type { CachedRoundInfo } from '@/lib/leaderboard/cache';

export interface LeaderboardRowItem {
  entry_id: string;
  overall_rank: number;
  total_score: number;
  problems_solved: number | null;
  penalty: number | null;
  qualification_status: 'QUALIFIED' | 'NOT_QUALIFIED' | 'BOUNDARY_REVIEW';
  participant_id: string;
  external_id: string;
  participant_name: string;
  set_name: string;
  set_code: string;
  set_id: string;
}

export interface ContestSetItem {
  set_id: string;
  set_name: string;
  set_code: string;
}

interface LeaderboardTableProps {
  entries: LeaderboardRowItem[];
  sets: ContestSetItem[];
  topK: number;
  competitionName: string;
  competitionSlug?: string;
  snapshotVersion?: number | null;
  isDraft: boolean;
  tieBreakers?: { criterion: string; direction: string }[];
  lastUpdated?: string;
  rounds?: CachedRoundInfo[];
  currentRound?: number;
  viewingRound?: number;
}

export function LeaderboardTable({
  entries: initialEntries,
  topK,
  competitionName,
  competitionSlug,
  snapshotVersion = null,
  isDraft,
  tieBreakers: initialTieBreakers,
  lastUpdated: initialLastUpdated,
  rounds: initialRounds = [],
  currentRound: initialCurrentRound = 1,
  viewingRound = 1,
}: LeaderboardTableProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardRowItem[]>(initialEntries);
  const [tieBreakers, setTieBreakers] = useState<{ criterion: string; direction: string }[] | undefined>(
    initialTieBreakers,
  );
  const [lastUpdated, setLastUpdated] = useState<string | undefined>(initialLastUpdated);
  const [rounds, setRounds] = useState<CachedRoundInfo[]>(initialRounds);
  const [currentRound, setCurrentRound] = useState<number>(initialCurrentRound);
  const versionRef = useRef<number | null>(snapshotVersion);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'QUALIFIED' | 'BOUNDARY'>('ALL');
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(!isDraft);
  const [rankDeltas, setRankDeltas] = useState<Record<string, number>>({});
  const prevRanksRef = useRef<Map<string, number>>(new Map());

  // Detect rank climbs & drops across live leaderboard updates
  useEffect(() => {
    const nextRanks = new Map<string, number>();
    const deltas: Record<string, number> = {};

    for (const item of entries) {
      const handle = item.external_id.toLowerCase();
      nextRanks.set(handle, item.overall_rank);
      const prevRank = prevRanksRef.current.get(handle);
      if (prevRank !== undefined && prevRank !== item.overall_rank) {
        deltas[handle] = prevRank - item.overall_rank; // positive = climbed up, negative = dropped down
      }
    }

    const hadPrevious = prevRanksRef.current.size > 0;
    prevRanksRef.current = nextRanks;

    if (!hadPrevious || Object.keys(deltas).length === 0) return;

    const applyTimer = setTimeout(() => {
      setRankDeltas(deltas);
    }, 0);
    const clearTimer = setTimeout(() => {
      setRankDeltas({});
    }, 3500);

    return () => {
      clearTimeout(applyTimer);
      clearTimeout(clearTimer);
    };
  }, [entries]);

  // Lightweight versioned JSON polling every 5s (avoids full-page RSC refresh unless ended)
  useEffect(() => {
    if (!autoRefresh) return;

    const poll = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const params = new URLSearchParams();
        if (competitionSlug) params.set('comp', competitionSlug);
        params.set('round', String(viewingRound));
        params.set('currentRound', String(currentRound));
        if (versionRef.current !== null) params.set('version', String(versionRef.current));

        const res = await fetch(`/api/leaderboard?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;

        const payload = (await res.json()) as {
          unchanged?: boolean;
          status?: string;
          currentRound?: number;
          viewingRound?: number;
          rounds?: CachedRoundInfo[];
          snapshot?: { version: number; published_at: string | null; generated_at: string } | null;
          sets?: ContestSetItem[];
          tieBreakers?: { criterion: string; direction: string }[];
          entries?: LeaderboardRowItem[];
        };

        if (payload.unchanged) return;

        if (payload.status !== 'PUBLISHED' || !payload.snapshot) {
          router.refresh();
          return;
        }

        // If viewing the active round and a newer round went live, switch automatically
        if (
          payload.currentRound &&
          viewingRound === currentRound &&
          payload.currentRound > currentRound
        ) {
          const nextUrl = competitionSlug
            ? `/leaderboard?comp=${encodeURIComponent(competitionSlug)}`
            : '/leaderboard';
          router.push(nextUrl);
          router.refresh();
          return;
        }

        versionRef.current = payload.snapshot.version;
        if (payload.entries) setEntries(payload.entries);
        if (payload.tieBreakers) setTieBreakers(payload.tieBreakers);
        if (payload.rounds) setRounds(payload.rounds);
        if (payload.currentRound) setCurrentRound(payload.currentRound);
        setLastUpdated(payload.snapshot.published_at || payload.snapshot.generated_at);
      } catch {
        // Ignore transient network errors and retry on next 5s tick
      }
    };

    const interval = setInterval(() => {
      void poll();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, competitionSlug, currentRound, viewingRound, router]);

  // Fullscreen helper
  function toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((item) => {
      // Status filter
      if (statusFilter === 'QUALIFIED' && item.qualification_status !== 'QUALIFIED') {
        return false;
      }
      if (statusFilter === 'BOUNDARY' && item.qualification_status !== 'BOUNDARY_REVIEW') {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.participant_name.toLowerCase().includes(q);
        const matchesId = item.external_id.toLowerCase().includes(q);
        if (!matchesName && !matchesId) {
          return false;
        }
      }
      return true;
    });
  }, [entries, statusFilter, searchQuery]);

  // Determine shared ranks (Olympic tie indicator)
  const rankCounts = useMemo(() => {
    const counts = new Map<number, number>();
    entries.forEach((e) => {
      counts.set(e.overall_rank, (counts.get(e.overall_rank) || 0) + 1);
    });
    return counts;
  }, [entries]);

  // Top 3 for Podium
  const podium = useMemo(() => {
    const rank1 = entries.find((e) => e.overall_rank === 1);
    const rank2 = entries.find((e) => e.overall_rank === 2);
    const rank3 = entries.find((e) => e.overall_rank === 3);
    return { rank1, rank2, rank3 };
  }, [entries]);

  const hasBoundaryTies = useMemo(
    () => entries.some((e) => e.qualification_status === 'BOUNDARY_REVIEW'),
    [entries]
  );

  const qualifiedCount = useMemo(
    () => entries.filter((e) => e.qualification_status === 'QUALIFIED').length,
    [entries]
  );

  const leadingScore = entries[0]?.total_score ?? 0;

  // Client-side CSV export
  function handleExportCsv() {
    const headers = [
      'Rank',
      'HackerRank Handle',
      'Full Name',
      'Total Score',
      'Time Taken (MM:SS)',
      'Qualification Status',
    ];

    const rows = filtered.map((e) => [
      e.overall_rank,
      `"${e.external_id.replace(/"/g, '""')}"`,
      `"${e.participant_name.replace(/"/g, '""')}"`,
      e.total_score,
      formatTimeTaken(e.penalty, ''),
      e.qualification_status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${competitionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_leaderboard.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className={`space-y-8 ${isProjectorMode ? 'projector-mode fixed inset-0 z-50 overflow-y-auto bg-black text-white p-8' : ''}`}>
      {/* Projector Header Bar */}
      {isProjectorMode && (
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <span className="text-xs font-mono text-zinc-400">
              Projector view &bull; {competitionName}
            </span>
            <h1 className="text-3xl font-medium tracking-tight text-white mt-1">
              Live Standings
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-lg text-xs font-medium font-mono border cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              {autoRefresh ? 'Auto Sync: On (5s) · Pause' : 'Auto Sync: Off'}
            </button>
            <button
              onClick={toggleFullScreen}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-900 text-zinc-200 hover:text-white transition-colors"
            >
              Fullscreen
            </button>
            <button
              onClick={() => setIsProjectorMode(false)}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
            >
              Exit projector
            </button>
          </div>
        </div>
      )}

      {/* Draft Notification Badge */}
      {isDraft && (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-sm bg-amber-500" />
            <span className="font-medium">Draft preview mode</span>
            <span className="text-zinc-600 dark:text-zinc-400">
              &mdash; This consolidated ranking has not been publicly released yet.
            </span>
          </div>
          <span className="text-xs font-mono">Unpublished draft</span>
        </div>
      )}

      {/* Round Switcher (Current Leaderboard vs Greyed-Out Completed Rounds) */}
      {rounds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {rounds.map((r) => {
            const isCurrent = r.status === 'CURRENT';
            const isSelected = r.round_number === viewingRound;
            const hrefParams = new URLSearchParams();
            if (competitionSlug) hrefParams.set('comp', competitionSlug);
            if (!isCurrent) hrefParams.set('round', String(r.round_number));
            const qs = hrefParams.toString();
            const href = qs ? `/leaderboard?${qs}` : '/leaderboard';

            if (isCurrent) {
              return (
                <Link
                  key={r.round_number}
                  href={href}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    isSelected
                      ? isProjectorMode
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : isProjectorMode
                      ? 'border-emerald-500/30 bg-zinc-900 text-emerald-400 hover:bg-emerald-500/10'
                      : 'border-emerald-500/25 bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5'
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Current Leaderboard (Round {r.round_number})</span>
                </Link>
              );
            }

            return (
              <Link
                key={r.round_number}
                href={href}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  isSelected
                    ? isProjectorMode
                      ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
                      : 'bg-zinc-200/80 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200'
                    : isProjectorMode
                    ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    : 'bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <span>Round {r.round_number}</span>
                <span className="text-[10px] uppercase tracking-wider opacity-75">Completed</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Boundary Tie Warning Banner */}
      {hasBoundaryTies && (
        <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">Boundary review active:</span>
            <span>Contestants share identical scores at the Top-{topK} cutoff threshold.</span>
          </div>
          <span className="text-xs font-mono bg-rose-500/20 px-2 py-1 rounded">
            Review required
          </span>
        </div>
      )}

      {/* Live Standings Summary Strip */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x rounded-xl border ${
        isProjectorMode
          ? 'border-zinc-800 bg-zinc-900/90 divide-zinc-800 text-white'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-zinc-200 dark:divide-zinc-800 text-zinc-900 dark:text-zinc-50'
      }`}>
        <div className="px-5 py-3.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Contestants
          </div>
          <div className="mt-1 text-xl font-semibold font-mono tabular-nums">
            {entries.length}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Top-{topK} Qualified
          </div>
          <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {qualifiedCount}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Leading Score
          </div>
          <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {leadingScore}
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-1">pts</span>
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Feed Status
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-sm font-medium">
            {isDraft ? (
              <>
                <span className="size-2 rounded-full bg-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">Draft preview</span>
              </>
            ) : autoRefresh ? (
              <>
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-600 dark:text-emerald-400">Live</span>
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-zinc-400" />
                <span className="text-zinc-500 dark:text-zinc-400">Sync paused</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Podium Section (Rank 1, 2, 3) */}
      {statusFilter === 'ALL' && !searchQuery && entries.length >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:items-end">
          {[
            {
              rankNum: '02',
              place: '2nd place',
              label: 'Runner-up',
              entry: podium.rank2,
              orderClass: 'sm:order-1',
              cardClass: isProjectorMode
                ? 'border-slate-500/40 bg-zinc-900 text-white'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50',
              accentClass: 'text-slate-600 dark:text-slate-300',
              watermarkClass: 'text-slate-200 dark:text-slate-800/80',
              badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20',
              dividerClass: 'border-zinc-100 dark:border-zinc-800',
              heightClass: 'sm:min-h-[212px]',
              scoreSizeClass: 'text-3xl',
              nameSizeClass: 'text-base sm:text-lg',
            },
            {
              rankNum: '01',
              place: '1st place',
              label: 'Winner',
              entry: podium.rank1,
              orderClass: 'sm:order-2',
              cardClass: isProjectorMode
                ? 'border-amber-400/60 bg-amber-950/20 text-white'
                : 'border-amber-500/50 bg-amber-500/[0.04] dark:bg-amber-950/15 text-zinc-900 dark:text-zinc-50',
              accentClass: 'text-amber-600 dark:text-amber-400',
              watermarkClass: 'text-amber-200/80 dark:text-amber-900/40',
              badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35',
              dividerClass: 'border-amber-500/20',
              heightClass: 'sm:min-h-[244px]',
              scoreSizeClass: 'text-4xl',
              nameSizeClass: 'text-lg sm:text-xl',
            },
            {
              rankNum: '03',
              place: '3rd place',
              label: 'Third place',
              entry: podium.rank3,
              orderClass: 'sm:order-3',
              cardClass: isProjectorMode
                ? 'border-orange-500/35 bg-zinc-900 text-white'
                : 'border-orange-300/80 dark:border-orange-900/60 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50',
              accentClass: 'text-orange-600 dark:text-orange-400',
              watermarkClass: 'text-orange-200/70 dark:text-orange-950/60',
              badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20',
              dividerClass: 'border-zinc-100 dark:border-zinc-800',
              heightClass: 'sm:min-h-[192px]',
              scoreSizeClass: 'text-3xl',
              nameSizeClass: 'text-base sm:text-lg',
            },
          ].map(
            (slot) =>
              slot.entry && (
                <div
                  key={slot.place}
                  className={`relative overflow-hidden rounded-xl border p-6 flex flex-col justify-between ${slot.orderClass} ${slot.heightClass} ${slot.cardClass}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none select-none absolute right-4 top-3 font-mono text-5xl font-semibold tracking-tighter leading-none ${slot.watermarkClass}`}
                  >
                    {slot.rankNum}
                  </span>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold ${slot.accentClass}`}>
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                          <path d="M4 22h16" />
                          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                        </svg>
                        {slot.place}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${slot.badgeClass}`}>
                        {slot.label}
                      </span>
                    </div>
                    <h3 className={`font-semibold mt-5 truncate pr-12 ${slot.nameSizeClass}`}>
                      {slot.entry.participant_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                        @{slot.entry.external_id}
                      </p>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                        {slot.entry.set_code}
                      </span>
                    </div>
                  </div>

                  <div className={`relative z-10 mt-6 pt-4 border-t ${slot.dividerClass} flex justify-between items-baseline gap-2`}>
                    <div>
                      <span className={`${slot.scoreSizeClass} font-semibold tabular-nums font-mono ${slot.accentClass}`}>
                        {slot.entry.total_score}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-1">pts</span>
                    </div>
                    <div className="text-right text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatTimeTaken(slot.entry.penalty)}
                      {slot.entry.problems_solved !== null && (
                        <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                          &middot; {slot.entry.problems_solved} solved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
          )}
        </div>
      )}

      {/* Control Bar: Search, Status Filter, Projector Toggle, Export */}
      <div className={`rounded-xl border p-3.5 sm:p-4 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 no-print ${
        isProjectorMode
          ? 'border-zinc-800 bg-zinc-900'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
      }`}>
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <svg
            className="size-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or handle..."
            aria-label="Search contestants by name or handle"
            className={`w-full h-9 text-xs sm:text-sm rounded-lg border pl-10 pr-14 placeholder-zinc-400 focus:outline-none focus:border-indigo-600 ${
              isProjectorMode
                ? 'border-zinc-700 bg-zinc-800 text-white'
                : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* View Toggles & Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-zinc-100 dark:border-zinc-800">
          {/* Segmented Filter */}
          <div className={`inline-flex rounded-lg border p-0.5 ${
            isProjectorMode
              ? 'border-zinc-700 bg-zinc-950'
              : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-950/60'
          }`}>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? isProjectorMode
                    ? 'bg-zinc-800 text-white'
                    : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'QUALIFIED' ? 'ALL' : 'QUALIFIED')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'QUALIFIED'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Top {topK} only
            </button>
            {hasBoundaryTies && (
              <button
                onClick={() => setStatusFilter(statusFilter === 'BOUNDARY' ? 'ALL' : 'BOUNDARY')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'BOUNDARY'
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                Boundary ties
              </button>
            )}
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Toggle continuous 5s leaderboard auto-refresh"
          >
            {autoRefresh && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            {autoRefresh ? 'Auto Sync: On (5s)' : 'Auto Sync: Off'}
          </button>

          {!isProjectorMode && (
            <button
              onClick={() => setIsProjectorMode(true)}
              className="h-9 px-3 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              title="Toggle auditorium projector view"
            >
              <svg className="size-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              Projector view
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="h-9 px-3 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            title="Download CSV"
          >
            <svg className="size-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="h-9 px-3 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer hidden sm:inline-flex items-center gap-1.5"
            title="Print view"
          >
            <svg className="size-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Main Standings Table */}
      <div className={`overflow-x-auto rounded-xl border ${
        isProjectorMode
          ? 'border-zinc-800 bg-zinc-950 text-white'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
      }`}>
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left">
          <thead className={isProjectorMode ? 'bg-zinc-900/95 text-xs font-medium text-zinc-400 sticky top-0 z-10' : 'bg-zinc-50/95 dark:bg-zinc-800/80 text-xs font-medium text-zinc-500 dark:text-zinc-400 backdrop-blur-xs'}>
            <tr>
              <th className="px-6 py-3.5 w-24">Rank</th>
              <th className="px-6 py-3.5">Contestant</th>
              <th className="px-6 py-3.5 text-right">Score</th>
              <th className="px-6 py-3.5 text-right">Time Taken</th>
              <th className="px-6 py-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 text-xs">
                  No contestants match your current filters.
                </td>
              </tr>
            ) : (
              filtered.map((item, index) => {
                const isTied = (rankCounts.get(item.overall_rank) || 0) > 1;
                const isQualified = item.qualification_status === 'QUALIFIED';
                const isBoundary = item.qualification_status === 'BOUNDARY_REVIEW';
                const prevItem = index > 0 ? filtered[index - 1] : null;
                const showCutoffDivider =
                  statusFilter === 'ALL' &&
                  !searchQuery &&
                  prevItem !== null &&
                  prevItem.qualification_status !== 'NOT_QUALIFIED' &&
                  item.qualification_status === 'NOT_QUALIFIED';
                const rankDelta = rankDeltas[item.external_id.toLowerCase()] ?? 0;
                const movementClass =
                  rankDelta > 0
                    ? 'animate-rank-climb'
                    : rankDelta < 0
                    ? 'animate-rank-drop'
                    : '';

                return (
                  <Fragment key={item.entry_id}>
                    {showCutoffDivider && (
                      <tr key={`cutoff-${item.entry_id}`} className={isProjectorMode ? 'bg-zinc-900/80' : 'bg-zinc-50 dark:bg-zinc-950/60'}>
                        <td colSpan={5} className="px-6 py-2">
                          <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            <span className="flex-1 h-px bg-emerald-500/30" />
                            <span>Top {topK} Qualification Cutoff</span>
                            <span className="flex-1 h-px bg-emerald-500/30" />
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      key={`${item.entry_id}-${rankDelta}`}
                      className={`transition-colors ${movementClass} ${
                        isBoundary
                          ? 'bg-rose-500/5 hover:bg-rose-500/10'
                          : isQualified
                          ? isProjectorMode
                            ? 'bg-emerald-950/20 hover:bg-emerald-950/40'
                            : 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]'
                          : isProjectorMode
                          ? 'hover:bg-zinc-900/60'
                          : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-6 py-4 font-mono font-medium">
                        <div className="inline-flex items-center gap-1.5">
                          {item.overall_rank === 1 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              {isTied ? '=1' : '1'}
                            </span>
                          ) : item.overall_rank === 2 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-200 border border-slate-400/30">
                              {isTied ? '=2' : '2'}
                            </span>
                          ) : item.overall_rank === 3 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/25">
                              {isTied ? '=3' : '3'}
                            </span>
                          ) : (
                            <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs tabular-nums">
                              {isTied ? `=${item.overall_rank}` : `#${item.overall_rank}`}
                            </span>
                          )}
                          {rankDelta > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              title={`Climbed ${rankDelta} position(s)`}
                            >
                              <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m18 15-6-6-6 6" />
                              </svg>
                              {rankDelta}
                            </span>
                          )}
                          {rankDelta < 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              title={`Dropped ${Math.abs(rankDelta)} position(s)`}
                            >
                              <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m6 9 6 6 6-6" />
                              </svg>
                              {Math.abs(rankDelta)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Contestant */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={`size-8 rounded-full flex items-center justify-center text-xs font-mono font-semibold shrink-0 border ${
                              item.overall_rank === 1
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                : item.overall_rank === 2
                                ? 'bg-slate-500/15 text-slate-700 dark:text-slate-200 border-slate-400/30'
                                : item.overall_rank === 3
                                ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25'
                                : isProjectorMode
                                ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                            }`}
                          >
                            {item.participant_name.trim().slice(0, 2).toUpperCase() || '?'}
                          </span>
                          <div className="min-w-0">
                            <div className={`font-medium truncate ${isProjectorMode ? 'text-white text-base' : 'text-zinc-900 dark:text-zinc-100'}`}>
                              {item.participant_name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                                @{item.external_id}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                                {item.set_code}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Score */}
                      <td className="px-6 py-4 text-right">
                        <div className={`font-mono font-semibold tabular-nums ${isProjectorMode ? 'text-2xl text-white' : 'text-base text-zinc-900 dark:text-zinc-50'}`}>
                          {item.total_score}
                          <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-500 ml-1">pts</span>
                        </div>
                        {item.problems_solved !== null && (
                          <div className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                            {item.problems_solved} solved
                          </div>
                        )}
                      </td>

                      {/* Time Taken */}
                      <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatTimeTaken(item.penalty)}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        {isBoundary ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                            Boundary tie
                          </span>
                        ) : isQualified ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            Top {topK} qualified
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Participant
                          </span>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className={`flex flex-col sm:flex-row justify-between items-center text-xs px-2 gap-4 ${
        isProjectorMode ? 'text-zinc-400' : 'text-zinc-500 dark:text-zinc-400'
      }`}>
        <div>
          Showing <span className="font-medium text-zinc-900 dark:text-zinc-200">{filtered.length}</span> of{' '}
          <span className="font-medium text-zinc-900 dark:text-zinc-200">{entries.length}</span> contestants.
          {lastUpdated && (
            <span className="ml-2 font-mono" suppressHydrationWarning>
              Snapshot generated: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="text-xs font-mono">
          {tieBreakers && tieBreakers.length > 0 ? (
            <span>
              Tiebreakers:{' '}
              {tieBreakers
                .map((t) => `${t.criterion === 'penalty' ? 'time taken' : t.criterion} (${t.direction.toLowerCase()})`)
                .join(' → ')}
            </span>
          ) : (
            <span>Tiebreakers: score (desc) &rarr; solved (desc) &rarr; time taken (asc)</span>
          )}
        </div>
      </div>
    </div>
  );
}
