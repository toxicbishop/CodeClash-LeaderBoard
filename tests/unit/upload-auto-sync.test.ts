import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncContestSetFromHackerRank } from '@/app/upload/actions';

const { sessionClient, serviceClient, fetchHRMock, publishSnapshotMock } = vi.hoisted(() => ({
  sessionClient: vi.fn(),
  serviceClient: vi.fn(),
  fetchHRMock: vi.fn(),
  publishSnapshotMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: sessionClient,
  createAdminClient: serviceClient,
}));

vi.mock('@/lib/hackerrank/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hackerrank/client')>('@/lib/hackerrank/client');
  return {
    ...actual,
    fetchContestLeaderboard: fetchHRMock,
  };
});

vi.mock('@/lib/leaderboard/publish', () => ({
  createCompetitionSnapshot: publishSnapshotMock,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('next/server', () => ({ connection: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  forbidden: vi.fn(() => {
    throw new Error('FORBIDDEN:403');
  }),
  unauthorized: vi.fn(() => {
    throw new Error('UNAUTHORIZED:401');
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

function setupLabSession(
  setRow: Record<string, unknown>,
  lastUpload: Record<string, unknown> | null = null,
) {
  const userId = crypto.randomUUID();
  const readProfile = {
    single: async () => ({
      data: {
        name: 'Lab Admin User',
        email: 'lab@codeclash.com',
        role: 'MASTER_LAB_ADMIN',
        account_status: 'ACTIVE',
      },
    }),
  };

  const from = vi.fn((table: string) => {
    if (table === 'users') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(readProfile),
          }),
        }),
      };
    }
    if (table === 'contest_sets') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: async () => ({ data: setRow, error: null }),
          }),
        }),
      };
    }
    if (table === 'uploads') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: async () => ({ data: lastUpload, error: null }),
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
            neq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      };
    }
    return {};
  });

  sessionClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    from,
  });

  const contestSetsUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const uploadsInsertSingle = vi.fn().mockResolvedValue({
    data: { upload_id: crypto.randomUUID() },
    error: null,
  });
  const uploadsInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: uploadsInsertSingle }),
  });
  const uploadsUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });
  const participantsInsertSelect = vi.fn().mockResolvedValue({
    data: [{ participant_id: crypto.randomUUID(), external_id: 'alice' }],
    error: null,
  });

  serviceClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'contest_sets') {
        return {
          update: contestSetsUpdate,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ set_id: setRow.set_id, uploads: [{ status: 'PENDING_APPROVAL' }] }],
            }),
          }),
        };
      }
      if (table === 'uploads') return { insert: uploadsInsert, update: uploadsUpdate };
      if (table === 'participants') {
        return {
          insert: vi.fn().mockReturnValue({ select: participantsInsertSelect }),
        };
      }
      if (table === 'results') return { insert: vi.fn().mockResolvedValue({ error: null }) };
      if (table === 'competitions') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ error: null }),
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === 'audit_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    }),
  });

  return { contestSetsUpdate, uploadsInsert };
}

describe('Lab Admin One-Time Approval & Auto-Sync Workflow', () => {
  it('requires Lab In-Charge Name before requesting approval', async () => {
    const setId = crypto.randomUUID();
    const compId = crypto.randomUUID();
    setupLabSession({
      set_id: setId,
      competition_id: compId,
      set_name: 'Set A',
      hackerrank_slug: 'ccfinal',
      lab_incharge_name: null,
      auto_sync_status: 'PENDING',
      competitions: { status: 'NOT_STARTED' },
    });

    const res = await syncContestSetFromHackerRank(setId, 'ccfinal', undefined, '   ', { isRequest: true });
    expect(res.error).toMatch(/Lab In-Charge Name is required/i);
    expect(fetchHRMock).not.toHaveBeenCalled();
  });

  it('stages PENDING_APPROVAL without auto-publishing when auto_sync_status is PENDING', async () => {
    const setId = crypto.randomUUID();
    const compId = crypto.randomUUID();
    const { uploadsInsert } = setupLabSession({
      set_id: setId,
      competition_id: compId,
      set_name: 'Set A',
      hackerrank_slug: 'ccfinal',
      lab_incharge_name: 'Prof. Kumar',
      auto_sync_status: 'PENDING',
      competitions: { status: 'NOT_STARTED' },
    });

    fetchHRMock.mockResolvedValue({
      entries: [{ rank: 1, hacker: 'alice', score: 100, time_taken: 120, solved_challenges: 1 }],
      total: 1,
      slug: 'ccfinal',
    });

    const res = await syncContestSetFromHackerRank(setId, 'ccfinal', undefined, 'Prof. Kumar', { isRequest: true });
    expect(res.success).toBe(true);
    expect(res.pendingApproval).toBe(true);
    expect(res.autoPublished).toBe(false);
    expect(uploadsInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING_APPROVAL' }));
    expect(publishSnapshotMock).not.toHaveBeenCalled();
  });

  it('auto-approves and publishes live leaderboard when auto_sync_status is APPROVED', async () => {
    const setId = crypto.randomUUID();
    const compId = crypto.randomUUID();
    const superAdminId = crypto.randomUUID();
    const { uploadsInsert } = setupLabSession({
      set_id: setId,
      competition_id: compId,
      set_name: 'Set A',
      hackerrank_slug: 'ccfinal',
      lab_incharge_name: 'Prof. Kumar',
      auto_sync_status: 'APPROVED',
      auto_sync_approved_by: superAdminId,
      competitions: { status: 'PUBLISHED' },
    });

    fetchHRMock.mockResolvedValue({
      entries: [{ rank: 1, hacker: 'alice', score: 150, time_taken: 140, solved_challenges: 2 }],
      total: 1,
      slug: 'ccfinal',
    });
    publishSnapshotMock.mockResolvedValue({
      success: true,
      data: { snapshot_id: crypto.randomUUID(), version: 2, total_entries: 1 },
    });

    const res = await syncContestSetFromHackerRank(setId, 'ccfinal', undefined, 'Prof. Kumar');
    expect(res.success).toBe(true);
    expect(res.autoPublished).toBe(true);
    expect(uploadsInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'APPROVED' }));
    expect(publishSnapshotMock).toHaveBeenCalledWith(compId, superAdminId, {
      publishImmediately: true,
      auditAction: 'LEADERBOARD_AUTO_PUBLISHED',
    });
  });

  it('halts background ticks when Super Admin cancelled/rejected, and resets to PENDING on explicit re-request', async () => {
    const setId = crypto.randomUUID();
    const compId = crypto.randomUUID();
    const { contestSetsUpdate } = setupLabSession({
      set_id: setId,
      competition_id: compId,
      set_name: 'Set A',
      hackerrank_slug: 'ccfinal',
      lab_incharge_name: 'Prof. Kumar',
      auto_sync_status: 'REJECTED',
      auto_sync_rejection_reason: 'Wrong slug configured',
      competitions: { status: 'NOT_STARTED' },
    });

    const tickRes = await syncContestSetFromHackerRank(setId, 'ccfinal', undefined, 'Prof. Kumar');
    expect(tickRes.rejected).toBe(true);
    expect(tickRes.error).toMatch(/Wrong slug configured/i);
    expect(fetchHRMock).not.toHaveBeenCalled();

    fetchHRMock.mockResolvedValue({
      entries: [{ rank: 1, hacker: 'alice', score: 100, time_taken: 120, solved_challenges: 1 }],
      total: 1,
      slug: 'ccfinal',
    });

    const reRequestRes = await syncContestSetFromHackerRank(
      setId,
      'ccfinal',
      undefined,
      'Prof. Kumar',
      { isRequest: true },
    );
    expect(reRequestRes.success).toBe(true);
    expect(reRequestRes.pendingApproval).toBe(true);
    expect(contestSetsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ auto_sync_status: 'PENDING', auto_sync_rejection_reason: null }),
    );
  });

  it('resets auto_sync_status to PENDING when slug is changed after approval', async () => {
    const setId = crypto.randomUUID();
    const compId = crypto.randomUUID();
    const { contestSetsUpdate } = setupLabSession({
      set_id: setId,
      competition_id: compId,
      set_name: 'Set A',
      hackerrank_slug: 'old-slug',
      lab_incharge_name: 'Prof. Kumar',
      auto_sync_status: 'APPROVED',
      auto_sync_approved_by: crypto.randomUUID(),
      competitions: { status: 'PUBLISHED' },
    });

    fetchHRMock.mockResolvedValue({
      entries: [{ rank: 1, hacker: 'alice', score: 100, time_taken: 120, solved_challenges: 1 }],
      total: 1,
      slug: 'new-slug',
    });

    const res = await syncContestSetFromHackerRank(setId, 'new-slug', undefined, 'Prof. Kumar');
    expect(res.success).toBe(true);
    expect(res.pendingApproval).toBe(true);
    expect(contestSetsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ hackerrank_slug: 'new-slug', auto_sync_status: 'PENDING' }),
    );
    expect(publishSnapshotMock).not.toHaveBeenCalled();
  });
});
