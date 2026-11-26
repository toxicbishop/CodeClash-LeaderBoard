export type UserRole = 'SUPER_ADMIN' | 'MASTER_LAB_ADMIN' | 'HOD' | 'PRINCIPAL';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export type CompetitionStatus =
  | 'NOT_STARTED'
  | 'AWAITING_SYNC'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED';

export type UploadStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'VALIDATION_FAILED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export type SnapshotStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED';

export type AutoSyncStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type QualificationStatus = 'QUALIFIED' | 'NOT_QUALIFIED' | 'BOUNDARY_REVIEW';

export type TieBreakerCriterion =
  | 'total_score'
  | 'problems_solved'
  | 'penalty'
  | 'final_submission_time'
  | 'incorrect_submissions';

// ---- Entities ----------------------------------------------------------------

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  created_at: string;
}

export interface Competition {
  competition_id: string;
  slug: string;
  competition_name: string;
  description: string | null;
  contest_date: string;
  top_k: number;
  status: CompetitionStatus;
  created_by: string;
  created_at: string;
}

export interface ContestSet {
  set_id: string;
  competition_id: string;
  set_name: string;       // "Set A"
  set_code: string;       // "setA"
  hackerrank_slug: string; // "codeclash-2026-setA"
  lab_incharge_name?: string | null;
  auto_sync_status?: AutoSyncStatus;
  auto_sync_rejection_reason?: string | null;
  auto_sync_approved_by?: string | null;
  auto_sync_approved_at?: string | null;
  assigned_lab_admin_id?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TieBreakerRule {
  rule_id: string;
  competition_id: string;
  criterion: TieBreakerCriterion;
  priority: number;
  direction: 'ASC' | 'DESC';
  enabled: boolean;
  approved_by: string | null;
}

export interface Upload {
  upload_id: string;
  competition_id: string;
  set_id: string;
  uploaded_by: string;
  hackerrank_slug: string;
  upload_version: number;
  status: UploadStatus;
  record_count: number | null;
  sync_metadata: Record<string, unknown> | null;
  validation_errors: ValidationError[] | null;
  collision_flags: CollisionFlag[] | null;
  uploaded_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface CollisionFlag {
  external_id: string;
  conflicting_set_id: string;
  conflicting_set_name: string;
}

export interface Participant {
  participant_id: string;
  competition_id: string;
  set_id: string;
  upload_id: string;
  external_id: string;    // HackerRank username
  participant_name: string;
  has_collision: boolean;
}

export interface Result {
  result_id: string;
  participant_id: string;
  upload_id: string;
  total_score: number;
  problems_solved: number | null;
  penalty: number | null;
  final_submission_time: number | null;
  incorrect_submissions: number | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface LeaderboardSnapshot {
  snapshot_id: string;
  competition_id: string;
  version: number;
  generated_by: string | null;
  approved_by: string | null;
  published_by: string | null;
  status: SnapshotStatus;
  generated_at: string;
  approved_at: string | null;
  published_at: string | null;
}

export interface LeaderboardEntry {
  entry_id: string;
  snapshot_id: string;
  participant_id: string;
  set_id: string;
  overall_rank: number;
  total_score: number;
  problems_solved: number | null;
  penalty: number | null;
  qualification_status: QualificationStatus;
  // joined
  participant?: Participant;
  contest_set?: ContestSet;
}

export interface AuditLog {
  log_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}
