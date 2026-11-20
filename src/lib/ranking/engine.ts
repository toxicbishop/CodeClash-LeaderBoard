/**
 * src/lib/ranking/engine.ts
 *
 * Pure, stateless ranking engine. No DB calls — fully unit testable.
 *
 * Implements:
 *  - Lexicographic multi-key sort using configurable tie_breaker_rules
 *  - Olympic shared-rank assignment (ties share rank, next distinct rank skips)
 *  - Top-K qualification marking with BOUNDARY_REVIEW for ties at the cutoff
 */

import type { TieBreakerRule, QualificationStatus } from '@/types/database';

export interface RankingInput {
  participant_id: string;
  external_id: string;
  participant_name: string;
  set_id: string;
  set_name: string;
  total_score: number;
  problems_solved: number | null;
  penalty: number | null;
  final_submission_time: number | null;
  incorrect_submissions: number | null;
}

export interface RankedEntry extends RankingInput {
  overall_rank: number;
  qualification_status: QualificationStatus;
}

/** Extract the numeric value for a given criterion from a row */
function getFieldValue(row: RankingInput, criterion: TieBreakerRule['criterion']): number {
  switch (criterion) {
    case 'total_score':             return row.total_score ?? 0;
    case 'problems_solved':         return row.problems_solved ?? 0;
    case 'penalty':                 return row.penalty ?? 0;
    case 'final_submission_time':   return row.final_submission_time ?? 0;
    case 'incorrect_submissions':   return row.incorrect_submissions ?? 0;
  }
}

/**
 * Compare two participants using the ordered, enabled tie-breaker rules.
 * Returns negative if a should rank higher, positive if b should.
 */
function compare(
  a: RankingInput,
  b: RankingInput,
  rules: TieBreakerRule[],
): number {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const va = getFieldValue(a, rule.criterion);
    const vb = getFieldValue(b, rule.criterion);
    if (va === vb) continue;
    // DESC → higher value is better → a wins if va > vb → return negative
    // ASC  → lower  value is better → a wins if va < vb → return negative
    return rule.direction === 'DESC' ? vb - va : va - vb;
  }
  return 0; // complete tie
}

/**
 * computeRankings()
 *
 * @param participants  Flat list of all participants from approved uploads
 * @param rules         Ordered, enabled tie-breaker rules from tie_breaker_rules table
 * @param topK          Qualification cutoff from competitions.top_k
 */
export function computeRankings(
  participants: RankingInput[],
  rules: TieBreakerRule[],
  topK: number,
): RankedEntry[] {
  const enabledRules = [...rules].sort((a, b) => a.priority - b.priority);

  // 1. Sort participants
  const sorted = [...participants].sort((a, b) => compare(a, b, enabledRules));

  // 2. Assign Olympic shared ranks
  const ranked: RankedEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && compare(sorted[i], sorted[i - 1], enabledRules) !== 0) {
      // Different from previous → rank = position (1-based)
      currentRank = i + 1;
    }
    ranked.push({
      ...sorted[i],
      overall_rank: currentRank,
      qualification_status: 'NOT_QUALIFIED', // assigned in step 3
    });
  }

  // 3. Assign qualification status
  // Find the score/criteria value at exactly rank topK
  const cutoffEntry = ranked.find(e => e.overall_rank === topK);

  if (!cutoffEntry) {
    // Fewer participants than topK — everyone qualifies
    return ranked.map(e => ({ ...e, qualification_status: 'QUALIFIED' }));
  }

  // Find the last rank that shares the cutoff value
  const cutoffRank = cutoffEntry.overall_rank;

  // All participants with the exact same values as the topK entry
  const atCutoff = ranked.filter(
    e => e.overall_rank === cutoffRank && compare(e, cutoffEntry, enabledRules) === 0,
  );
  const countAtCutoff = atCutoff.length;
  const countBefore = ranked.filter(e => e.overall_rank < cutoffRank).length;

  return ranked.map(e => {
    if (e.overall_rank < cutoffRank) {
      return { ...e, qualification_status: 'QUALIFIED' };
    }
    if (e.overall_rank === cutoffRank) {
      // If the entire tie group fits within topK, all qualify
      if (countBefore + countAtCutoff <= topK) {
        return { ...e, qualification_status: 'QUALIFIED' };
      }
      // Tie straddles the cutoff → needs Super Admin review
      return { ...e, qualification_status: 'BOUNDARY_REVIEW' };
    }
    return { ...e, qualification_status: 'NOT_QUALIFIED' };
  });
}
