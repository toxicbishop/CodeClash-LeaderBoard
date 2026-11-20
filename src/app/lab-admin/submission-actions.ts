'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { ActionResponse } from '@/app/admin/actions';

type SubmissionRow = {
  number: number;
  cells: string[];
};

type SubmissionMapping = {
  participantId?: number;
  participantName?: number;
  totalScore?: number;
  problemsSolved?: number;
  penalty?: number;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const SAFE_NAME = /[^a-zA-Z0-9._-]/g;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

async function isValidFile(file: File): Promise<boolean> {
  if (file.size === 0 || file.size > MAX_FILE_SIZE) return false;
  if (/\.xlsx$/i.test(file.name)) {
    const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return signature.join(',') === '80,75,3,4';
  }
  if (/\.csv$/i.test(file.name)) {
    const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    return !bytes.includes(0);
  }
  return false;
}

function numericCell(cells: string[], index: number | undefined, fallback = 0) {
  if (index === undefined || !cells[index]?.trim()) return fallback;
  const value = Number(cells[index].trim());
  return Number.isFinite(value) ? value : null;
}

export async function submitLeaderboard(
  _previousState: ActionResponse,
  formData: FormData,
): Promise<ActionResponse> {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) return { error: 'Your session has expired. Please sign in again.' };

  const { data: profile } = await sessionClient
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.role !== 'LAB_ADMIN' || profile.account_status !== 'ACTIVE') {
    return { error: 'An active lab administrator account is required.' };
  }

  const competitionId = text(formData, 'competition_id');
  const labId = text(formData, 'lab_id');
  const fileName = text(formData, 'file_name');
  const rowsJson = text(formData, 'rows');
  const mappingJson = text(formData, 'mapping');
  const file = formData.get('file');

  if (
    !competitionId ||
    !labId ||
    !rowsJson ||
    !mappingJson ||
    !(file instanceof File) ||
    !(await isValidFile(file))
  ) {
    return { error: 'Choose a valid CSV or XLSX file and complete the column mapping.' };
  }

  let rows: SubmissionRow[];
  let mapping: SubmissionMapping;
  try {
    rows = JSON.parse(rowsJson) as SubmissionRow[];
    mapping = JSON.parse(mappingJson) as SubmissionMapping;
  } catch {
    return { error: 'The preview data could not be verified. Please select the file again.' };
  }

  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 100000) {
    return { error: 'The file must contain between 1 and 100,000 records.' };
  }
  if (
    mapping.participantId === undefined ||
    mapping.participantName === undefined ||
    mapping.totalScore === undefined
  ) {
    return { error: 'Participant ID, participant name, and total score must be mapped.' };
  }

  const { data: lab } = await sessionClient
    .from('labs')
    .select('lab_id, competition_id, lab_name, assigned_admin_id')
    .eq('lab_id', labId)
    .eq('competition_id', competitionId)
    .eq('assigned_admin_id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (!lab) return { error: 'This lab is not assigned to your account for the selected competition.' };

  const { data: competition } = await sessionClient
    .from('competitions')
    .select('upload_deadline')
    .eq('competition_id', competitionId)
    .maybeSingle();
  if (!competition) return { error: 'Competition not found.' };
  if (new Date(competition.upload_deadline).getTime() < Date.now()) {
    return { error: 'The upload deadline has passed.' };
  }

  const seen = new Set<string>();
  const issues: Array<{
    row_number: number;
    field_name: string;
    issue_type: string;
    raw_value: string | null;
    message: string;
  }> = [];
  const validRows: Array<{
    row: SubmissionRow;
    participantId: string;
    participantName: string;
    totalScore: number;
    problemsSolved: number;
    penalty: number | null;
  }> = [];

  for (const row of rows) {
    const participantId = row.cells[mapping.participantId]?.trim() ?? '';
    const participantName = row.cells[mapping.participantName]?.trim() ?? '';
    const scoreRaw = row.cells[mapping.totalScore]?.trim() ?? '';
    const totalScore = Number(scoreRaw);
    let rowValid = true;

    if (!participantId) {
      issues.push({
        row_number: row.number,
        field_name: 'participant_id',
        issue_type: 'MISSING_ID',
        raw_value: null,
        message: 'Participant ID is required.',
      });
      rowValid = false;
    }
    if (!participantName) {
      issues.push({
        row_number: row.number,
        field_name: 'participant_name',
        issue_type: 'MISSING_NAME',
        raw_value: null,
        message: 'Participant name is required.',
      });
      rowValid = false;
    }
    if (!scoreRaw || !Number.isFinite(totalScore) || totalScore < 0) {
      issues.push({
        row_number: row.number,
        field_name: 'total_score',
        issue_type: 'INVALID_SCORE',
        raw_value: scoreRaw || null,
        message: 'Total score must be a non-negative number.',
      });
      rowValid = false;
    }
    if (seen.has(participantId) && participantId) {
      issues.push({
        row_number: row.number,
        field_name: 'participant_id',
        issue_type: 'DUPLICATE_ID',
        raw_value: participantId,
        message: 'Participant ID appears more than once in this file.',
      });
      rowValid = false;
    }
    seen.add(participantId);

    const problemsSolved = numericCell(row.cells, mapping.problemsSolved, 0);
    const penalty = numericCell(row.cells, mapping.penalty, 0);

    if (problemsSolved === null || problemsSolved < 0) {
      issues.push({
        row_number: row.number,
        field_name: 'problems_solved',
        issue_type: 'INVALID_NUMBER',
        raw_value: row.cells[mapping.problemsSolved ?? -1] || null,
        message: 'Problems solved must be a non-negative number.',
      });
      rowValid = false;
    }
    if (penalty === null || penalty < 0) {
      issues.push({
        row_number: row.number,
        field_name: 'penalty',
        issue_type: 'INVALID_NUMBER',
        raw_value: row.cells[mapping.penalty ?? -1] || null,
        message: 'Penalty must be a non-negative number.',
      });
      rowValid = false;
    }

    if (rowValid) {
      validRows.push({
        row,
        participantId,
        participantName,
        totalScore,
        problemsSolved: problemsSolved ?? 0,
        penalty,
      });
    }
  }

  if (issues.length > 0) {
    return {
      error: `Validation failed for ${issues.length} row issue${issues.length === 1 ? '' : 's'}. Correct the preview before submitting.`,
      data: { issues },
    };
  }

  const adminClient = createAdminClient();
  const { data: latest } = await adminClient
    .from('uploads')
    .select('upload_version, status')
    .eq('lab_id', labId)
    .order('upload_version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.status === 'APPROVED') {
    return { error: 'Your submission for this lab has already been approved by the administrator.' };
  }

  const uploadVersion = (latest?.upload_version ?? 0) + 1;
  const safeFileName = (fileName || file.name).replace(SAFE_NAME, '_').slice(0, 180) || 'leaderboard.csv';
  const filePath = `uploads/${competitionId}/${labId}/v${uploadVersion}_${safeFileName}`;

  const fileBuffer = await file.arrayBuffer();
  const { error: storageError } = await adminClient.storage
    .from('leaderboard-uploads')
    .upload(filePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (storageError) return { error: `Could not archive the file: ${storageError.message}` };

  const { data: upload, error: uploadError } = await adminClient
    .from('uploads')
    .insert({
      competition_id: competitionId,
      lab_id: labId,
      uploaded_by: user.id,
      file_path: filePath,
      file_name: safeFileName,
      upload_version: uploadVersion,
      column_mapping: mapping,
      status: 'PENDING_APPROVAL',
      record_count: validRows.length,
    })
    .select('upload_id')
    .single();

  if (uploadError || !upload) {
    await adminClient.storage.from('leaderboard-uploads').remove([filePath]);
    return { error: uploadError?.message || 'Could not create the upload record.' };
  }

  for (const item of validRows) {
    const { data: participant, error: participantError } = await adminClient
      .from('participants')
      .upsert(
        {
          competition_id: competitionId,
          external_participant_id: item.participantId,
          participant_name: item.participantName,
        },
        { onConflict: 'competition_id,external_participant_id' }
      )
      .select('participant_id')
      .single();

    if (participantError || !participant) {
      return { error: participantError?.message || 'Could not store participant records.' };
    }

    const { error: resultError } = await adminClient.from('results').insert({
      participant_id: participant.participant_id,
      lab_id: labId,
      upload_id: upload.upload_id,
      total_score: item.totalScore,
      problems_solved: item.problemsSolved,
      penalty: item.penalty,
    });

    if (resultError) return { error: resultError.message };
  }

  if (issues.length > 0) {
    await adminClient
      .from('validation_issues')
      .insert(issues.map((issue) => ({ ...issue, upload_id: upload.upload_id })));
  }

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'UPLOAD_SUBMITTED',
    entity_type: 'upload',
    entity_id: upload.upload_id,
    metadata: {
      competition_id: competitionId,
      lab_id: labId,
      upload_version: uploadVersion,
      record_count: validRows.length,
    },
  });

  // Automatically transition competition status to READY_FOR_REVIEW if all labs have submitted
  const { data: compLabs } = await adminClient
    .from('labs')
    .select('lab_id')
    .eq('competition_id', competitionId)
    .eq('status', 'ACTIVE');

  const { data: compUploads } = await adminClient
    .from('uploads')
    .select('lab_id')
    .eq('competition_id', competitionId)
    .in('status', ['PENDING_APPROVAL', 'APPROVED']);

  const submittedLabIds = new Set(compUploads?.map((u) => u.lab_id));
  const allSubmitted =
    (compLabs || []).length > 0 && compLabs!.every((l) => submittedLabIds.has(l.lab_id));

  if (allSubmitted) {
    await adminClient
      .from('competitions')
      .update({ status: 'READY_FOR_REVIEW' })
      .eq('competition_id', competitionId);
  }

  revalidatePath('/admin');
  revalidatePath('/admin/competitions');
  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath('/lab-admin');
  return {
    success: true,
    data: {
      upload_id: upload.upload_id,
      upload_version: uploadVersion,
      record_count: validRows.length,
    },
  };
}
