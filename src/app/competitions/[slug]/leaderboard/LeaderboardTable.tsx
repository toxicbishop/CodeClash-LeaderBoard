'use client';

import { useState, useMemo } from 'react';

export interface LeaderboardRowItem {
  entry_id: string;
  overall_rank: number;
  total_score: number;
  problems_solved: number;
  penalty: number | null;
  is_qualified: boolean;
  participant_id: string;
  external_id: string;
  participant_name: string;
  lab_name: string;
  lab_id: string;
}

interface LeaderboardTableProps {
  entries: LeaderboardRowItem[];
  labs: { lab_id: string; lab_name: string }[];
  topK: number;
  competitionName: string;
  isDraft: boolean;
}

export function LeaderboardTable({
  entries,
  labs,
  topK,
  competitionName,
  isDraft,
}: LeaderboardTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabId, setSelectedLabId] = useState<string>('ALL');
  const [onlyQualified, setOnlyQualified] = useState(false);
  const [isProjectorMode, setIsProjectorMode] = useState(false);

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((item) => {
      // Lab filter
      if (selectedLabId !== 'ALL' && item.lab_id !== selectedLabId) {
        return false;
      }
      // Qualified filter
      if (onlyQualified && !item.is_qualified) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.participant_name.toLowerCase().includes(q);
        const matchesId = item.external_id.toLowerCase().includes(q);
        const matchesLab = item.lab_name.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesLab) {
          return false;
        }
      }
      return true;
    });
  }, [entries, selectedLabId, onlyQualified, searchQuery]);

  // Top 3 for Podium
  const podium = useMemo(() => {
    const rank1 = entries.find((e) => e.overall_rank === 1);
    const rank2 = entries.find((e) => e.overall_rank === 2);
    const rank3 = entries.find((e) => e.overall_rank === 3);
    return { rank1, rank2, rank3 };
  }, [entries]);

  // CSV Export handler
  function handleExportCsv() {
    const headers = [
      'Rank',
      'Participant ID',
      'Participant Name',
      'Lab',
      'Total Score',
      'Problems Solved',
      'Penalty',
      'Qualified Top-K',
    ];

    const rows = filtered.map((e) => [
      e.overall_rank,
      `"${e.external_id.replace(/"/g, '""')}"`,
      `"${e.participant_name.replace(/"/g, '""')}"`,
      `"${e.lab_name.replace(/"/g, '""')}"`,
      e.total_score,
      e.problems_solved,
      e.penalty ?? '',
      e.is_qualified ? 'YES' : 'NO',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
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
    <div className={`space-y-8 ${isProjectorMode ? 'projector-view' : ''}`}>
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

      {/* Podium Section (Rank 1, 2, 3) */}
      {!onlyQualified && selectedLabId === 'ALL' && !searchQuery && entries.length >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* 2nd Place */}
          {podium.rank2 && (
            <div className="rounded-2xl border border-zinc-300 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/80 p-5 shadow-sm sm:order-1 sm:mt-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-2xl font-bold font-mono text-zinc-400">2ND</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    🥈 SILVER
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-3 truncate">
                  {podium.rank2.participant_name}
                </h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {podium.rank2.external_id}
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {podium.rank2.lab_name}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-baseline">
                <div>
                  <span className="text-xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {podium.rank2.total_score}
                  </span>
                  <span className="text-[10px] text-zinc-400 ml-1">pts</span>
                </div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {podium.rank2.problems_solved} solved
                </div>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {podium.rank1 && (
            <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:to-zinc-900 p-6 shadow-md sm:order-2 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-3xl font-black font-mono text-amber-500">1ST</span>
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    🥇 CHAMPION
                  </span>
                </div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50 mt-3 truncate">
                  {podium.rank1.participant_name}
                </h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {podium.rank1.external_id}
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    {podium.rank1.lab_name}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-amber-500/20 flex justify-between items-baseline">
                <div>
                  <span className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">
                    {podium.rank1.total_score}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold ml-1">pts</span>
                </div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {podium.rank1.problems_solved} solved
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {podium.rank3 && (
            <div className="rounded-2xl border border-amber-700/30 dark:border-amber-700/40 bg-white/80 dark:bg-zinc-900/80 p-5 shadow-sm sm:order-3 sm:mt-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-2xl font-bold font-mono text-amber-700/60 dark:text-amber-600">3RD</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-700/10 text-amber-700 dark:text-amber-500 border border-amber-700/20">
                    🥉 BRONZE
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-3 truncate">
                  {podium.rank3.participant_name}
                </h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {podium.rank3.external_id}
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {podium.rank3.lab_name}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-baseline">
                <div>
                  <span className="text-xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {podium.rank3.total_score}
                  </span>
                  <span className="text-[10px] text-zinc-400 ml-1">pts</span>
                </div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {podium.rank3.problems_solved} solved
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control Bar: Search, Lab Filter, Top-K Toggle, Projector Mode, Export */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contestant by name, roll number, or lab..."
            className="w-full text-xs sm:text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-indigo-500"
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

        {/* Lab Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            onClick={() => setSelectedLabId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedLabId === 'ALL'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            All Labs ({entries.length})
          </button>
          {labs.map((lab) => {
            const count = entries.filter((e) => e.lab_id === lab.lab_id).length;
            return (
              <button
                key={lab.lab_id}
                onClick={() => setSelectedLabId(lab.lab_id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedLabId === lab.lab_id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {lab.lab_name} ({count})
              </button>
            );
          })}
        </div>

        {/* View Toggles & Actions */}
        <div className="flex items-center space-x-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setOnlyQualified(!onlyQualified)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              onlyQualified
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            ★ Top {topK} Only
          </button>

          <button
            onClick={() => setIsProjectorMode(!isProjectorMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isProjectorMode
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Toggle auditorium high-visibility projector mode"
          >
            ⛶ Projector
          </button>

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

      {/* Main Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left">
          <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 w-20">Rank</th>
              <th className="px-6 py-4">Contestant</th>
              <th className="px-6 py-4">Lab Affiliation</th>
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
                return (
                  <tr
                    key={item.entry_id}
                    className={`transition-colors ${
                      item.is_qualified
                        ? 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.08]'
                        : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-6 py-4 font-mono font-bold">
                      {item.overall_rank === 1 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          🥇 1
                        </span>
                      ) : item.overall_rank === 2 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600">
                          🥈 2
                        </span>
                      ) : item.overall_rank === 3 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-amber-700/15 text-amber-800 dark:text-amber-400 border border-amber-700/30">
                          🥉 3
                        </span>
                      ) : (
                        <span className="text-zinc-500 dark:text-zinc-400 text-sm tabular-nums pl-1">
                          #{item.overall_rank}
                        </span>
                      )}
                    </td>

                    {/* Contestant */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">
                        {item.participant_name}
                      </div>
                      <div className="text-xs font-mono text-zinc-400">
                        {item.external_id}
                      </div>
                    </td>

                    {/* Lab Affiliation */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {item.lab_name}
                      </span>
                    </td>

                    {/* Total Score */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-extrabold text-base tabular-nums text-zinc-900 dark:text-zinc-50">
                        {item.total_score}
                      </span>
                    </td>

                    {/* Problems Solved */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {item.problems_solved}
                      </span>
                    </td>

                    {/* Penalty */}
                    <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {item.penalty !== null ? `${item.penalty}s` : '—'}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      {item.is_qualified ? (
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
      <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 px-2 gap-2">
        <div>
          Showing <span className="font-bold text-zinc-900 dark:text-zinc-200">{filtered.length}</span> of{' '}
          <span className="font-bold text-zinc-900 dark:text-zinc-200">{entries.length}</span> contestants across{' '}
          <span className="font-bold text-zinc-900 dark:text-zinc-200">{labs.length}</span> computer laboratories.
        </div>
        <div className="text-[11px] font-mono">
          Tiebreakers: Score (DESC) → Solved (DESC) → Penalty (ASC)
        </div>
      </div>
    </div>
  );
}