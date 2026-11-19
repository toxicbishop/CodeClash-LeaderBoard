export type UserRole = 'COMPETITION_ADMIN' | 'LAB_ADMIN';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';
export type CompetitionStatus =
  | 'NOT_STARTED'
  | 'AWAITING_UPLOAD'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'PUBLISHED';
export type CompetitionVisibility = 'PUBLIC' | 'RESTRICTED';
export type LabStatus = 'ACTIVE' | 'INACTIVE';
export type UploadStatus =
  | 'SUBMITTED'
  | 'VALIDATION_FAILED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';
export type SnapshotStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';

export interface ScoringConfig {
  tiebreakers: string[];
  boundary_policy: 'ADMIT_ALL' | 'STRICT_CUTOFF';
}

export interface ColumnMapping {
  external_participant_id: string;
  participant_name: string;
  total_score: string;
  problems_solved?: string;
  penalty?: string;
  final_submission_time?: string;
}

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
  upload_deadline: string;
  top_k: number;
  scoring_config: ScoringConfig;
  status: CompetitionStatus;
  visibility: CompetitionVisibility;
  created_by: string;
  created_at: string;
}

export interface Lab {
  lab_id: string;
  competition_id: string;
  lab_name: string;
  assigned_admin_id: string;
  status: LabStatus;
  created_at: string;
  admin?: User;
}

export interface Upload {
  upload_id: string;
  competition_id: string;
  lab_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  upload_version: number;
  column_mapping: ColumnMapping | null;
  status: UploadStatus;
  record_count: number;
  uploaded_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  lab?: Lab;
}

export interface ValidationIssue {
  issue_id: string;
  upload_id: string;
  row_number: number;
  field_name: string | null;
  issue_type: string;
  raw_value: string | null;
  message: string;
  created_at: string;
}

export interface Participant {
  participant_id: string;
  competition_id: string;
  external_participant_id: string;
  participant_name: string;
  has_collision: boolean;
}

export interface Result {
  result_id: string;
  participant_id: string;
  lab_id: string;
  upload_id: string;
  total_score: number;
  problems_solved: number;
  penalty: number | null;
  final_submission_time: string | null;
  created_at: string;
  participant?: Participant;
  lab?: Lab;
}

export interface LeaderboardSnapshot {
  leaderboard_id: string;
  competition_id: string;
  version: number;
  generated_at: string;
  published_at: string | null;
  published_by: string | null;
  status: SnapshotStatus;
}

export interface LeaderboardEntry {
  entry_id: string;
  leaderboard_id: string;
  participant_id: string;
  lab_id: string;
  overall_rank: number;
  total_score: number;
  problems_solved: number;
  penalty: number | null;
  is_qualified: boolean;
  participant?: Participant;
  lab?: Lab;
}
