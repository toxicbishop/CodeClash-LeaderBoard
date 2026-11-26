'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireMasterLabAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { extractContestSlug, fetchContestLeaderboard, HackerRankError } from '@/lib/hackerrank/client';
import { validateHackerRankEntries } from '@/lib/hackerrank/validate';
import { createCompetitionSnapshot } from '@/lib/leaderboard/publish';
import { isValidUuid } from '@/lib/validation/uuid';
import { decryptSecret, encryptSecret } from '@/lib/security/encryption';
import { checkRateLimit } from '@/lib/security/rate-limit';
import type { AutoSyncStatus } from '@/types/database';

export type SyncResponse = {
  success?: boolean;
  error?: string | null;
  recordsCount?: number;
  warningsCount?: number;
  unchanged?: boolean;
  pendingApproval?: boolean;
  autoPublished?: boolean;
  rejected?: boolean;
  autoSyncStatus?: AutoSyncStatus;
};

export type LabSetFormState = {
  error?: string | null;
};

export async function upsertLabContestSetAction(
  _prevState: LabSetFormState,
  formData: FormData,
): Promise<LabSetFormState> {
  const { user } = await requireMasterLabAdmin();

  const competitionId = (formData.get('competition_id') as string) ?? '';
  const setName = (formData.get('set_name') as string) ?? '';
  const setCode = (formData.get('set_code') as string) ?? '';
  const labInchargeName = (formData.get('lab_incharge_name') as string) ?? '';
  const hackerrankSlug = (formData.get('hackerrank_slug') as string) ?? '';
  const rawCookie = ((formData.get('hr_session_cookie') as string | null) ?? '')
    .replace(/[\r\n]+/g, '')
    .trim();

  if (!isValidUuid(competitionId)) {
    return { error: 'Invalid competition ID.' };
  }
  if (!labInchargeName.trim()) {
    return { error: 'Lab In-Charge Name is required.' };
  }
  if (labInchargeName.trim().length > 100) {
    return { error: 'Lab In-Charge Name must be 100 characters or fewer.' };
  }
  if (!setName.trim() || !setCode.trim() || !hackerrankSlug.trim()) {
    return { error: 'Set name, set code, and HackerRank slug are all required.' };
  }

  const normalizedSetCode = setCode.trim().toLowerCase();
  if (normalizedSetCode.length > 20) {
    return { error: 'Set code must be 20 characters or fewer.' };
  }

  const extractedSlug = extractContestSlug(hackerrankSlug);
  if (!extractedSlug) {
    return {
      error:
        'Invalid HackerRank slug. Enter the contest slug (e.g. codeclash-2026-setA) or a valid hackerrank.com/contests/<slug> URL.',
    };
  }

  const adminClient = createAdminClient();
  const { data: inserted, error } = await adminClient
    .from('contest_sets')
    .insert({
      competition_id: competitionId,
      set_name: setName.trim(),
      set_code: normalizedSetCode,
      hackerrank_slug: extractedSlug,
      lab_incharge_name: labInchargeName.trim(),
      assigned_lab_admin_id: user.id,
      auto_sync_status: 'PENDING',
      ...(rawCookie ? { hr_session_cookie: encryptSecret(rawCookie) } : {}),
    })
    .select('set_id')
    .single();

  if (error || !inserted) {
    if (error?.code === '23505' || error?.message.includes('contest_sets_competition_id_set_code_key')) {
      return {
        error: `A set with code "${normalizedSetCode}" already exists in this competition. Open it below or choose another Set Code.`,
      };
    }
    return { error: error?.message || 'Failed to add contest set.' };
  }

  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'LAB_CONTEST_SET_ADDED',
    entity_type: 'contest_set',
    entity_id: inserted.set_id,
    details: {
      competition_id: competitionId,
      set_name: setName.trim(),
      set_code: normalizedSetCode,
      hackerrank_slug: extractedSlug,
      lab_incharge_name: labInchargeName.trim(),
    },
  });

  revalidatePath('/upload');
  revalidatePath(`/admin/competitions/${competitionId}`);
  redirect(`/upload/${inserted.set_id}`);
}

export async function getContestSetSyncStatus(setId: string): Promise<{
  autoSyncStatus?: AutoSyncStatus;
  rejectionReason?: string | null;
  error?: string;
}> {
  await requireMasterLabAdmin();

  if (!isValidUuid(setId)) {
    return { error: 'Invalid contest set ID.' };
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('contest_sets')
    .select('auto_sync_status, auto_sync_rejection_reason')
    .eq('set_id', setId)
    .maybeSingle();

  if (error || !data) {
    return { error: 'Contest set not found.' };
  }

  return {
    autoSyncStatus: (data.auto_sync_status as AutoSyncStatus | undefined) ?? 'PENDING',
    rejectionReason: data.auto_sync_rejection_reason ?? null,
  };
}

export async function syncContestSetFromHackerRank(
  setId: string,
  overrideSlug?: string,
  sessionCookie?: string,
  labInchargeName?: string,
  options?: { isRequest?: boolean },
): Promise<SyncResponse> {
  const { user, supabase } = await requireMasterLabAdmin();

  if (!isValidUuid(setId)) {
    return { error: 'Invalid contest set ID.' };
  }

  // Rate limiting per user: 12 syncs per 60 seconds (supports 10s auto-sync loop)
  const rateLimit = checkRateLimit('hr_sync', user.id, 12, 60000);
  if (!rateLimit.success) {
    const waitSec = Math.max(1, Math.ceil(rateLimit.resetMs / 1000));
    return {
      error: `Rate limit exceeded for contest synchronization. Please wait ${waitSec}s before syncing again.`,
    };
  }

  // 1. Fetch contest set details
  const { data: set, error: setError } = await supabase
    .from('contest_sets')
    .select('*, competitions(*)')
    .eq('set_id', setId)
    .single();

  if (setError || !set) {
    return { error: 'Contest set not found.' };
  }

  const resolvedInchargeName = (labInchargeName ?? set.lab_incharge_name ?? '').trim();
  if (!resolvedInchargeName) {
    return { error: 'Lab In-Charge Name is required before sending an approval request.' };
  }
  if (resolvedInchargeName.length > 100) {
    return { error: 'Lab In-Charge Name must be 100 characters or fewer.' };
  }

  const rawSlugInput = (overrideSlug?.trim() || set.hackerrank_slug || '').trim();
  const slug = extractContestSlug(rawSlugInput);
  if (!slug) {
    return {
      error: `Invalid HackerRank contest slug: "${rawSlugInput}". Enter the contest slug (e.g. codeclash-2026-setA) or a valid hackerrank.com/contests/<slug> URL.`,
    };
  }

  const providedCookie = sessionCookie?.replace(/[\r\n]+/g, '').trim() ?? '';
  const slugChanged = Boolean(overrideSlug?.trim()) && slug !== set.hackerrank_slug;
  const cookieChanged = Boolean(providedCookie);

  let currentAutoSyncStatus: AutoSyncStatus =
    (set.auto_sync_status as AutoSyncStatus | undefined) ?? 'PENDING';

  // Background auto-sync ticks must halt immediately if Super Admin cancelled/rejected
  if (currentAutoSyncStatus === 'REJECTED' && !options?.isRequest) {
    return {
      error: set.auto_sync_rejection_reason || 'Auto-sync was cancelled by the Super Admin.',
      rejected: true,
      autoSyncStatus: 'REJECTED',
    };
  }

  // Re-sending request after rejection, or changing slug/credentials, requires a fresh 1-time approval
  const resetToPending =
    (currentAutoSyncStatus === 'REJECTED' && Boolean(options?.isRequest)) ||
    slugChanged ||
    cookieChanged;

  if (resetToPending) {
    currentAutoSyncStatus = 'PENDING';
  }

  // Decrypt stored session cookie if present, never log it
  let cookie: string | undefined = undefined;
  if (providedCookie) {
    cookie = providedCookie;
  } else if (set.hr_session_cookie) {
    try {
      cookie = decryptSecret(set.hr_session_cookie);
    } catch {
      return { error: 'Failed to decrypt contest session credentials.' };
    }
  }

  // 2. Fetch from HackerRank
  let fetchResult;
  try {
    fetchResult = await fetchContestLeaderboard(slug, cookie);
  } catch (err: unknown) {
    if (err instanceof HackerRankError) {
      return { error: err.message };
    }
    return { error: `Failed to fetch from HackerRank: ${String(err)}` };
  }

  const adminClient = createAdminClient();

  // Persist verified credentials, Lab In-Charge name, and auto-sync state
  await adminClient
    .from('contest_sets')
    .update({
      lab_incharge_name: resolvedInchargeName,
      assigned_lab_admin_id: user.id,
      ...(providedCookie ? { hr_session_cookie: encryptSecret(providedCookie) } : {}),
      ...(slugChanged ? { hackerrank_slug: slug } : {}),
      ...(resetToPending
        ? { auto_sync_status: 'PENDING', auto_sync_rejection_reason: null }
        : {}),
    })
    .eq('set_id', setId);

  const { entries, total } = fetchResult;

  // 3. Validate entries
  const { valid, errors, duplicateHandles } = validateHackerRankEntries(entries);

  // 4. Determine next version & skip redundant upload rows when auto-sync sees no changes
  const contentHash = valid
    .map((v) => `${v.hacker.trim().toLowerCase()}:${v.score}:${v.time_taken ?? 0}:${v.solved_challenges ?? 0}`)
    .sort()
    .join('|');

  const { data: lastUpload } = await supabase
    .from('uploads')
    .select('upload_version, status, record_count, sync_metadata')
    .eq('set_id', setId)
    .order('upload_version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastMeta = lastUpload?.sync_metadata as { content_hash?: string } | null;
  const compObj = (Array.isArray(set.competitions) ? set.competitions[0] : set.competitions) as
    | { status?: string }
    | null;

  if (
    lastUpload &&
    errors.length === 0 &&
    lastMeta?.content_hash === contentHash &&
    ((currentAutoSyncStatus === 'PENDING' && lastUpload.status === 'PENDING_APPROVAL') ||
      (currentAutoSyncStatus === 'APPROVED' &&
        lastUpload.status === 'APPROVED' &&
        compObj?.status === 'PUBLISHED'))
  ) {
    return {
      success: true,
      recordsCount: valid.length,
      warningsCount: 0,
      unchanged: true,
      autoSyncStatus: currentAutoSyncStatus,
    };
  }

  const nextVersion = (lastUpload?.upload_version ?? 0) + 1;
  const canAutoApprove = currentAutoSyncStatus === 'APPROVED' && errors.length === 0;
  const now = new Date().toISOString();
  const status = errors.length > 0 ? 'VALIDATION_FAILED' : canAutoApprove ? 'APPROVED' : 'PENDING_APPROVAL';

  // 5. Cross-set collision detection: Check if external_ids exist in other sets of this competition
  const { data: existingParticipants } = await supabase
    .from('participants')
    .select('external_id, set_id, contest_sets(set_name)')
    .eq('competition_id', set.competition_id)
    .neq('set_id', setId);

  const existingMap = new Map<string, string>();
  existingParticipants?.forEach((p) => {
    const handle = p.external_id.toLowerCase().trim();
    const setName = (p.contest_sets as unknown as { set_name: string })?.set_name || 'Other Set';
    existingMap.set(handle, setName);
  });

  const collisions: Array<{ external_id: string; conflicting_set_name: string }> = [];
  valid.forEach((v) => {
    const handle = v.hacker.toLowerCase().trim();
    if (existingMap.has(handle)) {
      collisions.push({
        external_id: v.hacker,
        conflicting_set_name: existingMap.get(handle)!,
      });
    }
  });

  if (canAutoApprove) {
    await adminClient
      .from('uploads')
      .update({ status: 'SUPERSEDED' })
      .eq('set_id', setId)
      .eq('status', 'APPROVED');
  }

  // 6. Insert into uploads
  const { data: upload, error: uploadError } = await adminClient
    .from('uploads')
    .insert({
      competition_id: set.competition_id,
      set_id: setId,
      uploaded_by: user.id,
      hackerrank_slug: slug,
      upload_version: nextVersion,
      status,
      record_count: valid.length,
      sync_metadata: {
        total,
        fetched_count: entries.length,
        duplicates_in_set: duplicateHandles,
        content_hash: contentHash,
      },
      validation_errors: errors.length > 0 ? errors : null,
      collision_flags: collisions.length > 0 ? collisions : null,
      ...(canAutoApprove
        ? {
            approved_by: set.auto_sync_approved_by ?? user.id,
            approved_at: now,
          }
        : {}),
    })
    .select('upload_id')
    .single();

  if (uploadError || !upload) {
    return { error: `Failed to record upload: ${uploadError?.message}` };
  }

  // 7. Insert participants and results if valid
  if (valid.length > 0) {
    const participantRows = valid.map((v) => {
      const handle = v.hacker.toLowerCase().trim();
      const hasCollision = existingMap.has(handle);
      return {
        competition_id: set.competition_id,
        set_id: setId,
        upload_id: upload.upload_id,
        external_id: v.hacker.trim(),
        participant_name: v.hacker.trim(),
        has_collision: hasCollision,
      };
    });

    const { data: insertedParts, error: partError } = await adminClient
      .from('participants')
      .insert(participantRows)
      .select('participant_id, external_id');

    if (partError || !insertedParts) {
      return { error: `Failed to insert participants: ${partError?.message}` };
    }

    const partMap = new Map<string, string>();
    insertedParts.forEach((p) => {
      partMap.set(p.external_id.toLowerCase().trim(), p.participant_id);
    });

    const resultRows = valid.map((v) => {
      const pId = partMap.get(v.hacker.toLowerCase().trim())!;
      return {
        participant_id: pId,
        upload_id: upload.upload_id,
        total_score: v.score,
        problems_solved: v.solved_challenges ?? null,
        penalty: v.time_taken ?? null,
        raw_data: v as unknown as Record<string, unknown>,
      };
    });

    const { error: resError } = await adminClient.from('results').insert(resultRows);
    if (resError) {
      return { error: `Failed to insert scores: ${resError.message}` };
    }
  }

  // 8. Auto-publish live leaderboard if this set has one-time Super Admin approval
  let autoPublished = false;
  if (canAutoApprove && valid.length > 0) {
    const snapRes = await createCompetitionSnapshot(
      set.competition_id,
      set.auto_sync_approved_by ?? user.id,
      {
        publishImmediately: true,
        auditAction: 'LEADERBOARD_AUTO_PUBLISHED',
      },
    );
    if (snapRes.error) {
      return { error: snapRes.error };
    }
    autoPublished = true;
  } else if (!canAutoApprove) {
    // Update competition status for pending approval workflow
    const { data: allSets } = await adminClient
      .from('contest_sets')
      .select('set_id, uploads(status)')
      .eq('competition_id', set.competition_id);

    if (allSets && allSets.length > 0) {
      const allHaveSubmissions = allSets.every((s) => {
        const upList = (s.uploads as Array<{ status: string }>) || [];
        return upList.some((u) => u.status === 'PENDING_APPROVAL' || u.status === 'APPROVED');
      });

      if (allHaveSubmissions) {
        await adminClient
          .from('competitions')
          .update({ status: 'READY_FOR_REVIEW' })
          .eq('competition_id', set.competition_id)
          .neq('status', 'PUBLISHED');
      } else {
        await adminClient
          .from('competitions')
          .update({ status: 'AWAITING_SYNC' })
          .eq('competition_id', set.competition_id)
          .eq('status', 'NOT_STARTED');
      }
    }
  }

  // 9. Audit log
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: canAutoApprove ? 'HACKERRANK_AUTO_SYNC_PUBLISHED' : 'HACKERRANK_SYNC_REQUESTED',
    entity_type: 'upload',
    entity_id: upload.upload_id,
    details: {
      set_id: setId,
      set_name: set.set_name,
      lab_incharge_name: resolvedInchargeName,
      slug,
      version: nextVersion,
      valid_records: valid.length,
      errors_count: errors.length,
      collisions_count: collisions.length,
      auto_published: autoPublished,
    },
  });

  revalidatePath('/admin');
  revalidatePath('/upload');
  revalidatePath(`/upload/${setId}`);
  revalidatePath(`/admin/competitions/${set.competition_id}`);
  if (autoPublished) {
    revalidatePath('/leaderboard');
  }

  return {
    success: true,
    recordsCount: valid.length,
    warningsCount: collisions.length + errors.length,
    pendingApproval: currentAutoSyncStatus === 'PENDING',
    autoPublished,
    autoSyncStatus: currentAutoSyncStatus,
  };
}
