'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { computeRankings } from '@/lib/ranking/engine';
import { isValidContestSlug } from '@/lib/hackerrank/client';
import { isValidUuid } from '@/lib/validation/uuid';
import { isAllowedProvisionRole, validatePasswordPolicy, ALLOWED_PROVISION_ROLES } from '@/lib/security/password';
import { encryptSecret } from '@/lib/security/encryption';
import type { TieBreakerRule } from '@/types/database';

export type ActionResponse = {
  success?: boolean;
  error?: string | null;
  data?: unknown;
};

// ---------------------------------------------------------------------------
// Competition management
// ---------------------------------------------------------------------------

export async function createCompetition(formData: FormData): Promise<void> {
  const { supabase, user } = await requireSuperAdmin();

  const name = formData.get('competition_name') as string;
  const description = formData.get('description') as string | null;
  const contestDate = formData.get('contest_date') as string;
  const topK = parseInt(formData.get('top_k') as string, 10);

  if (!name?.trim() || !contestDate || isNaN(topK) || topK < 1) {
    throw new Error('Competition name, contest date, and a positive Top-K value are required.');
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { data, error } = await supabase.from('competitions').insert({
    slug,
    competition_name: name.trim(),
    description: description?.trim() || null,
    contest_date: contestDate,
    top_k: topK,
    created_by: user.id,
  }).select('competition_id').single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create competition');
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
  revalidatePath('/leaderboard');
  revalidatePath('/monitor');
  revalidatePath('/upload');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Contest set management
// ---------------------------------------------------------------------------

export async function createContestSet(formData: FormData): Promise<void> {
  const { supabase, user } = await requireSuperAdmin();

  const competitionId = formData.get('competition_id') as string;
  const setName = formData.get('set_name') as string;
  const setCode = formData.get('set_code') as string;
  const hackerrankSlug = formData.get('hackerrank_slug') as string;
  const rawCookie = (formData.get('hr_session_cookie') as string | null)
    ?.replace(/[\r\n]+/g, '')
    .trim();

  if (!competitionId || !setName?.trim() || !setCode?.trim() || !hackerrankSlug?.trim()) {
    throw new Error('Competition ID, set name, set code, and HackerRank slug are all required.');
  }

  if (!isValidUuid(competitionId)) {
    throw new Error('Invalid competition ID.');
  }

  const trimmedSlug = hackerrankSlug.trim();
  if (!isValidContestSlug(trimmedSlug)) {
    throw new Error('Invalid HackerRank slug. Slugs may only contain alphanumeric characters, hyphens, and underscores.');
  }

  const { error } = await supabase.from('contest_sets').insert({
    competition_id: competitionId,
    set_name: setName.trim(),
    set_code: setCode.trim().toLowerCase(),
    hackerrank_slug: trimmedSlug,
    ...(rawCookie ? { hr_session_cookie: encryptSecret(rawCookie) } : {}),
  });

  if (error) throw new Error(error.message);

  const adminClient = await createAdminClient();
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'CONTEST_SET_CREATED',
    entity_type: 'contest_set',
    details: { set_name: setName, hackerrank_slug: hackerrankSlug },
  });

  revalidatePath(`/admin/competitions/${competitionId}`);
  redirect(`/admin/competitions/${competitionId}`);
}

// ---------------------------------------------------------------------------
// Upload approval / rejection
// ---------------------------------------------------------------------------

export async function approveUpload(uploadId: string): Promise<ActionResponse> {
  const { supabase, user } = await requireSuperAdmin();

  if (!isValidUuid(uploadId)) {
    return { error: 'Invalid upload ID.' };
  }

  // 1. Fetch current upload record and competition status
  const { data: targetUpload, error: fetchErr } = await supabase
    .from('uploads')
    .select('upload_id, set_id, competition_id, status, competitions(status)')
    .eq('upload_id', uploadId)
    .maybeSingle();

  if (fetchErr || !targetUpload) {
    return { error: 'Upload not found.' };
  }

  const compStatus = (targetUpload.competitions as unknown as { status: string })?.status;
  if (compStatus === 'PUBLISHED') {
    return { error: 'Cannot approve uploads for a published competition.' };
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
  }

  revalidatePath('/admin');
  return { success: true };
}

export async function rejectUpload(uploadId: string, reason: string): Promise<ActionResponse> {
  const { supabase, user } = await requireSuperAdmin();

  if (!isValidUuid(uploadId)) {
    return { error: 'Invalid upload ID.' };
  }

  if (!reason?.trim()) return { error: 'A rejection reason is required.' };

  // 1. Fetch current upload record and competition status
  const { data: targetUpload, error: fetchErr } = await supabase
    .from('uploads')
    .select('upload_id, status, competitions(status)')
    .eq('upload_id', uploadId)
    .maybeSingle();

  if (fetchErr || !targetUpload) {
    return { error: 'Upload not found.' };
  }

  const compStatus = (targetUpload.competitions as unknown as { status: string })?.status;
  if (compStatus === 'PUBLISHED') {
    return { error: 'Cannot reject uploads for a published competition.' };
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

  revalidatePath('/admin');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Leaderboard generation & publication (Phase 3 spec)
// ---------------------------------------------------------------------------

export async function generateLeaderboard(competitionId: string): Promise<ActionResponse> {
  const { supabase, user } = await requireSuperAdmin();

  if (!isValidUuid(competitionId)) {
    return { error: 'Invalid competition ID.' };
  }

  // 1. Fetch competition and topK
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('competition_id, top_k')
    .eq('competition_id', competitionId)
    .single();

  if (compError || !competition) return { error: 'Competition not found.' };

  // 2. Fetch tie breaker rules
  const { data: rules } = await supabase
    .from('tie_breaker_rules')
    .select('*')
    .eq('competition_id', competitionId)
    .order('priority', { ascending: true });

  const activeRules: TieBreakerRule[] = rules || [
    { rule_id: '1', competition_id: competitionId, criterion: 'total_score', priority: 1, direction: 'DESC', enabled: true, approved_by: null },
    { rule_id: '2', competition_id: competitionId, criterion: 'problems_solved', priority: 2, direction: 'DESC', enabled: true, approved_by: null },
    { rule_id: '3', competition_id: competitionId, criterion: 'penalty', priority: 3, direction: 'ASC', enabled: true, approved_by: null },
  ];

  // 3. Fetch all approved participants & results across all sets
  const { data: participants, error: partError } = await supabase
    .from('participants')
    .select('participant_id, external_id, participant_name, set_id, contest_sets(set_name), results(total_score, problems_solved, penalty, final_submission_time, incorrect_submissions), uploads!inner(status)')
    .eq('competition_id', competitionId)
    .eq('uploads.status', 'APPROVED');

  if (partError || !participants || participants.length === 0) {
    return { error: 'No approved submissions found to consolidate.' };
  }

  const flatInput = participants.map((p) => {
    const r = (p.results as unknown as Array<{
      total_score: number;
      problems_solved: number | null;
      penalty: number | null;
      final_submission_time: number | null;
      incorrect_submissions: number | null;
    }>)?.[0];
    const setName = (p.contest_sets as unknown as { set_name: string })?.set_name || 'Set';
    return {
      participant_id: p.participant_id,
      external_id: p.external_id,
      participant_name: p.participant_name,
      set_id: p.set_id,
      set_name: setName,
      total_score: Number(r?.total_score ?? 0),
      problems_solved: r?.problems_solved ?? null,
      penalty: r?.penalty ?? null,
      final_submission_time: r?.final_submission_time ?? null,
      incorrect_submissions: r?.incorrect_submissions ?? null,
    };
  });

  // 4. Run ranking engine
  const ranked = computeRankings(flatInput, activeRules, competition.top_k);

  // 5. Store snapshot in DB
  const adminClient = await createAdminClient();

  const { data: lastSnap } = await adminClient
    .from('leaderboard_snapshots')
    .select('version')
    .eq('competition_id', competitionId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const newVersion = (lastSnap?.version ?? 0) + 1;

  const { data: snapshot, error: snapError } = await adminClient
    .from('leaderboard_snapshots')
    .insert({
      competition_id: competitionId,
      version: newVersion,
      generated_by: user.id,
      status: 'DRAFT',
    })
    .select('snapshot_id')
    .single();

  if (snapError || !snapshot) return { error: `Failed to create snapshot: ${snapError?.message}` };

  const entries = ranked.map((entry) => ({
    snapshot_id: snapshot.snapshot_id,
    participant_id: entry.participant_id,
    set_id: entry.set_id,
    overall_rank: entry.overall_rank,
    total_score: entry.total_score,
    problems_solved: entry.problems_solved,
    penalty: entry.penalty,
    qualification_status: entry.qualification_status,
  }));

  const { error: entryError } = await adminClient.from('leaderboard_entries').insert(entries);
  if (entryError) return { error: `Failed to insert entries: ${entryError.message}` };

  // Audit log
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'LEADERBOARD_GENERATED',
    entity_type: 'leaderboard_snapshot',
    entity_id: snapshot.snapshot_id,
    details: { competition_id: competitionId, version: newVersion, total_entries: entries.length },
  });

  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath('/monitor');
  return { success: true, data: { snapshot_id: snapshot.snapshot_id, version: newVersion } };
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
