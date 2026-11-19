import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCompetition, createLab, createLabAdmin } from '@/app/admin/actions';

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

function mockSession(role: string, status: string) {
  const readProfile = { maybeSingle: async () => ({ data: { role, account_status: status } }) };
  const filter = vi.fn().mockReturnValue(readProfile);
  const from = vi.fn().mockReturnValue({ select: () => ({ eq: filter }) });
  sessionClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } } }) },
    from,
  });
  return { from, filter };
}

describe.each([
  ['LAB_ADMIN', 'ACTIVE'],
  ['COMPETITION_ADMIN', 'INACTIVE'],
])('%s with status %s', (role, status) => {
  it.each([createCompetition, createLab, createLabAdmin])('denies %s before any mutation', async (action) => {
    const { from, filter } = mockSession(role, status);
    const result = await action({}, new FormData());
    expect(result.error).toBe('An active competition administrator account is required.');
    expect(from.mock.calls).toEqual([['users']]);
    expect(filter).toHaveBeenCalledWith('user_id', 'test-user');
    expect(serviceClient).not.toHaveBeenCalled();
  });
});

it('allows an active competition admin through to form validation', async () => {
  mockSession('COMPETITION_ADMIN', 'ACTIVE');
  expect((await createLabAdmin({}, new FormData())).error).toBe('Name, email, and password are required.');
});
