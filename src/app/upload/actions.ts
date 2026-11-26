'use server';

import { revalidatePath } from 'next/cache';
import { requireMasterLabAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { extractContestSlug, fetchContestLeaderboard, HackerRankError } from '@/lib/hackerrank/client';
import { validateHackerRankEntries } from '@/lib/hackerrank/validate';
import { isValidUuid } from '@/lib/validation/uuid';
import { decryptSecret, encryptSecret } from '@/lib/security/encryption';
import { checkRateLimit } from '@/lib/security/rate-limit';

export type SyncResponse = {
  success?: boolean;
  error?: string | null;
  recordsCount?: number;
  warningsCount?: number;
};

export async function syncContestSetFromHackerRank(
  setId: string,
  overrideSlug?: string,
  sessionCookie?: string
): Promise<SyncResponse> {
  const { user, supabase } = await requireMasterLabAdmin();

  if (!isValidUuid(setId)) {
    return { error: 'Invalid contest set ID.' };
  }

  // Rate limiting per user: 5 syncs per 60 seconds
  const rateLimit = checkRateLimit('hr_sync', user.id, 5, 60000);
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

  const rawSlugInput = (overrideSlug?.trim() || set.hackerrank_slug || '').trim();
  const slug = extractContestSlug(rawSlugInput);
  if (!slug) {
    return {
      error: `Invalid HackerRank contest slug: "${rawSlugInput}". Enter the contest slug (e.g. codeclash-2026-setA) or a valid hackerrank.com/contests/<slug> URL.`,
    };
  }

  // Decrypt stored session cookie if present, never log it
  let cookie: string | undefined = undefined;
  if (sessionCookie?.trim()) {
    cookie = sessionCookie.trim();
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

  const adminClient = await createAdminClient();

  // Persist verified session cookie (AES-256-GCM encrypted) so future syncs don't require re-pasting
  const providedCookie = sessionCookie?.replace(/[\r\n]+/g, '').trim();
  if (providedCookie) {
    await adminClient
      .from('contest_sets')
      .update({ hr_session_cookie: encryptSecret(providedCookie) })
      .eq('set_id', setId);
  }

  const { entries, total } = fetchResult;

  // 3. Validate entries
  const { valid, errors, duplicateHandles } = validateHackerRankEntries(entries);

  // 4. Determine next version
  const { data: lastUpload } = await supabase
    .from('uploads')
    .select('upload_version')
    .eq('set_id', setId)
    .order('upload_version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (lastUpload?.upload_version ?? 0) + 1;
  const status = errors.length > 0 ? 'VALIDATION_FAILED' : 'PENDING_APPROVAL';

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
      sync_metadata: { total, fetched_count: entries.length, duplicates_in_set: duplicateHandles },
      validation_errors: errors.length > 0 ? errors : null,
      collision_flags: collisions.length > 0 ? collisions : null,
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

  // 8. Update competition status check
  // Check if all sets have an approved or pending_approval upload
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

  // 9. Audit log
  await adminClient.from('audit_logs').insert({
    user_id: user.id,
    action: 'HACKERRANK_SYNC_COMPLETED',
    entity_type: 'upload',
    entity_id: upload.upload_id,
    details: {
      set_id: setId,
      set_name: set.set_name,
      slug,
      version: nextVersion,
      valid_records: valid.length,
      errors_count: errors.length,
      collisions_count: collisions.length,
    },
  });

  revalidatePath('/upload');
  revalidatePath(`/upload/${setId}`);
  revalidatePath(`/admin/competitions/${set.competition_id}`);

  return {
    success: true,
    recordsCount: valid.length,
    warningsCount: collisions.length + errors.length,
  };
}
