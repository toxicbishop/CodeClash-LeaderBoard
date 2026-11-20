import { describe, it, expect } from 'vitest';
import { computeRankings } from '@/lib/ranking/engine';
import type { RankingInput } from '@/lib/ranking/engine';
import type { TieBreakerRule as DBRule } from '@/types/database';

const defaultRules: DBRule[] = [
  { rule_id: '1', competition_id: 'c', criterion: 'total_score',    priority: 1, direction: 'DESC', enabled: true,  approved_by: null },
  { rule_id: '2', competition_id: 'c', criterion: 'problems_solved', priority: 2, direction: 'DESC', enabled: true,  approved_by: null },
  { rule_id: '3', competition_id: 'c', criterion: 'penalty',         priority: 3, direction: 'ASC',  enabled: true,  approved_by: null },
];

function makeP(overrides: Partial<RankingInput> & { participant_id: string }): RankingInput {
  return {
    external_id: overrides.participant_id,
    participant_name: overrides.participant_id,
    set_id: 'set-a',
    set_name: 'Set A',
    total_score: 0,
    problems_solved: null,
    penalty: null,
    final_submission_time: null,
    incorrect_submissions: null,
    ...overrides,
  };
}

describe('computeRankings — basic ordering', () => {
  it('ranks by total score descending', () => {
    const result = computeRankings([
      makeP({ participant_id: 'B', total_score: 80 }),
      makeP({ participant_id: 'A', total_score: 100 }),
      makeP({ participant_id: 'C', total_score: 60 }),
    ], defaultRules, 10);

    expect(result[0].participant_id).toBe('A');
    expect(result[1].participant_id).toBe('B');
    expect(result[2].participant_id).toBe('C');
  });

  it('uses problems_solved as tiebreaker', () => {
    const result = computeRankings([
      makeP({ participant_id: 'A', total_score: 100, problems_solved: 5 }),
      makeP({ participant_id: 'B', total_score: 100, problems_solved: 8 }),
    ], defaultRules, 10);

    expect(result[0].participant_id).toBe('B');
    expect(result[1].participant_id).toBe('A');
  });

  it('uses penalty ascending as final tiebreaker', () => {
    const result = computeRankings([
      makeP({ participant_id: 'A', total_score: 100, problems_solved: 5, penalty: 120 }),
      makeP({ participant_id: 'B', total_score: 100, problems_solved: 5, penalty: 60 }),
    ], defaultRules, 10);

    expect(result[0].participant_id).toBe('B'); // lower penalty wins
  });
});

describe('computeRankings — Olympic shared ranks', () => {
  it('assigns shared rank to tied participants', () => {
    const result = computeRankings([
      makeP({ participant_id: 'A', total_score: 100 }),
      makeP({ participant_id: 'B', total_score: 100 }),
      makeP({ participant_id: 'C', total_score: 80 }),
    ], defaultRules, 10);

    expect(result.find(r => r.participant_id === 'A')!.overall_rank).toBe(1);
    expect(result.find(r => r.participant_id === 'B')!.overall_rank).toBe(1);
    expect(result.find(r => r.participant_id === 'C')!.overall_rank).toBe(3); // skips 2
  });
});

describe('computeRankings — Top-K qualification', () => {
  it('marks top K as QUALIFIED', () => {
    const participants = Array.from({ length: 15 }, (_, i) =>
      makeP({ participant_id: `P${i}`, total_score: 100 - i * 5 })
    );
    const result = computeRankings(participants, defaultRules, 10);
    const qualified = result.filter(r => r.qualification_status === 'QUALIFIED');
    expect(qualified.length).toBe(10);
  });

  it('marks BOUNDARY_REVIEW when tie straddles top-K cutoff', () => {
    // 9 clear qualifiers, then 3-way tie for rank 10 (only 1 slot)
    const participants = [
      ...Array.from({ length: 9 }, (_, i) =>
        makeP({ participant_id: `P${i}`, total_score: 100 - i })
      ),
      makeP({ participant_id: 'TIE1', total_score: 50 }),
      makeP({ participant_id: 'TIE2', total_score: 50 }),
      makeP({ participant_id: 'TIE3', total_score: 50 }),
    ];
    const result = computeRankings(participants, defaultRules, 10);
    const boundary = result.filter(r => r.qualification_status === 'BOUNDARY_REVIEW');
    expect(boundary.length).toBe(3);
    expect(boundary.every(r => r.overall_rank === 10)).toBe(true);
  });

  it('qualifies everyone when participants < topK', () => {
    const result = computeRankings([
      makeP({ participant_id: 'A', total_score: 100 }),
      makeP({ participant_id: 'B', total_score: 90 }),
    ], defaultRules, 10);
    expect(result.every(r => r.qualification_status === 'QUALIFIED')).toBe(true);
  });
});

describe('computeRankings — disabled rules', () => {
  it('ignores disabled criteria', () => {
    const rulesWithDisabledPenalty: DBRule[] = [
      ...defaultRules.slice(0, 2),
      { ...defaultRules[2], enabled: false },
    ];
    // Both have same score + problems, penalty differs but is disabled → complete tie
    const result = computeRankings([
      makeP({ participant_id: 'A', total_score: 100, problems_solved: 5, penalty: 120 }),
      makeP({ participant_id: 'B', total_score: 100, problems_solved: 5, penalty: 60 }),
    ], rulesWithDisabledPenalty, 10);

    // Both should share rank 1
    expect(result[0].overall_rank).toBe(1);
    expect(result[1].overall_rank).toBe(1);
  });
});
