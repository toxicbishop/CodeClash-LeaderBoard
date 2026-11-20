import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitLeaderboard } from '@/app/lab-admin/submission-actions';

const { sessionClient, serviceClient } = vi.hoisted(() => ({
  sessionClient: vi.fn(),
  serviceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: sessionClient,
  createAdminClient: serviceClient,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

function mockSession(role: string, status: string, userId = 'lab-user-1') {
  sessionClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role, account_status: status } }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => null,
                }),
              }),
            }),
          }),
        }),
      };
    },
  });
}

describe('submitLeaderboard permission checks', () => {
  it('denies submission when user session is expired', async () => {
    sessionClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    });
    const result = await submitLeaderboard({ error: null, success: false }, new FormData());
    expect(result.error).toBe('Your session has expired. Please sign in again.');
  });

  it('denies submission when user is not an active LAB_ADMIN', async () => {
    mockSession('COMPETITION_ADMIN', 'ACTIVE');
    const result = await submitLeaderboard({ error: null, success: false }, new FormData());
    expect(result.error).toBe('An active lab administrator account is required.');
  });

  it('denies submission when account is INACTIVE', async () => {
    mockSession('LAB_ADMIN', 'INACTIVE');
    const result = await submitLeaderboard({ error: null, success: false }, new FormData());
    expect(result.error).toBe('An active lab administrator account is required.');
  });

  it('validates file presence and mapping parameters', async () => {
    mockSession('LAB_ADMIN', 'ACTIVE');
    const formData = new FormData();
    const result = await submitLeaderboard({ error: null, success: false }, formData);
    expect(result.error).toBe('Choose a valid CSV or XLSX file and complete the column mapping.');
  });
});
