import { revalidatePath, updateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { computeRankings } from '@/lib/ranking/engine';
import { LEADERBOARD_CACHE_TAG } from '@/lib/leaderboard/cache';
import type { TieBreakerRule } from '@/types/database';

export interface SnapshotResult {
  success?: boolean;
  error?: string;
  data?: {
    snapshot_id: string;
    version: number;
    total_entries: number;
  };
}

/**
 * Consolidates all APPROVED uploads for a competition, computes rankings using
 * the competition's tie-breaker rules, and creates either a DRAFT snapshot or an
 * immediately PUBLISHED snapshot (superseding prior published snapshots).
 */
export async function createCompetitionSnapshot(
  competitionId: string,
  actorUserId: string,
  options: { publishImmediately: boolean; auditAction?: string },
): Promise<SnapshotResult> {
  const adminClient = createAdminClient();

  const [
    { data: competition, error: compError },
    { data: rules },
    { data: activeSets, error: setsError },
    { data: lastSnap },
  ] = await Promise.all([
    adminClient
      .from('competitions')
      .select('competition_id, top_k')
      .eq('competition_id', competitionId)
      .single(),
    adminClient
      .from('tie_breaker_rules')
      .select('*')
      .eq('competition_id', competitionId)
      .order('priority', { ascending: true }),
    adminClient
      .from('contest_sets')
      .select('set_id')
      .eq('competition_id', competitionId)
      .eq('is_active', true),
    adminClient
      .from('leaderboard_snapshots')
      .select('version')
      .eq('competition_id', competitionId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (compError || !competition) {
    return { error: 'Competition not found.' };
  }

  const activeSetIds = (activeSets ?? []).map((s) => s.set_id);
  if (setsError || activeSetIds.length === 0) {
    return { error: 'No approved submissions found to consolidate.' };
  }

  // Pick only the latest APPROVED upload per active contest set so historical
  // approved uploads never produce duplicate leaderboard entries.
  const { data: approvedUploads, error: uploadsError } = await adminClient
    .from('uploads')
    .select('upload_id, set_id, upload_version')
    .eq('competition_id', competitionId)
    .eq('status', 'APPROVED')
    .in('set_id', activeSetIds)
    .order('upload_version', { ascending: false });

  if (uploadsError) {
    return { error: `Failed to fetch approved uploads: ${uploadsError.message}` };
  }

  const latestUploadBySet = new Map<string, string>();
  for (const upload of approvedUploads ?? []) {
    if (!latestUploadBySet.has(upload.set_id)) {
      latestUploadBySet.set(upload.set_id, upload.upload_id);
    }
  }

  const latestUploadIds = Array.from(latestUploadBySet.values());
  if (latestUploadIds.length === 0) {
    return { error: 'No approved submissions found to consolidate.' };
  }

  const { data: participants, error: partError } = await adminClient
    .from('participants')
    .select(
      'participant_id, external_id, participant_name, set_id, contest_sets!inner(set_name, is_active), results(total_score, problems_solved, penalty, final_submission_time, incorrect_submissions)',
    )
    .eq('competition_id', competitionId)
    .in('upload_id', latestUploadIds);

  const activeRules: TieBreakerRule[] =
    rules && rules.length > 0
      ? (rules as TieBreakerRule[])
      : [
          {
            rule_id: '1',
            competition_id: competitionId,
            criterion: 'total_score',
            priority: 1,
            direction: 'DESC',
            enabled: true,
            approved_by: null,
          },
          {
            rule_id: '2',
            competition_id: competitionId,
            criterion: 'problems_solved',
            priority: 2,
            direction: 'DESC',
            enabled: true,
            approved_by: null,
          },
          {
            rule_id: '3',
            competition_id: competitionId,
            criterion: 'penalty',
            priority: 3,
            direction: 'ASC',
            enabled: true,
            approved_by: null,
          },
        ];

  if (partError || !participants || participants.length === 0) {
    return { error: 'No approved submissions found to consolidate.' };
  }

  const flatInput = participants.map((p) => {
    const r = (
      p.results as unknown as Array<{
        total_score: number;
        problems_solved: number | null;
        penalty: number | null;
        final_submission_time: number | null;
        incorrect_submissions: number | null;
      }>
    )?.[0];
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

  const ranked = computeRankings(flatInput, activeRules, competition.top_k);

  const newVersion = (lastSnap?.version ?? 0) + 1;
  const now = new Date().toISOString();

  const { data: snapshot, error: snapError } = await adminClient
    .from('leaderboard_snapshots')
    .insert({
      competition_id: competitionId,
      version: newVersion,
      generated_by: actorUserId,
      ...(options.publishImmediately
        ? {
            status: 'PUBLISHED',
            approved_by: actorUserId,
            approved_at: now,
            published_by: actorUserId,
            published_at: now,
          }
        : {
            status: 'DRAFT',
          }),
    })
    .select('snapshot_id')
    .single();

  if (snapError || !snapshot) {
    return { error: `Failed to create snapshot: ${snapError?.message}` };
  }

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
  if (entryError) {
    return { error: `Failed to insert entries: ${entryError.message}` };
  }

  const postOps: PromiseLike<unknown>[] = [
    adminClient.from('audit_logs').insert({
      user_id: actorUserId,
      action:
        options.auditAction ??
        (options.publishImmediately ? 'LEADERBOARD_AUTO_PUBLISHED' : 'LEADERBOARD_GENERATED'),
      entity_type: 'leaderboard_snapshot',
      entity_id: snapshot.snapshot_id,
      details: { competition_id: competitionId, version: newVersion, total_entries: entries.length },
    }),
  ];

  if (options.publishImmediately) {
    postOps.push(
      adminClient
        .from('leaderboard_snapshots')
        .update({ status: 'SUPERSEDED' })
        .eq('competition_id', competitionId)
        .neq('snapshot_id', snapshot.snapshot_id),
      adminClient
        .from('competitions')
        .update({ status: 'PUBLISHED' })
        .eq('competition_id', competitionId),
    );
  }

  await Promise.all(postOps);

  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath('/monitor');
  if (options.publishImmediately) {
    updateTag(LEADERBOARD_CACHE_TAG);
    revalidatePath('/leaderboard');
  }

  return {
    success: true,
    data: {
      snapshot_id: snapshot.snapshot_id,
      version: newVersion,
      total_entries: entries.length,
    },
  };
}
