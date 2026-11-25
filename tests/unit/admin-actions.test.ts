import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCompetition,
  createContestSet,
  deleteCompetition,
  deleteUser,
  toggleUserStatus,
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

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', () => ({ connection: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
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
  ])('denies %s with status %s by redirecting to /', async (role, status) => {
    mockSession(role, status);

    await expect(approveUpload('some-upload-id')).rejects.toThrow('REDIRECT:/');
    await expect(rejectUpload('some-upload-id', 'test')).rejects.toThrow('REDIRECT:/');
    await expect(generateLeaderboard('comp-id')).rejects.toThrow('REDIRECT:/');
    await expect(publishLeaderboard('snap-id')).rejects.toThrow('REDIRECT:/');
    await expect(endLeaderboard('comp-id')).rejects.toThrow('REDIRECT:/');
    await expect(deleteCompetition('comp-id')).rejects.toThrow('REDIRECT:/');
    await expect(deleteUser('user-id')).rejects.toThrow('REDIRECT:/');
    await expect(toggleUserStatus('user-id', 'INACTIVE')).rejects.toThrow('REDIRECT:/');

    const fd = new FormData();
    await expect(createCompetition(fd)).rejects.toThrow('REDIRECT:/');
    await expect(createContestSet(fd)).rejects.toThrow('REDIRECT:/');
  });
});
