import { NextRequest, NextResponse } from 'next/server';
import { requireAnyAuthorizedUser } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Escapes CSV values and prevents CSV formula injection
 * (e.g., cell values starting with =, +, -, or @).
 */
function sanitizeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  // Formula injection prevention
  let safeStr = str;
  if (/^[=+\-@\t\r]/.test(safeStr)) {
    safeStr = "'" + safeStr;
  }
  // Double quotes escaping
  if (safeStr.includes(',') || safeStr.includes('"') || safeStr.includes('\n') || safeStr.includes('\r')) {
    return `"${safeStr.replace(/"/g, '""')}"`;
  }
  return safeStr;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { profile } = await requireAnyAuthorizedUser();
    const { id: competitionId } = await params;
    const url = new URL(request.url);
    const requestedSnapshotId = url.searchParams.get('snapshotId');

    const adminClient = createAdminClient();

    // 1. Fetch competition
    const { data: competition, error: compErr } = await adminClient
      .from('competitions')
      .select('*')
      .eq('competition_id', competitionId)
      .maybeSingle();

    if (compErr || !competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // 2. Fetch snapshot
    let snapshotQuery = adminClient
      .from('leaderboard_snapshots')
      .select('*')
      .eq('competition_id', competitionId);

    if (requestedSnapshotId) {
      snapshotQuery = snapshotQuery.eq('snapshot_id', requestedSnapshotId);
    } else {
      snapshotQuery = snapshotQuery.order('version', { ascending: false }).limit(1);
    }

    const { data: snapshots, error: snapErr } = await snapshotQuery;
    const snapshot = snapshots && snapshots.length > 0 ? snapshots[0] : null;

    if (snapErr || !snapshot) {
      return NextResponse.json(
        { error: 'No generated leaderboard snapshot found for this competition.' },
        { status: 404 }
      );
    }

    // 3. Fetch leaderboard entries
    const { data: entries, error: entriesErr } = await adminClient
      .from('leaderboard_entries')
      .select(`
        entry_id,
        overall_rank,
        total_score,
        problems_solved,
        penalty,
        qualification_status,
        participants!inner(external_id, participant_name),
        contest_sets!inner(set_name, set_code)
      `)
      .eq('snapshot_id', snapshot.snapshot_id)
      .order('overall_rank', { ascending: true })
      .order('total_score', { ascending: false });

    if (entriesErr) {
      return NextResponse.json({ error: 'Failed to retrieve snapshot entries' }, { status: 500 });
    }

    // 4. Construct CSV with official metadata header
    const metadataHeader = [
      `# Official Leaderboard Export`,
      `# Competition: ${sanitizeCsvValue(competition.competition_name)} (${competition.slug})`,
      `# Snapshot Version: v${snapshot.version} [${snapshot.status}]`,
      `# Generated At: ${snapshot.generated_at}`,
      `# Published At: ${snapshot.published_at || 'Unpublished (Draft)'}`,
      `# Exported By: ${sanitizeCsvValue(profile.name)} (${profile.role}) at ${new Date().toISOString()}`,
      `# Top-K Cutoff: Top ${competition.top_k}`,
      '',
    ].join('\r\n');

    const columnHeaders = [
      'Rank',
      'HackerRank Handle',
      'Contestant Name',
      'Contest Set',
      'Set Code',
      'Total Score',
      'Problems Solved',
      'Penalty (seconds)',
      'Qualification Status',
    ].join(',');

    const rows = (entries || []).map((row: any) => {
      return [
        row.overall_rank,
        sanitizeCsvValue(row.participants?.external_id),
        sanitizeCsvValue(row.participants?.participant_name),
        sanitizeCsvValue(row.contest_sets?.set_name),
        sanitizeCsvValue(row.contest_sets?.set_code),
        row.total_score,
        row.problems_solved ?? 0,
        row.penalty ?? '',
        sanitizeCsvValue(row.qualification_status),
      ].join(',');
    });

    const csvContent = '\uFEFF' + metadataHeader + columnHeaders + '\r\n' + rows.join('\r\n');

    const filename = `${competition.slug}_leaderboard_v${snapshot.version}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    if (err?.digest?.startsWith?.('NEXT_REDIRECT')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
