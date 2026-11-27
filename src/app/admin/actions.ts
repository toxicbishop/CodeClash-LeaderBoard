'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { createCompetitionSnapshot } from '@/lib/leaderboard/publish';
import { LEADERBOARD_CACHE_TAG } from '@/lib/leaderboard/cache';
import { extractContestSlug } from '@/lib/hackerrank/client';
import { isValidUuid } from '@/lib/validation/uuid';
import { isAllowedProvisionRole, validatePasswordPolicy, ALLOWED_PROVISION_ROLES } from '@/lib/security/password';
import { encryptSecret } from '@/lib/security/encryption';

export type ActionResponse = {
  success?: boolean;
  error?: string | null;
  data?: unknown;
};

// ---------------------------------------------------------------------------
// Competition management
// ---------------------------------------------------------------------------

export async function createCompetition(formData: FormData): Promise<ActionResponse> {
  const { supabase, user } = await requireSuperAdmin();

  const name = formData.get('competition_name') as string;
  const description = formData.get('description') as string | null;
  const contestDate = formData.get('contest_date') as string;
  const topK = parseInt(formData.get('top_k') as string, 10);

  if (!name?.trim() || !contestDate || isNaN(topK) || topK < 1) {
    return { error: 'Competition name, contest date, and a positive Top-K value are required.' };
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) {
    return { error: 'Competition name must include at least one letter or number.' };
  }

  const { data, error } = await supabase.from('competitions').insert({
    slug,
    competition_name: name.trim(),
    description: description?.trim() || null,
    contest_date: contestDate,
    top_k: topK,
    created_by: user.id,
  }).select('competition_id').single();

  if (error || !data) {
    if (error?.code === '23505' || error?.message?.includes('competitions_slug_key')) {
      return {
        error: `A competition with slug "${slug}" already exists. Choose a different name or manage the existing competition.`,
      };
    }
    return { error: error?.message || 'Failed to create competition.' };
  }

  // Seed default tie-breaker rules
  const adminClient = await createAdminClient();
  await adminClient.rpc('seed_default_tiebreakers', { p_competition_id: data.competition_id });

  // Audit log
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'COMPETITION_CREATED',
    entity_type: 'competition',
    entity_id: data.competition_id,
    details: { competition_name: name.trim(), slug },
  });

  revalidatePath('/admin/competitions');
  redirect(`/admin/competitions/${data.competition_id}`);
}

export async function createCompetitionAction(
  _prevState: ActionResponse,
  formData: FormData,
): Promise<ActionResponse> {
  return createCompetition(formData);
}

export async function deleteCompetition(competitionId: string): Promise<ActionResponse> {
  const { user } = await requireSuperAdmin();

  if (!isValidUuid(competitionId)) {
    return { error: 'Invalid competition ID.' };
  }

  const adminClient = await createAdminClient();

  const { data: comp, error: fetchErr } = await adminClient
    .from('competitions')
    .select('competition_id, competition_name, slug, status')
    .eq('competition_id', competitionId)
    .maybeSingle();

  if (fetchErr || !comp) {
    return { error: 'Competition not found.' };
  }

  // Delete snapshots first so leaderboard_entries cascade cleanly before participants/contest_sets
  const { error: snapDelErr } = await adminClient
    .from('leaderboard_snapshots')
    .delete()
    .eq('competition_id', competitionId);

  if (snapDelErr) {
    return { error: `Failed to delete snapshots: ${snapDelErr.message}` };
  }

  const { error: compDelErr } = await adminClient
    .from('competitions')
    .delete()
    .eq('competition_id', competitionId);

  if (compDelErr) {
    return { error: `Failed to delete competition: ${compDelErr.message}` };
  }

  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'COMPETITION_DELETED',
    entity_type: 'competition',
    entity_id: competitionId,
    details: {
      competition_name: comp.competition_name,
      slug: comp.slug,
      previous_status: comp.status,
    },
  });

  revalidatePath('/admin');
  revalidatePath('/admin/competitions');
  updateTag(LEADERBOARD_CACHE_TAG);
  revalidatePath('/leaderboard');
  revalidatePath('/monitor');
  revalidatePath('/upload');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Contest set management
// ---------------------------------------------------------------------------

export async function createContestSet(formData: FormData): Promise<ActionResponse> {
  const { supabase, user } = await requireSuperAdmin();

  const competitionId = formData.get('competition_id') as string;
  const setName = formData.get('set_name') as string;
  const setCode = formData.get('set_code') as string;
  const hackerrankSlug = formData.get('hackerrank_slug') as string;
  const rawCookie = (formData.get('hr_session_cookie') as string | null)
    ?.replace(/[\r\n]+/g, '')
    .trim();

  if (!competitionId || !setName?.trim() || !setCode?.trim() || !hackerrankSlug?.trim()) {
    return { error: 'Competition ID, set name, set code, and HackerRank slug are all required.' };
  }

  if (!isValidUuid(competitionId)) {
    return { error: 'Invalid competition ID.' };
  }

  const normalizedSetCode = setCode.trim().toLowerCase();
  if (normalizedSetCode.length > 20) {
    return { error: 'Set code must be 20 characters or fewer.' };
  }

  const extractedSlug = extractContestSlug(hackerrankSlug);
  if (!extractedSlug) {
    return {
      error:
        'Invalid HackerRank slug. Enter the contest slug (e.g. ccdemoseta) or a valid hackerrank.com/<slug> or hackerrank.com/contests/<slug> URL.',
    };
  }

  const { error } = await supabase.from('contest_sets').insert({
    competition_id: competitionId,
    set_name: setName.trim(),
    set_code: normalizedSetCode,
    hackerrank_slug: extractedSlug,
    ...(rawCookie ? { hr_session_cookie: encryptSecret(rawCookie) } : {}),
  });

  if (error) {
    if (error.code === '23505' || error.message.includes('contest_sets_competition_id_set_code_key')) {
      return {
        error: `A contest set with code "${normalizedSetCode}" already exists in this competition. Use a different Set Code (e.g. setB) or delete the existing set first.`,
      };
    }
    return { error: error.message };
  }

  const adminClient = await createAdminClient();
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'CONTEST_SET_CREATED',
    entity_type: 'contest_set',
    details: { set_name: setName.trim(), set_code: normalizedSetCode, hackerrank_slug: extractedSlug },
  });

  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath('/upload');
  redirect(`/admin/competitions/${competitionId}`);
}

export async function createContestSetAction(
  _prevState: ActionResponse,
  formData: FormData,
): Promise<ActionResponse> {
  return createContestSet(formData);
}

export async function deleteContestSet(setId: string): Promise<ActionResponse> {
  const { user } = await requireSuperAdmin();

  if (!isValidUuid(setId)) {
    return { error: 'Invalid contest set ID.' };
  }

  const adminClient = await createAdminClient();

  const { data: targetSet, error: fetchErr } = await adminClient
    .from('contest_sets')
    .select('set_id, competition_id, set_name, set_code, hackerrank_slug')
    .eq('set_id', setId)
    .maybeSingle();

  if (fetchErr || !targetSet) {
    return { error: 'Contest set not found.' };
  }

  const { count: referencedEntries, error: entryCheckErr } = await adminClient
    .from('leaderboard_entries')
    .select('entry_id', { count: 'exact', head: true })
    .eq('set_id', setId);

  if (entryCheckErr) {
    return { error: `Failed to check leaderboard snapshot references: ${entryCheckErr.message}` };
  }

  if ((referencedEntries ?? 0) > 0) {
    return {
      error:
        'Cannot delete this contest set because it is referenced by existing leaderboard snapshots. Delete the competition if you need to reset it.',
    };
  }

  const { error: delErr } = await adminClient
    .from('contest_sets')
    .delete()
    .eq('set_id', setId);

  if (delErr) {
    return { error: `Failed to delete contest set: ${delErr.message}` };
  }

  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'CONTEST_SET_DELETED',
    entity_type: 'contest_set',
    entity_id: setId,
    details: {
      competition_id: targetSet.competition_id,
      set_name: targetSet.set_name,
      set_code: targetSet.set_code,
      hackerrank_slug: targetSet.hackerrank_slug,
    },
  });

  revalidatePath(`/admin/competitions/${targetSet.competition_id}`);
  revalidatePath('/admin/competitions');
  revalidatePath('/upload');
  return { success: true };
}

// ---------------------------------------------------------------------------
// One-time auto-sync approval & cancellation (Super Admin)
// ---------------------------------------------------------------------------

export async function approveContestSetAutoSync(setId: string): Promise<ActionResponse> {
  const { user } = await requireSuperAdmin();

  if (!isValidUuid(setId)) {
    return { error: 'Invalid contest set ID.' };
  }

  const adminClient = await createAdminClient();
  const { data: targetSet, error: setErr } = await adminClient
    .from('contest_sets')
    .select('set_id, competition_id, set_name, set_code, hackerrank_slug, lab_incharge_name')
    .eq('set_id', setId)
    .maybeSingle();

  if (setErr || !targetSet) {
    return { error: 'Contest set not found.' };
  }

  const now = new Date().toISOString();

  // 1. Authorize this set for continuous auto-sync
  const { error: setUpdateErr } = await adminClient
    .from('contest_sets')
    .update({
      auto_sync_status: 'APPROVED',
      auto_sync_rejection_reason: null,
      auto_sync_approved_by: user.id,
      auto_sync_approved_at: now,
    })
    .eq('set_id', setId);

  if (setUpdateErr) {
    return { error: `Failed to approve auto-sync: ${setUpdateErr.message}` };
  }

  // 2. Promote latest PENDING_APPROVAL upload (if any) to APPROVED
  const { data: latestPending } = await adminClient
    .from('uploads')
    .select('upload_id')
    .eq('set_id', setId)
    .eq('status', 'PENDING_APPROVAL')
    .order('upload_version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPending) {
    await adminClient
      .from('uploads')
      .update({ status: 'SUPERSEDED' })
      .eq('set_id', setId)
      .eq('status', 'APPROVED');

    await adminClient
      .from('uploads')
      .update({
        status: 'APPROVED',
        approved_by: user.id,
        approved_at: now,
      })
      .eq('upload_id', latestPending.upload_id);
  }

  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'CONTEST_SET_AUTO_SYNC_APPROVED',
    entity_type: 'contest_set',
    entity_id: setId,
    details: {
      competition_id: targetSet.competition_id,
      set_name: targetSet.set_name,
      set_code: targetSet.set_code,
      lab_incharge_name: targetSet.lab_incharge_name,
    },
  });

  // 3. Immediately publish live leaderboard if any approved participants exist
  const snapRes = await createCompetitionSnapshot(targetSet.competition_id, user.id, {
    publishImmediately: true,
    auditAction: 'LEADERBOARD_AUTO_PUBLISHED',
  });

  revalidatePath('/admin');
  revalidatePath(`/admin/competitions/${targetSet.competition_id}`);
  revalidatePath('/upload');
  revalidatePath(`/upload/${setId}`);
  revalidatePath('/leaderboard');

  if (snapRes.error && snapRes.error !== 'No approved submissions found to consolidate.') {
    return { error: snapRes.error };
  }

  return { success: true, data: snapRes.data ?? { approvedOnly: true } };
}

export async function rejectContestSetAutoSync(
  setId: string,
  reason?: string,
): Promise<ActionResponse> {
  const { user } = await requireSuperAdmin();

  if (!isValidUuid(setId)) {
    return { error: 'Invalid contest set ID.' };
  }

  const trimmedReason = reason?.trim() || 'Sync cancelled by Super Admin.';
  const adminClient = await createAdminClient();

  const { data: targetSet, error: setErr } = await adminClient
    .from('contest_sets')
    .select('set_id, competition_id, set_name, set_code, lab_incharge_name')
    .eq('set_id', setId)
    .maybeSingle();

  if (setErr || !targetSet) {
    return { error: 'Contest set not found.' };
  }

  const { error: updateErr } = await adminClient
    .from('contest_sets')
    .update({
      auto_sync_status: 'REJECTED',
      auto_sync_rejection_reason: trimmedReason,
    })
    .eq('set_id', setId);

  if (updateErr) {
    return { error: `Failed to cancel auto-sync: ${updateErr.message}` };
  }

  await adminClient
    .from('uploads')
    .update({
      status: 'REJECTED',
      rejection_reason: trimmedReason,
    })
    .eq('set_id', setId)
    .eq('status', 'PENDING_APPROVAL');

  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'CONTEST_SET_AUTO_SYNC_REJECTED',
    entity_type: 'contest_set',
    entity_id: setId,
    details: {
      competition_id: targetSet.competition_id,
      set_name: targetSet.set_name,
      set_code: targetSet.set_code,
      lab_incharge_name: targetSet.lab_incharge_name,
      reason: trimmedReason,
    },
  });

  revalidatePath('/admin');
  revalidatePath(`/admin/competitions/${targetSet.competition_id}`);
  revalidatePath('/upload');
  revalidatePath(`/upload/${setId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Upload approval / rejection
// ---------------------------------------------------------------------------

export async function approveUpload(uploadId: string): Promise<ActionResponse> {
  const { supabase, user } = await requireSuperAdmin();

  if (!isValidUuid(uploadId)) {
    return { error: 'Invalid upload ID.' };
  }

  // 1. Fetch current upload record
  const { data: targetUpload, error: fetchErr } = await supabase
    .from('uploads')
    .select('upload_id, set_id, competition_id, status')
    .eq('upload_id', uploadId)
    .maybeSingle();

  if (fetchErr || !targetUpload) {
    return { error: 'Upload not found.' };
  }

  if (targetUpload.status !== 'PENDING_APPROVAL') {
    return {
      error: `Only uploads in PENDING_APPROVAL status can be approved. Current status: ${targetUpload.status}`,
    };
  }

  const adminClient = await createAdminClient();

  // 2. Mark any previously approved upload for this set as SUPERSEDED
  await adminClient
    .from('uploads')
    .update({ status: 'SUPERSEDED' })
    .eq('set_id', targetUpload.set_id)
    .eq('status', 'APPROVED');

  // 3. Mark target upload as APPROVED
  const { error: updateErr } = await adminClient
    .from('uploads')
    .update({
      status: 'APPROVED',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('upload_id', uploadId);

  if (updateErr) return { error: updateErr.message };

  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'UPLOAD_APPROVED',
    entity_type: 'upload',
    entity_id: uploadId,
  });

  if (targetUpload.competition_id) {
    // Check if all sets are now approved
    const { data: sets } = await adminClient
      .from('contest_sets')
      .select('set_id, uploads(status)')
      .eq('competition_id', targetUpload.competition_id);

    const allApproved = (sets ?? []).every((s) => {
      const uList = (s.uploads as Array<{ status: string }>) || [];
      return uList.some((u) => u.status === 'APPROVED');
    });

    if (allApproved) {
      await adminClient
        .from('competitions')
        .update({ status: 'APPROVED' })
        .eq('competition_id', targetUpload.competition_id)
        .neq('status', 'PUBLISHED');
    }

    revalidatePath(`/admin/competitions/${targetUpload.competition_id}`);
  }

  revalidatePath('/admin');
  revalidatePath('/upload');
  return { success: true };
}

export async function rejectUpload(uploadId: string, reason: string): Promise<ActionResponse> {
  const { supabase, user } = await requireSuperAdmin();

  if (!isValidUuid(uploadId)) {
    return { error: 'Invalid upload ID.' };
  }

  if (!reason?.trim()) return { error: 'A rejection reason is required.' };

  // 1. Fetch current upload record
  const { data: targetUpload, error: fetchErr } = await supabase
    .from('uploads')
    .select('upload_id, competition_id, status')
    .eq('upload_id', uploadId)
    .maybeSingle();

  if (fetchErr || !targetUpload) {
    return { error: 'Upload not found.' };
  }

  if (targetUpload.status !== 'PENDING_APPROVAL') {
    return {
      error: `Only uploads in PENDING_APPROVAL status can be rejected. Current status: ${targetUpload.status}`,
    };
  }

  const adminClient = await createAdminClient();
  const { error: updateErr } = await adminClient
    .from('uploads')
    .update({
      status: 'REJECTED',
      rejection_reason: reason.trim(),
    })
    .eq('upload_id', uploadId);

  if (updateErr) return { error: updateErr.message };

  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'UPLOAD_REJECTED',
    entity_type: 'upload',
    entity_id: uploadId,
    details: { reason: reason.trim() },
  });

  if (targetUpload.competition_id) {
    revalidatePath(`/admin/competitions/${targetUpload.competition_id}`);
  }
  revalidatePath('/admin');
  revalidatePath('/upload');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Leaderboard generation & publication (Phase 3 spec)
// ---------------------------------------------------------------------------

export async function generateLeaderboard(competitionId: string): Promise<ActionResponse> {
  const { user } = await requireSuperAdmin();

  if (!isValidUuid(competitionId)) {
    return { error: 'Invalid competition ID.' };
  }

  return createCompetitionSnapshot(competitionId, user.id, {
    publishImmediately: false,
    auditAction: 'LEADERBOARD_GENERATED',
  });
}

export async function publishLeaderboard(snapshotId: string): Promise<ActionResponse> {
  const { user } = await requireSuperAdmin();

  if (!isValidUuid(snapshotId)) {
    return { error: 'Invalid snapshot ID.' };
  }

  const adminClient = await createAdminClient();

  const { data: snapshot, error: fetchError } = await adminClient
    .from('leaderboard_snapshots')
    .select('competition_id, version')
    .eq('snapshot_id', snapshotId)
    .single();

  if (fetchError || !snapshot) return { error: 'Snapshot not found.' };

  // Mark all previous snapshots of this competition as SUPERSEDED
  await adminClient
    .from('leaderboard_snapshots')
    .update({ status: 'SUPERSEDED' })
    .eq('competition_id', snapshot.competition_id)
    .neq('snapshot_id', snapshotId);

  // Mark this snapshot as PUBLISHED
  const now = new Date().toISOString();
  const { error: pubError } = await adminClient
    .from('leaderboard_snapshots')
    .update({
      status: 'PUBLISHED',
      published_by: user.id,
      published_at: now,
    })
    .eq('snapshot_id', snapshotId);

  if (pubError) return { error: pubError.message };

  // Update competition status to PUBLISHED
  await adminClient
    .from('competitions')
    .update({ status: 'PUBLISHED' })
    .eq('competition_id', snapshot.competition_id);

  // Audit log
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'LEADERBOARD_PUBLISHED',
    entity_type: 'leaderboard_snapshot',
    entity_id: snapshotId,
    details: { competition_id: snapshot.competition_id, version: snapshot.version },
  });

  revalidatePath(`/admin/competitions/${snapshot.competition_id}`);
  revalidatePath('/monitor');
  updateTag(LEADERBOARD_CACHE_TAG);
  revalidatePath('/leaderboard');
  return { success: true };
}

export async function endLeaderboard(competitionId: string): Promise<ActionResponse> {
  const { user } = await requireSuperAdmin();

  if (!isValidUuid(competitionId)) {
    return { error: 'Invalid competition ID.' };
  }

  const adminClient = await createAdminClient();

  const { data: comp, error: compErr } = await adminClient
    .from('competitions')
    .select('competition_id, competition_name, status')
    .eq('competition_id', competitionId)
    .maybeSingle();

  if (compErr || !comp) {
    return { error: 'Competition not found.' };
  }

  // Archive any currently published snapshots so /leaderboard no longer serves them
  const { error: snapErr } = await adminClient
    .from('leaderboard_snapshots')
    .update({ status: 'SUPERSEDED' })
    .eq('competition_id', competitionId)
    .eq('status', 'PUBLISHED');

  if (snapErr) {
    return { error: `Failed to end leaderboard snapshots: ${snapErr.message}` };
  }

  // Revert competition status from PUBLISHED to APPROVED so sets/rules can be adjusted or a new snapshot published
  const { error: compUpdateErr } = await adminClient
    .from('competitions')
    .update({ status: 'APPROVED' })
    .eq('competition_id', competitionId)
    .eq('status', 'PUBLISHED');

  if (compUpdateErr) {
    return { error: `Failed to update competition status: ${compUpdateErr.message}` };
  }

  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'LEADERBOARD_ENDED',
    entity_type: 'competition',
    entity_id: competitionId,
    details: { competition_name: comp.competition_name, previous_status: comp.status },
  });

  revalidatePath('/admin');
  revalidatePath('/admin/competitions');
  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath('/monitor');
  updateTag(LEADERBOARD_CACHE_TAG);
  revalidatePath('/leaderboard');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Tie-breaker rules management
// ---------------------------------------------------------------------------

export interface RuleInput {
  criterion: string;
  direction: 'ASC' | 'DESC';
  enabled: boolean;
  priority: number;
}

export async function saveTieBreakerRules(
  competitionId: string,
  rules: RuleInput[]
): Promise<ActionResponse> {
  const { user } = await requireSuperAdmin();

  if (!isValidUuid(competitionId)) {
    return { error: 'Invalid competition ID.' };
  }

  const adminClient = await createAdminClient();

  // Check if competition is PUBLISHED
  const { data: comp, error: compErr } = await adminClient
    .from('competitions')
    .select('status')
    .eq('competition_id', competitionId)
    .maybeSingle();

  if (compErr || !comp) {
    return { error: 'Competition not found.' };
  }

  if (comp.status === 'PUBLISHED') {
    return { error: 'Cannot modify tie-breaker rules for a published competition.' };
  }

  const validCriteria = [
    'total_score',
    'problems_solved',
    'penalty',
    'final_submission_time',
    'incorrect_submissions',
  ];

  for (const r of rules) {
    if (!validCriteria.includes(r.criterion)) {
      return { error: 'Invalid ranking criterion: ' + r.criterion };
    }
    if (r.direction !== 'ASC' && r.direction !== 'DESC') {
      return { error: 'Invalid sort direction for ' + r.criterion };
    }
  }

  const rowsToInsert = rules.map((r) => ({
    criterion: r.criterion,
    direction: r.direction,
    enabled: r.enabled,
    priority: r.priority,
  }));

  // Execute atomically via RPC function
  const { error: rpcError } = await adminClient.rpc('save_tie_breaker_rules', {
    p_competition_id: competitionId,
    p_rules: rowsToInsert,
    p_user_id: user.id,
  });

  if (rpcError) {
    return { error: 'Failed to save rules: ' + rpcError.message };
  }

  // Audit log
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'TIE_BREAKER_RULES_UPDATED',
    entity_type: 'competition',
    entity_id: competitionId,
    details: { rules: rowsToInsert },
  });

  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath(`/admin/competitions/${competitionId}/rules`);
  updateTag(LEADERBOARD_CACHE_TAG);
  revalidatePath('/leaderboard');
  return { success: true };
}


// ---------------------------------------------------------------------------
// User management (Super Admin provisions accounts)
// ---------------------------------------------------------------------------

export async function provisionUser(formData: FormData): Promise<void> {
  const { user: callerUser } = await requireSuperAdmin();

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = formData.get('role') as string;

  if (!name?.trim() || !email?.trim() || !password || !role) {
    throw new Error('Name, email, password, and a valid role are required.');
  }

  if (!isAllowedProvisionRole(role)) {
    throw new Error(`Role "${role}" is not allowed. Permitted roles: ${ALLOWED_PROVISION_ROLES.join(', ')}`);
  }

  const passwordValidation = validatePasswordPolicy(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join(' '));
  }

  const adminClient = await createAdminClient();
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  });

  if (authError || !authUser.user) throw new Error(authError?.message || 'Failed to create user');

  const { error: profileError } = await adminClient.from('users').insert({
    user_id: authUser.user.id,
    name: name.trim(),
    email: email.trim(),
    role,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    throw new Error(profileError.message);
  }

  await adminClient.from('audit_logs').insert({
    user_id: callerUser.id,
    action: 'USER_PROVISIONED',
    entity_type: 'user',
    entity_id: authUser.user.id,
    details: { name: name.trim(), email: email.trim(), role },
  });

  revalidatePath('/admin/users');
  redirect('/admin/users');
}

export async function toggleUserStatus(
  userId: string,
  nextStatus: 'ACTIVE' | 'INACTIVE',
): Promise<ActionResponse> {
  const { user: callerUser } = await requireSuperAdmin();

  if (!isValidUuid(userId)) {
    return { error: 'Invalid user ID.' };
  }

  if (userId === callerUser.id) {
    return { error: 'You cannot change your own account status.' };
  }

  if (nextStatus !== 'ACTIVE' && nextStatus !== 'INACTIVE') {
    return { error: 'Invalid account status.' };
  }

  const adminClient = await createAdminClient();
  const { data: target, error: fetchErr } = await adminClient
    .from('users')
    .select('user_id, email, role, account_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !target) {
    return { error: 'User not found.' };
  }

  if (target.role === 'SUPER_ADMIN') {
    return { error: 'Cannot modify Super Admin accounts.' };
  }

  const { error: updateErr } = await adminClient
    .from('users')
    .update({ account_status: nextStatus })
    .eq('user_id', userId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  await adminClient.from('audit_logs').insert({
    user_id: callerUser.id,
    action: nextStatus === 'INACTIVE' ? 'USER_DEACTIVATED' : 'USER_REACTIVATED',
    entity_type: 'user',
    entity_id: userId,
    details: { email: target.email, role: target.role, account_status: nextStatus },
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteUser(userId: string): Promise<ActionResponse> {
  const { user: callerUser } = await requireSuperAdmin();

  if (!isValidUuid(userId)) {
    return { error: 'Invalid user ID.' };
  }

  if (userId === callerUser.id) {
    return { error: 'You cannot delete your own account.' };
  }

  const adminClient = await createAdminClient();
  const { data: target, error: fetchErr } = await adminClient
    .from('users')
    .select('user_id, name, email, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !target) {
    return { error: 'User not found.' };
  }

  if (target.role === 'SUPER_ADMIN') {
    return { error: 'Cannot delete a Super Admin account.' };
  }

  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteErr) {
    const msg = deleteErr.message.toLowerCase();
    if (msg.includes('database') || msg.includes('foreign') || msg.includes('constraint')) {
      return {
        error:
          'Cannot delete this account because it is linked to existing competition uploads or snapshots. Delete those competitions first, or deactivate the account instead.',
      };
    }
    return { error: deleteErr.message };
  }

  await adminClient.from('audit_logs').insert({
    user_id: callerUser.id,
    action: 'USER_DELETED',
    entity_type: 'user',
    entity_id: userId,
    details: { name: target.name, email: target.email, role: target.role },
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  return { success: true };
}

export async function assignLabAdminName(
  userId: string,
  labAdminName: string,
): Promise<ActionResponse> {
  const { user: callerUser } = await requireSuperAdmin();

  if (!isValidUuid(userId)) {
    return { error: 'Please select a valid Master Lab Admin account.' };
  }

  const trimmedName = labAdminName?.trim() ?? '';
  if (!trimmedName) {
    return { error: 'Lab Admin Name is required.' };
  }
  if (trimmedName.length > 100) {
    return { error: 'Lab Admin Name must be 100 characters or fewer.' };
  }

  const adminClient = await createAdminClient();
  const { data: target, error: fetchErr } = await adminClient
    .from('users')
    .select('user_id, name, email, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !target) {
    return { error: 'Master Lab Admin account not found.' };
  }

  if (target.role !== 'MASTER_LAB_ADMIN') {
    return { error: 'Only Master Lab Admin accounts can be assigned here.' };
  }

  const { error: updateErr } = await adminClient
    .from('users')
    .update({ name: trimmedName })
    .eq('user_id', userId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  try {
    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { name: trimmedName },
    });
  } catch {
    // Best-effort auth metadata sync; public.users is authoritative
  }

  await adminClient.from('audit_logs').insert({
    user_id: callerUser.id,
    action: 'LAB_ADMIN_NAME_ASSIGNED',
    entity_type: 'user',
    entity_id: userId,
    details: {
      previous_name: target.name,
      assigned_name: trimmedName,
      email: target.email,
    },
  });

  revalidatePath('/admin');
  revalidatePath('/admin/users');
  revalidatePath('/upload');
  return { success: true, data: { user_id: userId, name: trimmedName } };
}

export async function assignLabAdminNameAction(
  _prevState: ActionResponse,
  formData: FormData,
): Promise<ActionResponse> {
  const userId = (formData.get('user_id') as string) ?? '';
  const labAdminName = (formData.get('lab_admin_name') as string) ?? '';
  return assignLabAdminName(userId, labAdminName);
}
