-- =============================================================================
-- Code Clash Leaderboard — Supabase PostgreSQL Schema
-- Auth: Supabase Auth (auth.users) + app-level users table for profile/role
-- Run this in: Supabase Dashboard > SQL Editor
-- =============================================================================


-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('COMPETITION_ADMIN', 'LAB_ADMIN');
CREATE TYPE account_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE competition_status AS ENUM (
  'NOT_STARTED',
  'AWAITING_UPLOAD',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'PUBLISHED'
);

CREATE TYPE competition_visibility AS ENUM ('PUBLIC', 'RESTRICTED');

CREATE TYPE lab_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE upload_status AS ENUM (
  'SUBMITTED',
  'VALIDATION_FAILED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE snapshot_status AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');


-- ---------------------------------------------------------------------------
-- 1. USERS
-- Links to Supabase auth.users (auth.uid()) for session identity.
-- role + account_status are managed by Competition Admin.
-- password is handled entirely by Supabase Auth — not stored here.
-- ---------------------------------------------------------------------------

CREATE TABLE public.users (
  user_id       UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  role          user_role     NOT NULL,
  account_status account_status NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS
  'Application user profiles. Each row is linked 1-to-1 with a Supabase auth.users record.';

-- Index for fast role lookups (e.g. "list all LAB_ADMINs")
CREATE INDEX idx_users_role ON public.users(role);


-- ---------------------------------------------------------------------------
-- 2. COMPETITIONS
-- ---------------------------------------------------------------------------

CREATE TABLE public.competitions (
  competition_id   UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             VARCHAR(100)           NOT NULL UNIQUE,
  competition_name VARCHAR(255)           NOT NULL,
  description      TEXT,
  contest_date     DATE                   NOT NULL,
  upload_deadline  TIMESTAMPTZ            NOT NULL,
  top_k            INTEGER                NOT NULL DEFAULT 10 CHECK (top_k > 0),
  -- scoring_config drives tie-breaking order. Example:
  -- {"tiebreakers": ["problems_solved_desc", "penalty_asc", "final_submission_time_asc"]}
  -- boundary_policy: "ADMIT_ALL" | "STRICT_CUTOFF"
  scoring_config   JSONB                  NOT NULL DEFAULT '{"tiebreakers": ["problems_solved_desc", "penalty_asc", "final_submission_time_asc"], "boundary_policy": "ADMIT_ALL"}',
  status           competition_status     NOT NULL DEFAULT 'NOT_STARTED',
  visibility       competition_visibility NOT NULL DEFAULT 'PUBLIC',
  created_by       UUID                   NOT NULL REFERENCES public.users(user_id),
  created_at       TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.competitions.slug IS
  'URL-friendly identifier, e.g. "code-clash-2026". Used in public URLs.';
COMMENT ON COLUMN public.competitions.scoring_config IS
  'JSONB config for tie-breaking order and Top-K boundary policy.';

CREATE INDEX idx_competitions_status     ON public.competitions(status);
CREATE INDEX idx_competitions_visibility ON public.competitions(visibility);
CREATE INDEX idx_competitions_created_by ON public.competitions(created_by);


-- ---------------------------------------------------------------------------
-- 3. LABS
-- Each lab belongs to one competition and is managed by one Lab Admin.
-- ---------------------------------------------------------------------------

CREATE TABLE public.labs (
  lab_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    UUID        NOT NULL REFERENCES public.competitions(competition_id) ON DELETE CASCADE,
  lab_name          VARCHAR(100) NOT NULL,
  assigned_admin_id UUID        NOT NULL REFERENCES public.users(user_id),
  status            lab_status  NOT NULL DEFAULT 'ACTIVE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One admin can only manage one lab per competition
  CONSTRAINT uq_lab_name_per_competition   UNIQUE (competition_id, lab_name),
  CONSTRAINT uq_admin_per_competition      UNIQUE (competition_id, assigned_admin_id)
);

COMMENT ON CONSTRAINT uq_admin_per_competition ON public.labs IS
  'Prevents one Lab Admin from being assigned to two labs in the same competition.';

CREATE INDEX idx_labs_competition_id    ON public.labs(competition_id);
CREATE INDEX idx_labs_assigned_admin_id ON public.labs(assigned_admin_id);


-- ---------------------------------------------------------------------------
-- 4. UPLOADS
-- Raw file submissions from Lab Admins. Versioned per lab per competition.
-- column_mapping stores the Lab Admin's header-to-field mapping.
-- ---------------------------------------------------------------------------

CREATE TABLE public.uploads (
  upload_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id   UUID          NOT NULL REFERENCES public.competitions(competition_id) ON DELETE CASCADE,
  lab_id           UUID          NOT NULL REFERENCES public.labs(lab_id) ON DELETE CASCADE,
  uploaded_by      UUID          NOT NULL REFERENCES public.users(user_id),

  -- Storage: use Supabase Storage bucket path, e.g. "uploads/{competition_id}/{lab_id}/{filename}"
  file_path        VARCHAR(500)  NOT NULL,
  file_name        VARCHAR(255)  NOT NULL,
  upload_version   INTEGER       NOT NULL DEFAULT 1 CHECK (upload_version > 0),

  -- Column mapping saved after the Lab Admin maps headers
  -- Example: {"external_participant_id": "Username", "total_score": "Score", ...}
  column_mapping   JSONB,

  status           upload_status NOT NULL DEFAULT 'SUBMITTED',
  record_count     INTEGER       NOT NULL DEFAULT 0,
  uploaded_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Set after Competition Admin approves
  approved_by      UUID          REFERENCES public.users(user_id),
  approved_at      TIMESTAMPTZ,

  -- Set if Competition Admin rejects
  rejection_reason TEXT
);

COMMENT ON COLUMN public.uploads.column_mapping IS
  'Maps raw CSV/XLSX headers to internal field names. Null until mapping step is complete.';
COMMENT ON COLUMN public.uploads.file_path IS
  'Supabase Storage object path, e.g. uploads/{competition_id}/{lab_id}/v2_results.csv';

CREATE INDEX idx_uploads_lab_id        ON public.uploads(lab_id);
CREATE INDEX idx_uploads_competition_id ON public.uploads(competition_id);
CREATE INDEX idx_uploads_status        ON public.uploads(status);


-- ---------------------------------------------------------------------------
-- 5. VALIDATION ISSUES
-- Row-level issues found during automated validation of an upload.
-- Stored separately so the admin can inspect them in detail.
-- ---------------------------------------------------------------------------

CREATE TABLE public.validation_issues (
  issue_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id   UUID        NOT NULL REFERENCES public.uploads(upload_id) ON DELETE CASCADE,
  row_number  INTEGER     NOT NULL,
  field_name  VARCHAR(100),
  issue_type  VARCHAR(100) NOT NULL,  -- e.g. 'MISSING_ID', 'INVALID_SCORE', 'DUPLICATE_ID'
  raw_value   TEXT,
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validation_issues_upload_id ON public.validation_issues(upload_id);


-- ---------------------------------------------------------------------------
-- 6. PARTICIPANTS
-- Unique participant identities within a competition.
-- external_participant_id = HackerRank username / roll number from the file.
-- ---------------------------------------------------------------------------

CREATE TABLE public.participants (
  participant_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id          UUID         NOT NULL REFERENCES public.competitions(competition_id) ON DELETE CASCADE,
  external_participant_id VARCHAR(100) NOT NULL,
  participant_name        VARCHAR(255) NOT NULL,

  -- Cross-lab collision flag: set when same external_participant_id found in >1 lab
  has_collision           BOOLEAN      NOT NULL DEFAULT FALSE,

  CONSTRAINT uq_participant_per_competition UNIQUE (competition_id, external_participant_id)
);

COMMENT ON COLUMN public.participants.external_participant_id IS
  'The participant identifier from the uploaded file (e.g. HackerRank username, roll number).';
COMMENT ON COLUMN public.participants.has_collision IS
  'TRUE if this participant ID appears in more than one lab. Blocks consolidation until resolved.';

CREATE INDEX idx_participants_competition_id ON public.participants(competition_id);


-- ---------------------------------------------------------------------------
-- 7. RESULTS
-- Parsed and validated scores from an APPROVED upload.
-- Only inserted after upload status = APPROVED.
-- ---------------------------------------------------------------------------

CREATE TABLE public.results (
  result_id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id        UUID           NOT NULL REFERENCES public.participants(participant_id) ON DELETE CASCADE,
  lab_id                UUID           NOT NULL REFERENCES public.labs(lab_id) ON DELETE CASCADE,
  upload_id             UUID           NOT NULL REFERENCES public.uploads(upload_id) ON DELETE CASCADE,
  total_score           NUMERIC(8,2)   NOT NULL,
  problems_solved       INTEGER        NOT NULL DEFAULT 0,
  penalty               NUMERIC(10,2),  -- Contest duration in seconds, or null if unused
  final_submission_time TIMESTAMPTZ,

  -- One approved result per participant per competition (enforced via participant uniqueness above)
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_results_participant_id ON public.results(participant_id);
CREATE INDEX idx_results_lab_id         ON public.results(lab_id);
CREATE INDEX idx_results_upload_id      ON public.results(upload_id);


-- ---------------------------------------------------------------------------
-- 8. LEADERBOARD SNAPSHOTS
-- Versioned, immutable records of a published leaderboard.
-- Once status = PUBLISHED, entries are read-only.
-- ---------------------------------------------------------------------------

CREATE TABLE public.leaderboard_snapshots (
  leaderboard_id UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID            NOT NULL REFERENCES public.competitions(competition_id) ON DELETE CASCADE,
  version        INTEGER         NOT NULL DEFAULT 1 CHECK (version > 0),
  generated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  published_at   TIMESTAMPTZ,
  published_by   UUID            REFERENCES public.users(user_id),
  status         snapshot_status NOT NULL DEFAULT 'DRAFT',

  CONSTRAINT uq_snapshot_version UNIQUE (competition_id, version)
);

COMMENT ON TABLE public.leaderboard_snapshots IS
  'Each publish action creates a new immutable snapshot version. v1.0, v2.0, etc.';

CREATE INDEX idx_snapshots_competition_id ON public.leaderboard_snapshots(competition_id);
CREATE INDEX idx_snapshots_status         ON public.leaderboard_snapshots(status);


-- ---------------------------------------------------------------------------
-- 9. LEADERBOARD ENTRIES
-- The immutable ranked rows within a snapshot.
-- ---------------------------------------------------------------------------

CREATE TABLE public.leaderboard_entries (
  entry_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID         NOT NULL REFERENCES public.leaderboard_snapshots(leaderboard_id) ON DELETE CASCADE,
  participant_id UUID         NOT NULL REFERENCES public.participants(participant_id),
  lab_id         UUID         NOT NULL REFERENCES public.labs(lab_id),
  overall_rank   INTEGER      NOT NULL CHECK (overall_rank > 0),
  total_score    NUMERIC(8,2) NOT NULL,
  problems_solved INTEGER     NOT NULL,
  penalty        NUMERIC(10,2),
  is_qualified   BOOLEAN      NOT NULL DEFAULT FALSE,  -- TRUE if within Top-K

  CONSTRAINT uq_entry_per_snapshot UNIQUE (leaderboard_id, participant_id)
);

CREATE INDEX idx_entries_leaderboard_id ON public.leaderboard_entries(leaderboard_id);
CREATE INDEX idx_entries_rank           ON public.leaderboard_entries(leaderboard_id, overall_rank);


-- ---------------------------------------------------------------------------
-- 10. AUDIT LOG
-- Immutable record of every critical action in the system.
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_log (
  log_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES public.users(user_id),  -- NULL if system action
  action      VARCHAR(100) NOT NULL,  -- e.g. 'UPLOAD_APPROVED', 'LEADERBOARD_PUBLISHED'
  entity_type VARCHAR(100) NOT NULL,  -- e.g. 'upload', 'leaderboard_snapshot'
  entity_id   UUID        NOT NULL,
  metadata    JSONB,                  -- any extra context (rejection reason, version, etc.)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor_id    ON public.audit_log(actor_id);
CREATE INDEX idx_audit_log_entity      ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at  ON public.audit_log(created_at DESC);


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_issues     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log             ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- Helper function: get the current user's role from the users table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users
  WHERE user_id = auth.uid() AND account_status = 'ACTIVE';
$$;

-- ---------------------------------------------------------------------------
-- USERS policies
-- ---------------------------------------------------------------------------
-- Users can read their own row
CREATE POLICY "users: read own row"
  ON public.users FOR SELECT
  USING (user_id = auth.uid());

-- Competition Admin can read all users
CREATE POLICY "users: admin reads all"
  ON public.users FOR SELECT
  USING (public.current_user_role() = 'COMPETITION_ADMIN');

-- Competition Admin can insert new users (create Lab Admin accounts)
CREATE POLICY "users: admin inserts"
  ON public.users FOR INSERT
  WITH CHECK (public.current_user_role() = 'COMPETITION_ADMIN');

-- Competition Admin can update users (activate/deactivate)
CREATE POLICY "users: admin updates"
  ON public.users FOR UPDATE
  USING (public.current_user_role() = 'COMPETITION_ADMIN');

-- ---------------------------------------------------------------------------
-- COMPETITIONS policies
-- ---------------------------------------------------------------------------
-- Public competitions are readable by anyone (for the public leaderboard page)
CREATE POLICY "competitions: public reads public"
  ON public.competitions FOR SELECT
  USING (visibility = 'PUBLIC' OR public.current_user_role() IS NOT NULL);

-- Only Competition Admin can create/update competitions
CREATE POLICY "competitions: admin writes"
  ON public.competitions FOR INSERT
  WITH CHECK (public.current_user_role() = 'COMPETITION_ADMIN');

CREATE POLICY "competitions: admin updates"
  ON public.competitions FOR UPDATE
  USING (public.current_user_role() = 'COMPETITION_ADMIN');

-- ---------------------------------------------------------------------------
-- LABS policies
-- ---------------------------------------------------------------------------
-- Lab Admin sees only their assigned lab
CREATE POLICY "labs: lab admin sees own lab"
  ON public.labs FOR SELECT
  USING (
    assigned_admin_id = auth.uid()
    OR public.current_user_role() = 'COMPETITION_ADMIN'
  );

CREATE POLICY "labs: admin writes"
  ON public.labs FOR ALL
  USING (public.current_user_role() = 'COMPETITION_ADMIN');

-- ---------------------------------------------------------------------------
-- UPLOADS policies
-- ---------------------------------------------------------------------------
-- Lab Admin can read and insert uploads only for their own lab
CREATE POLICY "uploads: lab admin own lab"
  ON public.uploads FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR public.current_user_role() = 'COMPETITION_ADMIN'
  );

CREATE POLICY "uploads: lab admin can upload"
  ON public.uploads FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.current_user_role() = 'LAB_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.labs AS lab
      WHERE lab.lab_id = uploads.lab_id
        AND lab.competition_id = uploads.competition_id
        AND lab.assigned_admin_id = auth.uid()
    )
  );

-- Competition Admin can update (approve/reject)
CREATE POLICY "uploads: admin can update"
  ON public.uploads FOR UPDATE
  USING (public.current_user_role() = 'COMPETITION_ADMIN');

-- ---------------------------------------------------------------------------
-- VALIDATION ISSUES policies
-- ---------------------------------------------------------------------------
CREATE POLICY "validation_issues: readable by upload owner and admin"
  ON public.validation_issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.uploads u
      WHERE u.upload_id = validation_issues.upload_id
        AND (u.uploaded_by = auth.uid() OR public.current_user_role() = 'COMPETITION_ADMIN')
    )
  );

-- System/service role inserts validation issues
CREATE POLICY "validation_issues: service inserts"
  ON public.validation_issues FOR INSERT
  WITH CHECK (public.current_user_role() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- PARTICIPANTS policies
-- ---------------------------------------------------------------------------
CREATE POLICY "participants: authenticated reads"
  ON public.participants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "participants: admin or service writes"
  ON public.participants FOR ALL
  USING (public.current_user_role() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- RESULTS policies
-- ---------------------------------------------------------------------------
CREATE POLICY "results: authenticated reads"
  ON public.results FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "results: admin writes"
  ON public.results FOR ALL
  USING (public.current_user_role() = 'COMPETITION_ADMIN');

-- ---------------------------------------------------------------------------
-- LEADERBOARD SNAPSHOTS policies
-- ---------------------------------------------------------------------------
-- Published snapshots are publicly readable
CREATE POLICY "snapshots: public reads published"
  ON public.leaderboard_snapshots FOR SELECT
  USING (
    status = 'PUBLISHED'
    OR public.current_user_role() = 'COMPETITION_ADMIN'
  );

CREATE POLICY "snapshots: admin writes"
  ON public.leaderboard_snapshots FOR ALL
  USING (public.current_user_role() = 'COMPETITION_ADMIN');

-- ---------------------------------------------------------------------------
-- LEADERBOARD ENTRIES policies
-- ---------------------------------------------------------------------------
CREATE POLICY "entries: public reads published snapshots"
  ON public.leaderboard_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_snapshots s
      WHERE s.leaderboard_id = leaderboard_entries.leaderboard_id
        AND (s.status = 'PUBLISHED' OR public.current_user_role() = 'COMPETITION_ADMIN')
    )
  );

CREATE POLICY "entries: admin writes"
  ON public.leaderboard_entries FOR ALL
  USING (public.current_user_role() = 'COMPETITION_ADMIN');

-- ---------------------------------------------------------------------------
-- AUDIT LOG policies
-- ---------------------------------------------------------------------------
CREATE POLICY "audit_log: admin reads"
  ON public.audit_log FOR SELECT
  USING (public.current_user_role() = 'COMPETITION_ADMIN');

-- Any authenticated action can insert a log (enforced at app layer)
CREATE POLICY "audit_log: authenticated inserts"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ---------------------------------------------------------------------------
-- STORAGE: leaderboard-uploads
-- Private raw-file archive for lab leaderboard submissions (.csv, .xlsx).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leaderboard-uploads',
  'leaderboard-uploads',
  false,
  5242880,
  ARRAY['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880;

CREATE POLICY "leaderboard archive: admins can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'leaderboard-uploads'
    AND public.current_user_role() = 'COMPETITION_ADMIN'
  );


-- =============================================================================
-- SEED: Default Competition Admin
-- =============================================================================
-- After running this schema, create the Competition Admin via Supabase Auth:
--   1. Go to Supabase Dashboard > Authentication > Users > Add User
--      (or use supabase.auth.admin.createUser() in a one-time seed script)
--   2. Then insert their profile row here:
--
-- INSERT INTO public.users (user_id, name, email, role)
-- VALUES ('<uuid-from-auth-users>', 'Admin Name', 'admin@example.com', 'COMPETITION_ADMIN');
