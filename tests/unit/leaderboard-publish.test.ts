import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCompetitionSnapshot } from '@/lib/leaderboard/publish';

const { serviceClient } = vi.hoisted(() => ({
  serviceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: serviceClient,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('createCompetitionSnapshot', () => {
  it('consolidates only the latest APPROVED upload per active contest set', async () => {
    const compId = crypto.randomUUID();
    const setAId = crypto.randomUUID();
    const olderUploadId = crypto.randomUUID();
    const latestUploadId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const actorId = crypto.randomUUID();

    const participantsInSpy = vi.fn().mockResolvedValue({
      data: [
        {
          participant_id: crypto.randomUUID(),
          external_id: 'alice',
          participant_name: 'alice',
          set_id: setAId,
          contest_sets: { set_name: 'Set A', is_active: true },
          results: [
            {
              total_score: 20,
              problems_solved: 2,
              penalty: 1200,
              final_submission_time: null,
              incorrect_submissions: null,
            },
          ],
        },
      ],
      error: null,
    });

    const entriesInsertSpy = vi.fn().mockResolvedValue({ error: null });

    serviceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'competitions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: async () => ({ data: { competition_id: compId, top_k: 10 }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'tie_breaker_rules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'contest_sets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: async () => ({ data: [{ set_id: setAId }], error: null }),
              }),
            }),
          };
        }
        if (table === 'uploads') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    order: async () => ({
                      data: [
                        { upload_id: latestUploadId, set_id: setAId, upload_version: 7 },
                        { upload_id: olderUploadId, set_id: setAId, upload_version: 6 },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'participants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: participantsInSpy,
              }),
            }),
          };
        }
        if (table === 'leaderboard_snapshots') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: async () => ({ data: { version: 7 }, error: null }),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: async () => ({ data: { snapshot_id: snapshotId }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockResolvedValue({ error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'leaderboard_entries') {
          return { insert: entriesInsertSpy };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      }),
    });

    const res = await createCompetitionSnapshot(compId, actorId, { publishImmediately: true });

    expect(res.error).toBeUndefined();
    expect(res.success).toBe(true);
    expect(res.data).toEqual({
      snapshot_id: snapshotId,
      version: 8,
      total_entries: 1,
    });
    expect(participantsInSpy).toHaveBeenCalledWith('upload_id', [latestUploadId]);
    expect(entriesInsertSpy).toHaveBeenCalledTimes(1);
  });

  it('scopes consolidation to target round and deduplicates same-round cross-set handles keeping smaller time_taken', async () => {
    const compId = crypto.randomUUID();
    const r1SetId = crypto.randomUUID();
    const r2SetAId = crypto.randomUUID();
    const r2SetBId = crypto.randomUUID();
    const r2UploadA = crypto.randomUUID();
    const r2UploadB = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const actorId = crypto.randomUUID();

    const pFaster = crypto.randomUUID();
    const pSlower = crypto.randomUUID();
    const pBob = crypto.randomUUID();

    const entriesInsertSpy = vi.fn().mockResolvedValue({ error: null });
    const snapshotRoundEqSpy = vi.fn().mockReturnValue({
      neq: vi.fn().mockResolvedValue({ error: null }),
    });

    serviceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'competitions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: async () => ({ data: { competition_id: compId, top_k: 10 }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'tie_breaker_rules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'contest_sets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: async () => ({
                  data: [
                    { set_id: r1SetId, round_number: 1 },
                    { set_id: r2SetAId, round_number: 2 },
                    { set_id: r2SetBId, round_number: 2 },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'uploads') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    order: async () => ({
                      data: [
                        { upload_id: r2UploadA, set_id: r2SetAId, upload_version: 2 },
                        { upload_id: r2UploadB, set_id: r2SetBId, upload_version: 1 },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'participants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: async () => ({
                  data: [
                    {
                      participant_id: pSlower,
                      external_id: 'Vijay',
                      participant_name: 'Vijay',
                      set_id: r2SetBId,
                      contest_sets: { set_name: 'Set B', is_active: true },
                      results: [
                        {
                          total_score: 20,
                          problems_solved: 2,
                          penalty: 2576,
                          final_submission_time: null,
                          incorrect_submissions: null,
                        },
                      ],
                    },
                    {
                      participant_id: pFaster,
                      external_id: 'vijay',
                      participant_name: 'vijay',
                      set_id: r2SetAId,
                      contest_sets: { set_name: 'Set A', is_active: true },
                      results: [
                        {
                          total_score: 30,
                          problems_solved: 3,
                          penalty: 1286,
                          final_submission_time: null,
                          incorrect_submissions: null,
                        },
                      ],
                    },
                    {
                      participant_id: pBob,
                      external_id: 'bob',
                      participant_name: 'bob',
                      set_id: r2SetBId,
                      contest_sets: { set_name: 'Set B', is_active: true },
                      results: [
                        {
                          total_score: 25,
                          problems_solved: 2,
                          penalty: 1500,
                          final_submission_time: null,
                          incorrect_submissions: null,
                        },
                      ],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'leaderboard_snapshots') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: async () => ({ data: { version: 3 }, error: null }),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: async () => ({ data: { snapshot_id: snapshotId }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: snapshotRoundEqSpy,
              }),
            }),
          };
        }
        if (table === 'leaderboard_entries') {
          return { insert: entriesInsertSpy };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      }),
    });

    const res = await createCompetitionSnapshot(compId, actorId, {
      publishImmediately: true,
      roundNumber: 2,
    });

    expect(res.success).toBe(true);
    expect(res.data?.total_entries).toBe(2);
    expect(snapshotRoundEqSpy).toHaveBeenCalledWith('round_number', 2);

    const insertedEntries = entriesInsertSpy.mock.calls[0][0] as Array<{
      participant_id: string;
      total_score: number;
      penalty: number | null;
    }>;
    expect(insertedEntries).toHaveLength(2);
    expect(insertedEntries[0]).toMatchObject({
      participant_id: pFaster,
      total_score: 30,
      penalty: 1286,
    });
    expect(insertedEntries[1]).toMatchObject({
      participant_id: pBob,
      total_score: 25,
    });
  });
});
