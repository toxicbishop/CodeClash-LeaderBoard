/**
 * Shared auth guard utilities for server components and server actions.
 *
 * Before these guards existed, every page and action repeated ~30 lines of:
 *   await connection(); createClient(); getUser(); check role; check account_status; redirect()
 *
 * Now each route needs exactly one line.
 */

import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type AdminGuardResult = {
  user: { id: string };
  profile: { name: string; email: string; role: string; account_status: string };
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/**
 * requireCompetitionAdmin()
 *
 * Use at the top of any Server Component or server action that needs
 * an authenticated, active Competition Administrator. Redirects to / otherwise.
 *
 * @example
 *   const { user, profile, supabase } = await requireCompetitionAdmin();
 */
export async function requireCompetitionAdmin(): Promise<AdminGuardResult> {
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, role, account_status')
    .eq('user_id', user.id)
    .eq('account_status', 'ACTIVE')
    .single();

  if (profile?.role !== 'COMPETITION_ADMIN') redirect('/');

  return { user, profile, supabase };
}

/**
 * requireLabAdmin()
 *
 * Use at the top of any Server Component that needs an authenticated,
 * active Lab Admin (or Competition Admin, who can also view lab pages).
 *
 * @example
 *   const { user, profile, supabase } = await requireLabAdmin();
 */
export async function requireLabAdmin(): Promise<AdminGuardResult> {
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, role, account_status')
    .eq('user_id', user.id)
    .eq('account_status', 'ACTIVE')
    .single();

  if (profile?.role !== 'LAB_ADMIN' && profile?.role !== 'COMPETITION_ADMIN') redirect('/');

  return { user, profile, supabase };
}
