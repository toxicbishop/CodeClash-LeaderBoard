'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
  isDraft: boolean;
  tieBreakers?: { criterion: string; direction: string }[];
  lastUpdated?: string;
}

export function LeaderboardTable({
  entries,
  sets,
  topK,
  competitionName,
  isDraft,
  tieBreakers,
  lastUpdated,
}: LeaderboardTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSetId, setSelectedSetId] = useState<string>('ALL');
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

  // Auto-sync timer for live leaderboard & projector displays (every 20s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, router]);

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
      // Set filter
      if (selectedSetId !== 'ALL' && item.set_id !== selectedSetId) {
        return false;
      }
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
        const matchesSet = item.set_name.toLowerCase().includes(q) || item.set_code.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesSet) {
          return false;
        }
      }
      return true;
    });
  }, [entries, selectedSetId, statusFilter, searchQuery]);

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

  // Client-side CSV export
  function handleExportCsv() {
    const headers = [
      'Rank',
      'HackerRank Handle',
      'Full Name',
      'Contest Set',
      'Total Score',
      'Penalty (s)',
      'Qualification Status',
    ];

    const rows = filtered.map((e) => [
      e.overall_rank,
      `"${e.external_id.replace(/"/g, '""')}"`,
      `"${e.participant_name.replace(/"/g, '""')}"`,
      `"${e.set_name.replace(/"/g, '""')}"`,
      e.total_score,
      e.penalty ?? '',
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
              {autoRefresh ? 'Auto Sync: On (20s) · Pause' : 'Auto Sync: Off'}
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

      {/* Podium Section (Rank 1, 2, 3) */}
      {statusFilter === 'ALL' && selectedSetId === 'ALL' && !searchQuery && entries.length >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 2nd Place */}
          {podium.rank2 && (
            <div className={`rounded-xl border p-6 flex flex-col justify-between sm:order-1 sm:mt-4 ${
              isProjectorMode
                ? 'border-zinc-800 bg-zinc-900 text-white'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50'
            }`}>
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-mono text-zinc-500">2nd place</span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    Runner-up
                  </span>
                </div>
                <h3 className="text-base font-semibold mt-4 truncate">
                  {podium.rank2.participant_name}
                </h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1">
                  @{podium.rank2.external_id}
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {podium.rank2.set_name}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-baseline">
                <div>
                  <span className="text-2xl font-semibold tabular-nums font-mono">
                    {podium.rank2.total_score}
                  </span>
                  <span className="text-xs text-zinc-500 ml-1">pts</span>
                </div>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {podium.rank1 && (
            <div className={`rounded-xl border p-6 flex flex-col justify-between sm:order-2 ${
              isProjectorMode
                ? 'border-amber-500/40 bg-zinc-900 text-white'
                : 'border-amber-500/40 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50'
            }`}>
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-mono text-amber-600 dark:text-amber-400 font-medium">1st place</span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    Winner
                  </span>
                </div>
                <h3 className="text-lg font-semibold mt-4 truncate">
                  {podium.rank1.participant_name}
                </h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1">
                  @{podium.rank1.external_id}
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    {podium.rank1.set_name}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-amber-500/20 flex justify-between items-baseline">
                <div>
                  <span className="text-2xl font-semibold tabular-nums font-mono text-amber-600 dark:text-amber-400">
                    {podium.rank1.total_score}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">pts</span>
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {podium.rank3 && (
            <div className={`rounded-xl border p-6 flex flex-col justify-between sm:order-3 sm:mt-6 ${
              isProjectorMode
                ? 'border-zinc-800 bg-zinc-900 text-white'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50'
            }`}>
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-mono text-zinc-500">3rd place</span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    Third place
                  </span>
                </div>
                <h3 className="text-base font-semibold mt-4 truncate">
                  {podium.rank3.participant_name}
                </h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1">
                  @{podium.rank3.external_id}
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {podium.rank3.set_name}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-baseline">
                <div>
                  <span className="text-2xl font-semibold tabular-nums font-mono">
                    {podium.rank3.total_score}
                  </span>
                  <span className="text-xs text-zinc-500 ml-1">pts</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control Bar: Search, Contest Set Filter, Status Filter, Projector Toggle, Export */}
      <div className={`rounded-xl border p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 ${
        isProjectorMode
          ? 'border-zinc-800 bg-zinc-900'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
      }`}>
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, handle, or set..."
            className={`w-full h-10 text-xs sm:text-sm rounded-lg border px-4 placeholder-zinc-400 focus:outline-none focus:border-indigo-600 ${
              isProjectorMode
                ? 'border-zinc-700 bg-zinc-800 text-white'
                : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Set Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedSetId('ALL')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              selectedSetId === 'ALL'
                ? 'bg-indigo-600 text-white'
                : isProjectorMode
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            All sets ({entries.length})
          </button>
          {sets.map((set) => {
            const count = entries.filter((e) => e.set_id === set.set_id).length;
            return (
              <button
                key={set.set_id}
                onClick={() => setSelectedSetId(set.set_id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedSetId === set.set_id
                    ? 'bg-indigo-600 text-white'
                    : isProjectorMode
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {set.set_name} ({count})
              </button>
            );
          })}
        </div>

        {/* View Toggles & Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 pt-4 lg:pt-0 border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setStatusFilter(statusFilter === 'QUALIFIED' ? 'ALL' : 'QUALIFIED')}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              statusFilter === 'QUALIFIED'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Top {topK} only
          </button>

          {hasBoundaryTies && (
            <button
              onClick={() => setStatusFilter(statusFilter === 'BOUNDARY' ? 'ALL' : 'BOUNDARY')}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                statusFilter === 'BOUNDARY'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  : 'border-rose-300 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20'
              }`}
            >
              Boundary ties
            </button>
          )}

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Toggle continuous 20s leaderboard auto-refresh"
          >
            {autoRefresh && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            {autoRefresh ? 'Auto Sync: On (20s)' : 'Auto Sync: Off'}
          </button>

          {!isProjectorMode && (
            <button
              onClick={() => setIsProjectorMode(true)}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Toggle auditorium projector view"
            >
              Projector view
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Download CSV"
          >
            Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer hidden sm:inline-block"
            title="Print view"
          >
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
          <thead className={isProjectorMode ? 'bg-zinc-900 text-xs font-medium text-zinc-400' : 'bg-zinc-50 dark:bg-zinc-800/60 text-xs font-medium text-zinc-500 dark:text-zinc-400'}>
            <tr>
              <th className="px-6 py-4 w-20">Rank</th>
              <th className="px-6 py-4">Contestant</th>
              <th className="px-6 py-4">Contest set</th>
              <th className="px-6 py-4 text-right">Score</th>
              <th className="px-6 py-4 text-right">Penalty</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-xs">
                  No contestants match your current filters.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isTied = (rankCounts.get(item.overall_rank) || 0) > 1;
                const isQualified = item.qualification_status === 'QUALIFIED';
                const isBoundary = item.qualification_status === 'BOUNDARY_REVIEW';
                const rankDelta = rankDeltas[item.external_id.toLowerCase()] ?? 0;
                const movementClass =
                  rankDelta > 0
                    ? 'animate-rank-climb'
                    : rankDelta < 0
                    ? 'animate-rank-drop'
                    : '';

                return (
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
                        : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-6 py-4 font-mono font-medium">
                      <div className="inline-flex items-center gap-1.5">
                        {item.overall_rank === 1 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            {isTied ? '=1' : '1'}
                          </span>
                        ) : item.overall_rank === 2 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                            {isTied ? '=2' : '2'}
                          </span>
                        ) : item.overall_rank === 3 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                            {isTied ? '=3' : '3'}
                          </span>
                        ) : (
                          <span className="text-zinc-500 font-mono text-xs tabular-nums">
                            {isTied ? `=${item.overall_rank}` : `#${item.overall_rank}`}
                          </span>
                        )}
                        {rankDelta > 0 && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            title={`Climbed ${rankDelta} position(s)`}
                          >
                            ▲ {rankDelta}
                          </span>
                        )}
                        {rankDelta < 0 && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            title={`Dropped ${Math.abs(rankDelta)} position(s)`}
                          >
                            ▼ {Math.abs(rankDelta)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Contestant */}
                    <td className="px-6 py-4">
                      <div className={`font-medium ${isProjectorMode ? 'text-white text-base' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {item.participant_name}
                      </div>
                      <div className="text-xs font-mono text-zinc-400">
                        @{item.external_id}
                      </div>
                    </td>

                    {/* Contest Set */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        isProjectorMode
                          ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                      }`}>
                        {item.set_name}
                      </span>
                    </td>

                    {/* Total Score */}
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono font-semibold tabular-nums ${isProjectorMode ? 'text-xl text-white' : 'text-sm text-zinc-900 dark:text-zinc-50'}`}>
                        {item.total_score}
                      </span>
                    </td>

                    {/* Penalty */}
                    <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-zinc-400">
                      {item.penalty !== null ? `${item.penalty}s` : '—'}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      {isBoundary ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                          Boundary tie
                        </span>
                      ) : isQualified ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          Top {topK} qualified
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          Participant
                        </span>
                      )}
                    </td>
                  </tr>
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
          <span className="font-medium text-zinc-900 dark:text-zinc-200">{entries.length}</span> contestants across{' '}
          <span className="font-medium text-zinc-900 dark:text-zinc-200">{sets.length}</span> contest sets.
          {lastUpdated && <span className="ml-2 font-mono">Snapshot generated: {new Date(lastUpdated).toLocaleTimeString()}</span>}
        </div>
        <div className="text-xs font-mono">
          {tieBreakers && tieBreakers.length > 0 ? (
            <span>
              Tiebreakers: {tieBreakers.map((t) => `${t.criterion} (${t.direction.toLowerCase()})`).join(' → ')}
            </span>
          ) : (
            <span>Tiebreakers: score (desc) &rarr; solved (desc) &rarr; penalty (asc)</span>
          )}
        </div>
      </div>
    </div>
  );
}
