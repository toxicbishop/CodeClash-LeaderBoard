'use server';

import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/security/rate-limit';

export type ActionState = {
  error: string | null;
};

export async function login(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please provide both email and password.' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Rate limiting: max 5 login attempts per 60 seconds per email
  const rateLimit = checkRateLimit('login', normalizedEmail, 5, 60000);
  if (!rateLimit.success) {
    return { error: 'Too many login attempts. Please wait a moment and try again.' };
  }

  const supabase = await createClient();

  // 1. Sign in with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (authError || !authData.user) {
    try {
      const adminClient = createAdminClient();
      await adminClient.from('audit_logs').insert({
        action: 'LOGIN_FAILED',
        entity_type: 'user',
        details: { email: normalizedEmail, reason: 'Invalid credentials' },
      });
    } catch {
      // Best-effort audit logging
    }
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

  // Audit log for successful login (never include password or secrets)
  try {
    const adminClient = createAdminClient();
    await adminClient.from('audit_logs').insert({
      user_id: authData.user.id,
      action: 'USER_LOGIN',
      entity_type: 'user',
      entity_id: authData.user.id,
      details: { role: profile.role },
    });
  } catch {
    // Best-effort audit logging
  }

  // 3. Route according to v2 user role — redirect() throws internally; must be outside try/catch
  if (profile.role === 'SUPER_ADMIN') {
    redirect('/admin');
  } else if (profile.role === 'MASTER_LAB_ADMIN') {
    redirect('/upload');
  } else if (profile.role === 'HOD' || profile.role === 'PRINCIPAL') {
    redirect('/leaderboard');
  } else {
    redirect('/');
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
