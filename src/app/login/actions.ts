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
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', authData.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { error: 'User profile not found. Please contact the administrator.' };
  }

  if (profile.account_status !== 'ACTIVE') {
    await supabase.auth.signOut();
    return { error: 'Your account is currently inactive. Contact the Competition Administrator.' };
  }

  revalidatePath('/', 'layout');

  // 3. Route according to user role
  if (profile.role === 'COMPETITION_ADMIN') {
    redirect('/admin');
  } else if (profile.role === 'LAB_ADMIN') {
    redirect('/lab-admin');
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
