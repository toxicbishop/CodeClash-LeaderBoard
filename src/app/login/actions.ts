'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ActionState = {
  error: string | null;
};

export async function login(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please provide both email and password.' };
  }

  const supabase = await createClient();

  // 1. Sign in with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { error: authError?.message || 'Invalid login credentials.' };
  }

  // 2. Fetch application profile to verify role and account status
  let profile: { role: string; account_status: string } | null = null;
  try {
    const { data, error: profileError } = await supabase
      .from('users')
      .select('role, account_status')
      .eq('user_id', authData.user.id)
      .single();

    if (profileError || !data) {
      await supabase.auth.signOut();
      return { error: 'User profile not found. Please contact the administrator.' };
    }
    profile = data;
  } catch (error) {
    await supabase.auth.signOut();
    const message = error instanceof Error ? error.message : '';
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) {
      return { error: 'Authentication service is unavailable. Start local Supabase/Docker and try again.' };
    }
    return { error: 'Unable to fetch user profile. Please try again.' };
  }

  if (profile.account_status !== 'ACTIVE') {
    await supabase.auth.signOut();
    return { error: 'Your account is currently inactive. Contact the Competition Administrator.' };
  }

  revalidatePath('/', 'layout');

  // 3. Route according to user role — redirect() throws internally; must be outside try/catch
  if (profile.role === 'SUPER_ADMIN' || profile.role === 'COMPETITION_ADMIN') {
    redirect('/admin');
  } else if (profile.role === 'MASTER_LAB_ADMIN' || profile.role === 'LAB_ADMIN') {
    redirect('/upload');
  } else if (profile.role === 'HOD' || profile.role === 'PRINCIPAL') {
    redirect('/monitor');
  } else {
    redirect('/');
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
