'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { CompetitionStatus, CompetitionVisibility } from '@/types/database';

export type ActionResponse = {
  success?: boolean;
  error?: string | null;
  data?: unknown;
};

const permissionError = { error: 'An active competition administrator account is required.' };

async function getCompetitionAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'COMPETITION_ADMIN' || profile.account_status !== 'ACTIVE') return null;
  return { supabase, user };
}

/**
 * 1. Create a new Competition
 */
export async function createCompetition(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const admin = await getCompetitionAdmin();
  if (!admin) return permissionError;
  const { supabase, user } = admin;

  const competition_name = (formData.get('competition_name') as string)?.trim();
  const slug = (formData.get('slug') as string)?.trim().toLowerCase();
  const description = (formData.get('description') as string)?.trim() || null;
  const contest_date = formData.get('contest_date') as string;
  const upload_deadline = formData.get('upload_deadline') as string;
  const top_k_raw = formData.get('top_k') as string;
  const boundary_policy = (formData.get('boundary_policy') as string) || 'ADMIT_ALL';
  const visibility = (formData.get('visibility') as CompetitionVisibility) || 'PUBLIC';

  if (!competition_name || !slug || !contest_date || !upload_deadline) {
    return { error: 'Please provide all required fields (Name, Slug, Date, Deadline).' };
  }

  const top_k = parseInt(top_k_raw || '10', 10);
  if (isNaN(top_k) || top_k <= 0) {
    return { error: 'Top-K must be a positive integer.' };
  }

  const scoring_config = {
    tiebreakers: ['problems_solved_desc', 'penalty_asc', 'final_submission_time_asc'],
    boundary_policy: boundary_policy as 'ADMIT_ALL' | 'STRICT_CUTOFF',
  };

  const { data, error } = await supabase
    .from('competitions')
    .insert({
      competition_name,
      slug,
      description,
      contest_date,
      upload_deadline: new Date(upload_deadline).toISOString(),
      top_k,
      scoring_config,
      status: 'AWAITING_UPLOAD' as CompetitionStatus,
      visibility,
      created_by: user.id,
    })
    .select('competition_id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: `The URL slug "${slug}" is already in use. Please choose a unique slug.` };
    }
    return { error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/competitions');
  return { success: true, data };
}

/**
 * 2. Provision a new Lab Administrator account
 * Uses createAdminClient (service role) to bypass email verification
 */
export async function createLabAdmin(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  if (!(await getCompetitionAdmin())) return permissionError;

  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { error: 'Name, email, and password are required.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }

  const adminClient = createAdminClient();

  // Create user in Supabase Auth directly with confirmed email
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      role: 'LAB_ADMIN',
    },
  });

  if (authError || !authData.user) {
    return { error: authError?.message || 'Failed to create user in Auth.' };
  }

  // Insert profile into public.users
  const { error: profileError } = await adminClient.from('users').insert({
    user_id: authData.user.id,
    name,
    email,
    role: 'LAB_ADMIN',
    account_status: 'ACTIVE',
  });

  if (profileError) {
    // Cleanup auth user if profile insert fails
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return { error: profileError.message };
  }

  revalidatePath('/admin/users');
  return { success: true, data: { user_id: authData.user.id, email, name } };
}

/**
 * 3. Add a Lab to a Competition and assign a Lab Administrator
 */
export async function createLab(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const admin = await getCompetitionAdmin();
  if (!admin) return permissionError;
  const { supabase } = admin;

  const competition_id = formData.get('competition_id') as string;
  const lab_name = (formData.get('lab_name') as string)?.trim();
  const assigned_admin_id = formData.get('assigned_admin_id') as string;

  if (!competition_id || !lab_name || !assigned_admin_id) {
    return { error: 'Please select a competition, lab name, and assigned administrator.' };
  }

  const { data, error } = await supabase
    .from('labs')
    .insert({
      competition_id,
      lab_name,
      assigned_admin_id,
      status: 'ACTIVE',
    })
    .select('lab_id')
    .single();

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('uq_lab_name_per_competition')) {
        return { error: `A lab named "${lab_name}" already exists in this competition.` };
      }
      if (error.message.includes('uq_admin_per_competition')) {
        return { error: 'This Lab Administrator is already assigned to another lab in this competition.' };
      }
    }
    return { error: error.message };
  }

  revalidatePath(`/admin/competitions/${competition_id}`);
  revalidatePath('/admin');
  return { success: true, data };
}
