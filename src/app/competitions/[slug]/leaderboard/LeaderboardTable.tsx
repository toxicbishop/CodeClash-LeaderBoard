'use client';

import { useState, useMemo, useEffect } from 'react';
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
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh timer for live projector/event displays
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 20000); // 20 seconds
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
      'Problems Solved',
      'Penalty (s)',
      'Qualification Status',
    ];

    const rows = filtered.map((e) => [
      e.overall_rank,
      `"${e.external_id.replace(/"/g, '""')}"`,
      `"${e.participant_name.replace(/"/g, '""')}"`,
      `"${e.set_name.replace(/"/g, '""')}"`,
      e.total_score,
      e.problems_solved ?? 0,
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
    <div className={`space-y-8 ${isProjectorMode ? 'projector-mode fixed inset-0 z-50 overflow-y-auto bg-black text-white p-6 sm:p-10' : ''}`}>
      {/* Projector Header Bar */}
      {isProjectorMode && (
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
                AUDITORIUM PROJECTOR VIEW
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {competitionName}
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mt-1">
              Live Official Standings
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors border ${
                autoRefresh
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              {autoRefresh ? '● LIVE SYNC ON (20s)' : '○ LIVE SYNC OFF'}
            </button>
            <button
              onClick={toggleFullScreen}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-700 bg-zinc-900 text-zinc-200 hover:text-white hover:border-zinc-500 transition-colors"
            >
              ⛶ Fullscreen
            </button>
            <button
              onClick={() => setIsProjectorMode(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              ✕ Exit Projector Mode
            </button>
          </div>
        </div>
      )}

      {/* Draft Notification Badge if inspecting draft */}
      {isDraft && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-bold uppercase tracking-wider">
              Draft Preview Mode
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              — This consolidated ranking has not been publicly released yet.
            </span>
          </div>
          <span className="text-[11px] font-mono">Confidential Admin View</span>
        </div>
      )}

      {/* Boundary Tie Warning Banner */}
      {hasBoundaryTies && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-base">⚠️</span>
            <span className="font-bold">Cutoff Boundary Review Active:</span>
            <span>Multiple contestants share identical scores at the Top-{topK} threshold.</span>
          </div>
          <span className="text-[11px] font-mono uppercase bg-rose-500/20 px-2 py-0.5 rounded">
            Review Required
          </span>
        </div>
      )}

      {/* Podium Section (Rank 1, 2, 3) */}
      {statusFilter === 'ALL' && selectedSetId === 'ALL' && !searchQuery && entries.length >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* 2nd Place */}
          {podium.rank2 && (
            <div className={`rounded-2xl border p-5 shadow-sm sm:order-1 sm:mt-4 flex flex-col justify-between ${
              isProjectorMode
                ? 'border-zinc-700 bg-zinc-900/90 text-white'
                : 'border-zinc-300 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/80 text-zinc-900 dark:text-zinc-50'
            }`}>
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-2xl font-bold font-mono text-zinc-400">2ND</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    🥈 SILVER
                  </span>
                </div>
                <h3 className="text-base font-bold mt-3 truncate">
                  {podium.rank2.participant_name}
                </h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                  @{podium.rank2.external_id}
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {podium.rank2.set_name}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-baseline">
                <div>
                  <span className="text-xl font-extrabold tabular-nums">
                    {podium.rank2.total_score}
                  </span>
                  <span className="text-[10px] text-zinc-400 ml-1">pts</span>
                </div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {podium.rank2.problems_solved ?? 0} solved
                </div>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {podium.rank1 && (
            <div className={`rounded-2xl border-2 border-amber-500/50 p-6 shadow-md sm:order-2 flex flex-col justify-between relative overflow-hidden ${
              isProjectorMode
                ? 'bg-gradient-to-b from-amber-500/20 via-zinc-900 to-zinc-950 text-white'
                : 'bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:to-zinc-900 text-zinc-900 dark:text-zinc-50'
            }`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-3xl font-black font-mono text-amber-500">1ST</span>
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    🥇 CHAMPION
                  </span>
                </div>
                <h3 className="text-lg font-black mt-3 truncate">
                  {podium.rank1.participant_name}
                </h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                  @{podium.rank1.external_id}
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    {podium.rank1.set_name}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-amber-500/20 flex justify-between items-baseline">
                <div>
                  <span className="text-2xl font-black tabular-nums">
                    {podium.rank1.total_score}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold ml-1">pts</span>
                </div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {podium.rank1.problems_solved ?? 0} solved
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {podium.rank3 && (
            <div className={`rounded-2xl border p-5 shadow-sm sm:order-3 sm:mt-6 flex flex-col justify-between ${
              isProjectorMode
                ? 'border-amber-700/50 bg-zinc-900/90 text-white'
                : 'border-amber-700/30 dark:border-amber-700/40 bg-white/80 dark:bg-zinc-900/80 text-zinc-900 dark:text-zinc-50'
            }`}>
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-2xl font-bold font-mono text-amber-700/80 dark:text-amber-600">3RD</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-700/10 text-amber-700 dark:text-amber-500 border border-amber-700/20">
                    🥉 BRONZE
                  </span>
                </div>
                <h3 className="text-base font-bold mt-3 truncate">
                  {podium.rank3.participant_name}
                </h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                  @{podium.rank3.external_id}
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {podium.rank3.set_name}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-baseline">
                <div>
                  <span className="text-xl font-extrabold tabular-nums">
                    {podium.rank3.total_score}
                  </span>
                  <span className="text-[10px] text-zinc-400 ml-1">pts</span>
                </div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {podium.rank3.problems_solved ?? 0} solved
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control Bar: Search, Contest Set Filter, Status Filter, Projector Toggle, Export */}
      <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 ${
        isProjectorMode
          ? 'border-zinc-800 bg-zinc-900/90'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
      }`}>
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, @handle, or set..."
            className={`w-full text-xs sm:text-sm rounded-xl border px-3.5 py-2.5 placeholder-zinc-400 focus:outline-indigo-500 ${
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
              ✕
            </button>
          )}
        </div>

        {/* Set Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            onClick={() => setSelectedSetId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedSetId === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isProjectorMode
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            All Sets ({entries.length})
          </button>
          {sets.map((set) => {
            const count = entries.filter((e) => e.set_id === set.set_id).length;
            return (
              <button
                key={set.set_id}
                onClick={() => setSelectedSetId(set.set_id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedSetId === set.set_id
                    ? 'bg-indigo-600 text-white shadow-xs'
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
        <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setStatusFilter(statusFilter === 'QUALIFIED' ? 'ALL' : 'QUALIFIED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              statusFilter === 'QUALIFIED'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            ★ Top {topK} Only
          </button>

          {hasBoundaryTies && (
            <button
              onClick={() => setStatusFilter(statusFilter === 'BOUNDARY' ? 'ALL' : 'BOUNDARY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                statusFilter === 'BOUNDARY'
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-700 dark:text-rose-300'
                  : 'border-rose-300 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20'
              }`}
            >
              ⚠️ Boundary Ties
            </button>
          )}

          {!isProjectorMode && (
            <button
              onClick={() => setIsProjectorMode(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors cursor-pointer"
              title="Toggle auditorium high-visibility projector mode"
            >
              ⛶ Projector
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Download CSV of filtered results"
          >
            ↓ CSV
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer hidden sm:inline-block"
            title="Print or save as PDF"
          >
            🖨 Print
          </button>
        </div>
      </div>

      {/* Main Standings Table */}
      <div className={`overflow-x-auto rounded-2xl border shadow-sm ${
        isProjectorMode
          ? 'border-zinc-800 bg-zinc-950 text-white'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
      }`}>
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left">
          <thead className={isProjectorMode ? 'bg-zinc-900 text-xs font-bold uppercase tracking-wider text-zinc-400' : 'bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400'}>
            <tr>
              <th className="px-6 py-4 w-24">Rank</th>
              <th className="px-6 py-4">Contestant</th>
              <th className="px-6 py-4">Contest Set</th>
              <th className="px-6 py-4 text-right">Score</th>
              <th className="px-6 py-4 text-right">Solved</th>
              <th className="px-6 py-4 text-right">Penalty</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-xs">
                  No contestants match your current filters.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isTied = (rankCounts.get(item.overall_rank) || 0) > 1;
                const isQualified = item.qualification_status === 'QUALIFIED';
                const isBoundary = item.qualification_status === 'BOUNDARY_REVIEW';

                return (
                  <tr
                    key={item.entry_id}
                    className={`transition-colors ${
                      isBoundary
                        ? 'bg-rose-500/10 hover:bg-rose-500/15'
                        : isQualified
                        ? isProjectorMode
                          ? 'bg-emerald-950/20 hover:bg-emerald-950/40'
                          : 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.08]'
                        : isProjectorMode
                        ? 'hover:bg-zinc-900/60'
                        : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-6 py-4 font-mono font-bold">
                      {item.overall_rank === 1 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          🥇 {isTied ? '=1' : '1'}
                        </span>
                      ) : item.overall_rank === 2 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600">
                          🥈 {isTied ? '=2' : '2'}
                        </span>
                      ) : item.overall_rank === 3 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-amber-700/15 text-amber-800 dark:text-amber-400 border border-amber-700/30">
                          🥉 {isTied ? '=3' : '3'}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-semibold tabular-nums text-sm">
                          {isTied ? `=${item.overall_rank}` : `#${item.overall_rank}`}
                        </span>
                      )}
                    </td>

                    {/* Contestant */}
                    <td className="px-6 py-4">
                      <div className={`font-bold ${isProjectorMode ? 'text-white text-base' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {item.participant_name}
                      </div>
                      <div className="text-xs font-mono text-zinc-400">
                        @{item.external_id}
                      </div>
                    </td>

                    {/* Contest Set */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isProjectorMode
                          ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                      }`}>
                        {item.set_name}
                      </span>
                    </td>

                    {/* Total Score */}
                    <td className="px-6 py-4 text-right">
                      <span className={`font-black tabular-nums ${isProjectorMode ? 'text-xl text-white' : 'text-base text-zinc-900 dark:text-zinc-50'}`}>
                        {item.total_score}
                      </span>
                    </td>

                    {/* Problems Solved */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {item.problems_solved ?? 0}
                      </span>
                    </td>

                    {/* Penalty */}
                    <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-zinc-400">
                      {item.penalty !== null ? `${item.penalty}s` : '—'}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      {isBoundary ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          ⚠️ BOUNDARY TIE
                        </span>
                      ) : isQualified ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          ★ TOP {topK} QUALIFIED
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-zinc-400">
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
      <div className={`flex flex-col sm:flex-row justify-between items-center text-xs px-2 gap-2 ${
        isProjectorMode ? 'text-zinc-400' : 'text-zinc-500 dark:text-zinc-400'
      }`}>
        <div>
          Showing <span className="font-bold text-zinc-900 dark:text-zinc-200">{filtered.length}</span> of{' '}
          <span className="font-bold text-zinc-900 dark:text-zinc-200">{entries.length}</span> contestants across{' '}
          <span className="font-bold text-zinc-900 dark:text-zinc-200">{sets.length}</span> contest sets.
          {lastUpdated && <span className="ml-2 font-mono">Snapshot generated: {new Date(lastUpdated).toLocaleTimeString()}</span>}
        </div>
        <div className="text-[11px] font-mono">
          {tieBreakers && tieBreakers.length > 0 ? (
            <span>
              Tiebreakers: {tieBreakers.map((t) => `${t.criterion} (${t.direction})`).join(' → ')}
            </span>
          ) : (
            <span>Tiebreakers: Score (DESC) → Solved (DESC) → Penalty (ASC)</span>
          )}
        </div>
      </div>
    </div>
  );
}
