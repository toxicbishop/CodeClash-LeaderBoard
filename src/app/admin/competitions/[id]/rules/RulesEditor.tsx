'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveTieBreakerRules, RuleInput } from '@/app/admin/actions';

interface RuleItem {
  rule_id?: string;
  criterion: string;
  priority: number;
  direction: 'ASC' | 'DESC';
  enabled: boolean;
}

interface RulesEditorProps {
  competitionId: string;
  initialRules: RuleItem[];
}

const CRITERION_METADATA: Record<string, { label: string; desc: string; defaultDir: 'ASC' | 'DESC' }> = {
  total_score: {
    label: 'Total Score',
    desc: 'Cumulative score earned across all challenges in the contest set.',
    defaultDir: 'DESC',
  },
  problems_solved: {
    label: 'Problems Solved',
    desc: 'Count of fully accepted problem submissions.',
    defaultDir: 'DESC',
  },
  penalty: {
    label: 'Cumulative Time Penalty',
    desc: 'Total elapsed time plus penalty increments for incorrect submissions (lower is better).',
    defaultDir: 'ASC',
  },
  final_submission_time: {
    label: 'Last Accepted Submission Time',
    desc: 'Time from contest start to the last point-earning submission (earlier is better).',
    defaultDir: 'ASC',
  },
  incorrect_submissions: {
    label: 'Incorrect Submissions Count',
    desc: 'Total number of rejected attempts before accepted code (lower is better).',
    defaultDir: 'ASC',
  },
};

export function RulesEditor({ competitionId, initialRules }: RulesEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rules, setRules] = useState<RuleItem[]>(() => {
    if (initialRules && initialRules.length > 0) {
      return [...initialRules].sort((a, b) => a.priority - b.priority);
    }
    // Default 5 rules if empty
    return [
      { criterion: 'total_score', priority: 1, direction: 'DESC', enabled: true },
      { criterion: 'problems_solved', priority: 2, direction: 'DESC', enabled: true },
      { criterion: 'penalty', priority: 3, direction: 'ASC', enabled: true },
      { criterion: 'final_submission_time', priority: 4, direction: 'ASC', enabled: true },
      { criterion: 'incorrect_submissions', priority: 5, direction: 'ASC', enabled: true },
    ];
  });

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  function moveUp(index: number) {
    if (index === 0) return;
    const newRules = [...rules];
    const temp = newRules[index];
    newRules[index] = newRules[index - 1];
    newRules[index - 1] = temp;
    // Reassign priorities 1..N
    newRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    setRules(newRules);
  }

  function moveDown(index: number) {
    if (index === rules.length - 1) return;
    const newRules = [...rules];
    const temp = newRules[index];
    newRules[index] = newRules[index + 1];
    newRules[index + 1] = temp;
    // Reassign priorities 1..N
    newRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    setRules(newRules);
  }

  function toggleEnabled(index: number) {
    const newRules = [...rules];
    newRules[index].enabled = !newRules[index].enabled;
    setRules(newRules);
  }

  function toggleDirection(index: number) {
    const newRules = [...rules];
    newRules[index].direction = newRules[index].direction === 'ASC' ? 'DESC' : 'ASC';
    setRules(newRules);
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const payload: RuleInput[] = rules.map((r, idx) => ({
        criterion: r.criterion,
        direction: r.direction,
        enabled: r.enabled,
        priority: idx + 1,
      }));

      const res = await saveTieBreakerRules(competitionId, payload);
      if (res?.error) {
        setMessage({ text: res.error, type: 'error' });
      } else {
        setMessage({ text: 'Tie-breaker rules successfully updated and approved.', type: 'success' });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm divide-y divide-zinc-200 dark:divide-zinc-800">
        {rules.map((rule, idx) => {
          const meta = CRITERION_METADATA[rule.criterion] || {
            label: rule.criterion,
            desc: '',
            defaultDir: 'DESC',
          };

          return (
            <div
              key={rule.criterion}
              className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                rule.enabled ? 'bg-transparent' : 'opacity-50 bg-zinc-50/50 dark:bg-zinc-800/20'
              }`}
            >
              <div className="flex items-start sm:items-center space-x-4">
                {/* Priority Badge */}
                <div className="flex flex-col items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-sm border border-indigo-500/20 shrink-0">
                  #{idx + 1}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase">
                      {rule.criterion}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xl">
                    {meta.desc}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2 sm:self-center">
                {/* Direction Toggle */}
                <button
                  type="button"
                  onClick={() => toggleDirection(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                    rule.direction === 'DESC'
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  }`}
                  title="Click to toggle sorting direction"
                >
                  {rule.direction === 'DESC' ? '↓ DESC (Highest First)' : '↑ ASC (Lowest First)'}
                </button>

                {/* Enable/Disable Toggle */}
                <button
                  type="button"
                  onClick={() => toggleEnabled(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    rule.enabled
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'border-zinc-300 dark:border-zinc-700 text-zinc-400'
                  }`}
                >
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </button>

                {/* Reorder Buttons */}
                <div className="flex items-center space-x-1 border border-zinc-200 dark:border-zinc-700 rounded-lg p-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveUp(idx)}
                    className="px-2 py-0.5 rounded text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                    title="Move up in priority"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={idx === rules.length - 1}
                    onClick={() => moveDown(idx)}
                    className="px-2 py-0.5 rounded text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                    title="Move down in priority"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end items-center gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {isPending ? 'Saving...' : 'Save & Approve Rules'}
        </button>
      </div>
    </div>
  );
}
