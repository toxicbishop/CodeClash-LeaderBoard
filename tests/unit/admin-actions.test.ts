import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCompetition,
  createContestSet,
  deleteContestSet,
  deleteCompetition,
  deleteUser,
  toggleUserStatus,
  assignLabAdminName,
  approveContestSetAutoSync,
  rejectContestSetAutoSync,
  approveUpload,
  rejectUpload,
  generateLeaderboard,
  publishLeaderboard,
  endLeaderboard,
} from '@/app/admin/actions';

const { sessionClient, serviceClient } = vi.hoisted(() => ({
  sessionClient: vi.fn(),
  serviceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: sessionClient,
  createAdminClient: serviceClient,
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

beforeEach(() => vi.resetAllMocks());

function mockSession(role: string, status: string) {
  const readProfile = {
    single: async () => ({
      name: 'Test User',
      email: 'test@codeclash.com',
      role,
      account_status: status,
    }),
  };
  const filterStatus = vi.fn().mockReturnValue(readProfile);
  const filterId = vi.fn().mockReturnValue({ eq: filterStatus });
  const select = vi.fn().mockReturnValue({ eq: filterId });
  const from = vi.fn().mockReturnValue({ select });

  sessionClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user-id' } } }) },
    from,
  });

  return { from, select, filterId, filterStatus };
}

describe('Super Admin role protection', () => {
  it.each([
    ['MASTER_LAB_ADMIN', 'ACTIVE'],
    ['HOD', 'ACTIVE'],
    ['PRINCIPAL', 'ACTIVE'],
    ['SUPER_ADMIN', 'INACTIVE'],
  ])('denies %s with status %s via HTTP 403 forbidden', async (role, status) => {
    mockSession(role, status);

    await expect(approveUpload('some-upload-id')).rejects.toThrow('FORBIDDEN:403');
    await expect(rejectUpload('some-upload-id', 'test')).rejects.toThrow('FORBIDDEN:403');
    await expect(generateLeaderboard('comp-id')).rejects.toThrow('FORBIDDEN:403');
    await expect(publishLeaderboard('snap-id')).rejects.toThrow('FORBIDDEN:403');
    await expect(endLeaderboard('comp-id')).rejects.toThrow('FORBIDDEN:403');
    await expect(deleteCompetition('comp-id')).rejects.toThrow('FORBIDDEN:403');
    await expect(deleteUser('user-id')).rejects.toThrow('FORBIDDEN:403');
    await expect(toggleUserStatus('user-id', 'INACTIVE')).rejects.toThrow('FORBIDDEN:403');

    const fd = new FormData();
    await expect(createCompetition(fd)).rejects.toThrow('FORBIDDEN:403');
    await expect(createContestSet(fd)).rejects.toThrow('FORBIDDEN:403');
    await expect(deleteContestSet('set-id')).rejects.toThrow('FORBIDDEN:403');
    await expect(assignLabAdminName('user-id', 'Lab Lead')).rejects.toThrow('FORBIDDEN:403');
    await expect(approveContestSetAutoSync('set-id')).rejects.toThrow('FORBIDDEN:403');
    await expect(rejectContestSetAutoSync('set-id', 'no')).rejects.toThrow('FORBIDDEN:403');
  });

  it('denies unauthenticated callers via HTTP 401 unauthorized', async () => {
    sessionClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
      from: vi.fn(),
    });

    await expect(approveUpload('some-upload-id')).rejects.toThrow('UNAUTHORIZED:401');
    await expect(deleteCompetition('comp-id')).rejects.toThrow('UNAUTHORIZED:401');
    await expect(deleteContestSet('set-id')).rejects.toThrow('UNAUTHORIZED:401');
  });
});

describe('Competition and Contest Set validation & duplicate handling', () => {
  function mockSuperAdminSession(extraTables: Record<string, unknown> = {}) {
    const readProfile = {
      single: async () => ({
        data: {
          name: 'Super Admin',
          email: 'admin@codeclash.com',
          role: 'SUPER_ADMIN',
          account_status: 'ACTIVE',
        },
      }),
    };
    const filterStatus = vi.fn().mockReturnValue(readProfile);
    const filterId = vi.fn().mockReturnValue({ eq: filterStatus });
    const select = vi.fn().mockReturnValue({ eq: filterId });
    const from = vi.fn((table: string) => {
      if (table in extraTables) return extraTables[table];
      return { select };
    });

    sessionClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'test-user-id' } } }) },
      from,
    });
  }

  it('returns an inline error instead of throwing on duplicate competition slug', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "competitions_slug_key"',
      },
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    mockSuperAdminSession({ competitions: { insert } });

    const fd = new FormData();
    fd.set('competition_name', 'Code Clash 2026');
    fd.set('contest_date', '2026-11-26');
    fd.set('top_k', '10');

    const res = await createCompetition(fd);
    expect(res.error).toMatch(/slug "code-clash-2026" already exists/i);
  });

  it('returns an inline error on duplicate contest set code and extracts HackerRank URLs', async () => {
    const insertMock = vi.fn().mockResolvedValue({
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "contest_sets_competition_id_set_code_key"',
      },
    });

    mockSuperAdminSession({ contest_sets: { insert: insertMock } });

    const fd = new FormData();
    fd.set('competition_id', crypto.randomUUID());
    fd.set('set_name', 'Set A');
    fd.set('set_code', 'setA');
    fd.set('hackerrank_slug', 'https://www.hackerrank.com/contests/friends-contest/leaderboard');

    const res = await createContestSet(fd);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        set_code: 'seta',
        hackerrank_slug: 'friends-contest',
      }),
    );
    expect(res.error).toMatch(/code "seta" already exists/i);
  });

  it('returns an inline error for non-HackerRank URLs in createContestSet', async () => {
    mockSuperAdminSession();

    const fd = new FormData();
    fd.set('competition_id', crypto.randomUUID());
    fd.set('set_name', 'Set B');
    fd.set('set_code', 'setB');
    fd.set('hackerrank_slug', 'https://evil.example.com/contests/hack');

    const res = await createContestSet(fd);
    expect(res.error).toMatch(/Invalid HackerRank slug/i);
  });

  it('creates multiple round rows with shared set code and optional session cookie', async () => {
    const compId = crypto.randomUUID();
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    mockSuperAdminSession({ contest_sets: { insert: insertMock } });
    serviceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'audit_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        return {};
      }),
    });

    const fd = new FormData();
    fd.set('competition_id', compId);
    fd.set('set_name', 'Set A');
    fd.set('set_code', 'setA');
    fd.set('rounds_count', '3');
    fd.set('round_slug_1', 'cc-r1-seta');
    fd.set('round_slug_2', 'https://www.hackerrank.com/contests/cc-r2-seta/leaderboard');
    fd.set('round_slug_3', 'cc-r3-seta');

    await expect(createContestSet(fd)).rejects.toThrow(`REDIRECT:/admin/competitions/${compId}`);

    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        competition_id: compId,
        round_number: 1,
        set_name: 'Set A',
        set_code: 'seta',
        hackerrank_slug: 'cc-r1-seta',
      }),
      expect.objectContaining({
        competition_id: compId,
        round_number: 2,
        set_name: 'Set A',
        set_code: 'seta',
        hackerrank_slug: 'cc-r2-seta',
      }),
      expect.objectContaining({
        competition_id: compId,
        round_number: 3,
        set_name: 'Set A',
        set_code: 'seta',
        hackerrank_slug: 'cc-r3-seta',
      }),
    ]);
  });

  it('requires a non-empty name and updates MASTER_LAB_ADMIN name in assignLabAdminName', async () => {
    const labUserId = crypto.randomUUID();
    mockSuperAdminSession();
    const blankRes = await assignLabAdminName(labUserId, '   ');
    expect(blankRes.error).toMatch(/Lab Admin Name is required/i);

    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: labUserId,
        name: 'Old Name',
        email: 'lab@codeclash.com',
        role: 'MASTER_LAB_ADMIN',
      },
      error: null,
    });
    const selectEq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq: selectEq });
    const auditInsert = vi.fn().mockResolvedValue({ error: null });

    serviceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'users') return { select, update };
        if (table === 'audit_logs') return { insert: auditInsert };
        return {};
      }),
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    });

    const okRes = await assignLabAdminName(labUserId, 'Prof. Sharma');
    expect(okRes.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ name: 'Prof. Sharma' });
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LAB_ADMIN_NAME_ASSIGNED' }),
    );
  });

  it('allows approving and rejecting PENDING_APPROVAL uploads even when competition is PUBLISHED', async () => {
    const uploadId = crypto.randomUUID();
    const setId = crypto.randomUUID();
    const compId = crypto.randomUUID();

    const uploadMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        upload_id: uploadId,
        set_id: setId,
        competition_id: compId,
        status: 'PENDING_APPROVAL',
      },
      error: null,
    });

    mockSuperAdminSession({
      uploads: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: uploadMaybeSingle }),
        }),
      },
    });

    const uploadsUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const uploadsUpdateChain = {
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    };
    const uploadsUpdate = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      if (payload.status === 'SUPERSEDED') return uploadsUpdateChain;
      return { eq: uploadsUpdateEq };
    });

    const compNeq = vi.fn().mockResolvedValue({ error: null });
    const compEq = vi.fn().mockReturnValue({ neq: compNeq });
    const compUpdate = vi.fn().mockReturnValue({ eq: compEq });

    serviceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'uploads') return { update: uploadsUpdate };
        if (table === 'contest_sets') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ set_id: setId, uploads: [{ status: 'APPROVED' }] }],
              }),
            }),
          };
        }
        if (table === 'competitions') return { update: compUpdate };
        if (table === 'audit_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) };
        return {};
      }),
    });

    const approveRes = await approveUpload(uploadId);
    expect(approveRes.success).toBe(true);
    expect(compNeq).toHaveBeenCalledWith('status', 'PUBLISHED');

    const rejectRes = await rejectUpload(uploadId, 'Needs re-sync');
    expect(rejectRes.success).toBe(true);
  });
});
