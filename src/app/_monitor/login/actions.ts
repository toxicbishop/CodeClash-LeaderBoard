'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type LoginActionState = {
  error?: string | null;
} | null;

export async function monitorLogin(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const email = (formData.get('email') as string)?.trim();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { error: 'Invalid credentials. Please verify your email and password.' };
  }

  // Check role
  const { data: profile } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', authData.user.id)
    .single();

  if (!profile || profile.account_status !== 'ACTIVE') {
    await supabase.auth.signOut();
    return { error: 'Account is inactive. Contact the competition administrator.' };
  }

  if (profile.role !== 'HOD' && profile.role !== 'PRINCIPAL' && profile.role !== 'SUPER_ADMIN') {
    await supabase.auth.signOut();
    return { error: 'Unauthorized. This portal is reserved for HOD and Principal monitoring.' };
  }

  redirect('/monitor');
}
