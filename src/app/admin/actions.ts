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

/**
 * 4. Approve a lab upload submission
 */
export async function approveUpload(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const admin = await getCompetitionAdmin();
  if (!admin) return permissionError;
  const { user } = admin;

  const upload_id = formData.get('upload_id') as string;
  const competition_id = formData.get('competition_id') as string;

  if (!upload_id) {
    return { error: 'Upload ID is required.' };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('uploads')
    .update({
      status: 'APPROVED',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('upload_id', upload_id);

  if (error) {
    return { error: error.message };
  }

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'UPLOAD_APPROVED',
    entity_type: 'upload',
    entity_id: upload_id,
    metadata: { competition_id },
  });

  if (competition_id) {
    revalidatePath(`/admin/competitions/${competition_id}`);
  }
  revalidatePath('/admin/competitions');
  revalidatePath('/admin');
  return { success: true };
}

/**
 * 5. Reject a lab upload submission with a mandatory reason
 */
export async function rejectUpload(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const admin = await getCompetitionAdmin();
  if (!admin) return permissionError;
  const { user } = admin;

  const upload_id = formData.get('upload_id') as string;
  const competition_id = formData.get('competition_id') as string;
  const rejection_reason = (formData.get('rejection_reason') as string)?.trim();

  if (!upload_id) {
    return { error: 'Upload ID is required.' };
  }
  if (!rejection_reason) {
    return { error: 'Please provide a reason for rejecting this submission.' };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('uploads')
    .update({
      status: 'REJECTED',
      rejection_reason,
      approved_by: null,
      approved_at: null,
    })
    .eq('upload_id', upload_id);

  if (error) {
    return { error: error.message };
  }

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'UPLOAD_REJECTED',
    entity_type: 'upload',
    entity_id: upload_id,
    metadata: { competition_id, rejection_reason },
  });

  if (competition_id) {
    revalidatePath(`/admin/competitions/${competition_id}`);
  }
  revalidatePath('/admin/competitions');
  revalidatePath('/admin');
  return { success: true };
}

/**
 * 6. Consolidate approved lab records and generate a DRAFT Leaderboard Snapshot
 */
export async function consolidateLeaderboard(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const admin = await getCompetitionAdmin();
  if (!admin) return permissionError;
  const { user } = admin;

  const competition_id = formData.get('competition_id') as string;
  if (!competition_id) {
    return { error: 'Competition ID is required.' };
  }

  const adminClient = createAdminClient();

  // Fetch competition details
  const { data: comp, error: compErr } = await adminClient
    .from('competitions')
    .select('*')
    .eq('competition_id', competition_id)
    .single();

  if (compErr || !comp) {
    return { error: 'Competition not found.' };
  }

  // Fetch all active labs
  const { data: labs, error: labsErr } = await adminClient
    .from('labs')
    .select('lab_id, lab_name')
    .eq('competition_id', competition_id)
    .eq('status', 'ACTIVE');

  if (labsErr || !labs || labs.length === 0) {
    return { error: 'No active labs found for this competition.' };
  }

  // Fetch approved uploads for each lab
  const labIds = labs.map((l) => l.lab_id);
  const { data: approvedUploads, error: uploadsErr } = await adminClient
    .from('uploads')
    .select('upload_id, lab_id, status')
    .eq('competition_id', competition_id)
    .in('lab_id', labIds)
    .eq('status', 'APPROVED');

  if (uploadsErr) return { error: uploadsErr.message };

  const approvedLabIds = new Set(approvedUploads?.map((u) => u.lab_id) || []);
  const unapprovedLabs = labs.filter((l) => !approvedLabIds.has(l.lab_id));

  if (unapprovedLabs.length > 0) {
    return {
      error: `Cannot consolidate: ${unapprovedLabs.length} lab(s) [${unapprovedLabs
        .map((l) => l.lab_name)
        .join(', ')}] do not have an approved submission.`,
    };
  }

  const approvedUploadIds = (approvedUploads || []).map((u) => u.upload_id);

  // Fetch all results from approved uploads
  const { data: results, error: resultsErr } = await adminClient
    .from('results')
    .select('result_id, total_score, problems_solved, penalty, final_submission_time, lab_id, participant_id')
    .in('upload_id', approvedUploadIds);

  if (resultsErr) return { error: resultsErr.message };
  if (!results || results.length === 0) {
    return { error: 'No participant records found in approved uploads.' };
  }

  // Tie-breaking & ranking logic
  // 1. total_score descending
  // 2. problems_solved descending
  // 3. penalty ascending (nulls last)
  // 4. final_submission_time ascending (nulls last)
  const sorted = [...results].sort((a, b) => {
    if (b.total_score !== a.total_score) {
      return Number(b.total_score) - Number(a.total_score);
    }
    if (b.problems_solved !== a.problems_solved) {
      return b.problems_solved - a.problems_solved;
    }
    const penA = a.penalty !== null ? Number(a.penalty) : Infinity;
    const penB = b.penalty !== null ? Number(b.penalty) : Infinity;
    if (penA !== penB) {
      return penA - penB;
    }
    if (a.final_submission_time && b.final_submission_time) {
      return new Date(a.final_submission_time).getTime() - new Date(b.final_submission_time).getTime();
    }
    return 0;
  });

  // Calculate shared ranks
  const topK = comp.top_k || 10;
  const boundaryPolicy = comp.scoring_config?.boundary_policy || 'ADMIT_ALL';

  type RankedItem = (typeof sorted)[number] & {
    rank: number;
    is_qualified: boolean;
  };

  const ranked: RankedItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    let rank = i + 1;

    if (i > 0) {
      const prev = sorted[i - 1];
      const sameScore = Number(current.total_score) === Number(prev.total_score);
      const sameSolved = current.problems_solved === prev.problems_solved;
      const samePenalty = current.penalty === prev.penalty;
      if (sameScore && sameSolved && samePenalty) {
        rank = ranked[i - 1].rank;
      }
    }

    let is_qualified = false;
    if (boundaryPolicy === 'ADMIT_ALL') {
      is_qualified = rank <= topK;
    } else {
      is_qualified = i < topK;
    }

    ranked.push({
      ...current,
      rank,
      is_qualified,
    });
  }

  // Manage leaderboard snapshot
  // If an existing DRAFT snapshot exists, clean out its entries
  const { data: existingDraft } = await adminClient
    .from('leaderboard_snapshots')
    .select('leaderboard_id, version')
    .eq('competition_id', competition_id)
    .eq('status', 'DRAFT')
    .maybeSingle();

  let targetSnapshotId = existingDraft?.leaderboard_id;

  if (targetSnapshotId) {
    // Delete old entries
    await adminClient
      .from('leaderboard_entries')
      .delete()
      .eq('leaderboard_id', targetSnapshotId);

    // Update snapshot generated_at
    await adminClient
      .from('leaderboard_snapshots')
      .update({ generated_at: new Date().toISOString() })
      .eq('leaderboard_id', targetSnapshotId);
  } else {
    // Determine new version
    const { data: allSnapshots } = await adminClient
      .from('leaderboard_snapshots')
      .select('version')
      .eq('competition_id', competition_id);

    const maxVersion = allSnapshots && allSnapshots.length > 0
      ? Math.max(...allSnapshots.map((s) => s.version))
      : 0;

    const { data: newSnapshot, error: snapErr } = await adminClient
      .from('leaderboard_snapshots')
      .insert({
        competition_id,
        version: maxVersion + 1,
        status: 'DRAFT',
        generated_at: new Date().toISOString(),
      })
      .select('leaderboard_id')
      .single();

    if (snapErr || !newSnapshot) {
      return { error: snapErr?.message || 'Failed to create leaderboard snapshot.' };
    }
    targetSnapshotId = newSnapshot.leaderboard_id;
  }

  // Insert all leaderboard entries
  const entriesToInsert = ranked.map((r) => ({
    leaderboard_id: targetSnapshotId!,
    participant_id: r.participant_id,
    lab_id: r.lab_id,
    overall_rank: r.rank,
    total_score: r.total_score,
    problems_solved: r.problems_solved,
    penalty: r.penalty,
    is_qualified: r.is_qualified,
  }));

  const { error: entriesErr } = await adminClient
    .from('leaderboard_entries')
    .insert(entriesToInsert);

  if (entriesErr) {
    return { error: entriesErr.message };
  }

  // Transition competition status to READY_FOR_REVIEW
  await adminClient
    .from('competitions')
    .update({ status: 'READY_FOR_REVIEW' })
    .eq('competition_id', competition_id);

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'LEADERBOARD_CONSOLIDATED',
    entity_type: 'leaderboard_snapshot',
    entity_id: targetSnapshotId!,
    metadata: {
      competition_id,
      total_entries: entriesToInsert.length,
      top_k: topK,
    },
  });

  revalidatePath(`/admin/competitions/${competition_id}`);
  revalidatePath('/admin/competitions');
  revalidatePath('/admin');
  revalidatePath('/leaderboard');
  revalidatePath(`/competitions/${comp.slug}/leaderboard`);
  return { success: true, data: { count: entriesToInsert.length } };
}

/**
 * 7. Publish the official leaderboard snapshot
 */
export async function publishLeaderboard(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const admin = await getCompetitionAdmin();
  if (!admin) return permissionError;
  const { user } = admin;

  const competition_id = formData.get('competition_id') as string;
  if (!competition_id) {
    return { error: 'Competition ID is required.' };
  }

  const adminClient = createAdminClient();

  const { data: comp } = await adminClient
    .from('competitions')
    .select('slug, competition_name')
    .eq('competition_id', competition_id)
    .single();

  if (!comp) return { error: 'Competition not found.' };

  // Find latest DRAFT snapshot
  const { data: draftSnapshot, error: draftErr } = await adminClient
    .from('leaderboard_snapshots')
    .select('leaderboard_id, version')
    .eq('competition_id', competition_id)
    .eq('status', 'DRAFT')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftErr || !draftSnapshot) {
    return { error: 'No draft leaderboard snapshot found. Consolidate results first.' };
  }

  // Supersede any previously published snapshot
  await adminClient
    .from('leaderboard_snapshots')
    .update({ status: 'SUPERSEDED' })
    .eq('competition_id', competition_id)
    .eq('status', 'PUBLISHED');

  // Mark this snapshot as PUBLISHED
  const { error: pubErr } = await adminClient
    .from('leaderboard_snapshots')
    .update({
      status: 'PUBLISHED',
      published_at: new Date().toISOString(),
      published_by: user.id,
    })
    .eq('leaderboard_id', draftSnapshot.leaderboard_id);

  if (pubErr) return { error: pubErr.message };

  // Set competition status to PUBLISHED
  await adminClient
    .from('competitions')
    .update({ status: 'PUBLISHED' })
    .eq('competition_id', competition_id);

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'LEADERBOARD_PUBLISHED',
    entity_type: 'leaderboard_snapshot',
    entity_id: draftSnapshot.leaderboard_id,
    metadata: {
      competition_id,
      version: draftSnapshot.version,
    },
  });

  revalidatePath(`/admin/competitions/${competition_id}`);
  revalidatePath('/admin/competitions');
  revalidatePath('/admin');
  revalidatePath('/leaderboard');
  revalidatePath(`/competitions/${comp.slug}/leaderboard`);
  return { success: true, data: { version: draftSnapshot.version } };
}

/**
 * 8. Fetch upload review details (upload metadata, sample records, validation issues)
 */
export async function getUploadReviewData(uploadId: string) {
  const admin = await getCompetitionAdmin();
  if (!admin) return { error: 'An active competition administrator account is required.' };

  const adminClient = createAdminClient();

  const { data: upload, error: uploadErr } = await adminClient
    .from('uploads')
    .select('*, labs(lab_id, lab_name), users!uploads_uploaded_by_fkey(name, email)')
    .eq('upload_id', uploadId)
    .single();

  if (uploadErr || !upload) return { error: 'Upload submission not found.' };

  const { data: results } = await adminClient
    .from('results')
    .select('result_id, total_score, problems_solved, penalty, participants(participant_id, external_participant_id, participant_name)')
    .eq('upload_id', uploadId)
    .order('total_score', { ascending: false })
    .limit(50);

  const { data: issues } = await adminClient
    .from('validation_issues')
    .select('*')
    .eq('upload_id', uploadId)
    .order('row_number', { ascending: true });

  return {
    success: true,
    data: {
      upload,
      results: results || [],
      issues: issues || [],
    },
  };
}
