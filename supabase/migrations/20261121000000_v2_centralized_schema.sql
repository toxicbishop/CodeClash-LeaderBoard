-- =============================================================================
-- Code Clash Leaderboard — v2 Schema Migration
-- Migration: 20261121000000_v2_centralized_schema.sql
--
-- Architectural change: replaces the multi-lab model (many Lab Admins upload
-- per lab) with a centralized contest-set model (one Master Lab Admin syncs
-- all contest sets directly from HackerRank via API).
--
-- New roles: SUPER_ADMIN, MASTER_LAB_ADMIN, HOD, PRINCIPAL
-- New tables: contest_sets, tie_breaker_rules, audit_logs (replaces labs)
-- Modified: uploads, participants, results, leaderboard_snapshots/entries
-- =============================================================================


-- ---------------------------------------------------------------------------
-- STEP 1: Drop objects that depend on old enums/tables (cascade)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public.leaderboard_entries   CASCADE;
DROP TABLE IF EXISTS public.leaderboard_snapshots CASCADE;
DROP TABLE IF EXISTS public.results               CASCADE;
DROP TABLE IF EXISTS public.participants          CASCADE;
DROP TABLE IF EXISTS public.uploads               CASCADE;
DROP TABLE IF EXISTS public.labs                  CASCADE;
DROP TABLE IF EXISTS public.competitions          CASCADE;
DROP TABLE IF EXISTS public.users                 CASCADE;

DROP TYPE IF EXISTS upload_status        CASCADE;
DROP TYPE IF EXISTS snapshot_status      CASCADE;
DROP TYPE IF EXISTS competition_status   CASCADE;
DROP TYPE IF EXISTS competition_visibility CASCADE;
DROP TYPE IF EXISTS lab_status           CASCADE;
DROP TYPE IF EXISTS user_role            CASCADE;
DROP TYPE IF EXISTS account_status       CASCADE;


-- ---------------------------------------------------------------------------
-- STEP 2: Enums
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',        -- full control: create competitions, approve, publish
  'MASTER_LAB_ADMIN',   -- uploads all contest-set files via HackerRank sync
  'HOD',                -- read-only monitoring dashboard
  'PRINCIPAL'           -- read-only monitoring dashboard
);

CREATE TYPE account_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE competition_status AS ENUM (
  'NOT_STARTED',       -- no syncs yet
  'AWAITING_SYNC',     -- some sets pending sync
  'READY_FOR_REVIEW',  -- all sets synced and pending approval
  'APPROVED',          -- all sets approved, leaderboard generated
  'PUBLISHED'          -- leaderboard is publicly visible
);

CREATE TYPE upload_status AS ENUM (
  'PENDING',            -- slot exists, no sync yet
  'SYNCING',            -- HackerRank fetch in progress
  'VALIDATION_FAILED',  -- fetched but failed validation
  'PENDING_APPROVAL',   -- valid, awaiting Super Admin approval
  'APPROVED',           -- approved by Super Admin
  'REJECTED'            -- rejected by Super Admin with reason
);

CREATE TYPE snapshot_status AS ENUM (
  'DRAFT',       -- generated, not yet approved
  'APPROVED',    -- approved, not yet published
  'PUBLISHED',   -- live and visible to monitors
  'SUPERSEDED'   -- replaced by a newer version
);


-- ---------------------------------------------------------------------------
-- STEP 3: Users
-- ---------------------------------------------------------------------------

CREATE TABLE public.users (
  user_id        UUID           PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name           VARCHAR(100)   NOT NULL,
  email          VARCHAR(255)   NOT NULL UNIQUE,
  role           user_role      NOT NULL,
  account_status account_status NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS
  'Application user profiles. Roles: SUPER_ADMIN (competition control), '
  'MASTER_LAB_ADMIN (HackerRank sync), HOD and PRINCIPAL (read-only monitoring).';

CREATE INDEX idx_users_role   ON public.users(role);
CREATE INDEX idx_users_status ON public.users(account_status);


-- ---------------------------------------------------------------------------
-- STEP 4: Competitions
-- ---------------------------------------------------------------------------

CREATE TABLE public.competitions (
  competition_id   UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             VARCHAR(100)       NOT NULL UNIQUE,
  competition_name VARCHAR(255)       NOT NULL,
  description      TEXT,
  contest_date     DATE               NOT NULL,
  top_k            INTEGER            NOT NULL DEFAULT 10 CHECK (top_k > 0),
  status           competition_status NOT NULL DEFAULT 'NOT_STARTED',
  created_by       UUID               NOT NULL REFERENCES public.users(user_id),
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitions_status     ON public.competitions(status);
CREATE INDEX idx_competitions_created_by ON public.competitions(created_by);

COMMENT ON TABLE public.competitions IS
  'Each row represents one Code Clash competition event.';


-- ---------------------------------------------------------------------------
-- STEP 5: Contest Sets (replaces Labs)
-- ---------------------------------------------------------------------------

CREATE TABLE public.contest_sets (
  set_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id      UUID        NOT NULL REFERENCES public.competitions(competition_id) ON DELETE CASCADE,
  set_name            VARCHAR(100) NOT NULL,    -- display name e.g. "Set A"
  set_code            VARCHAR(20)  NOT NULL,    -- short code e.g. "setA"
  hackerrank_slug     VARCHAR(255) NOT NULL,    -- e.g. "codeclash-2026-setA"
  hr_session_cookie   TEXT,                     -- for private HR contests (stored server-side only)
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, set_code)
);

CREATE INDEX idx_contest_sets_competition ON public.contest_sets(competition_id);

COMMENT ON TABLE public.contest_sets IS
  'Each contest set maps to one HackerRank contest. Replaces the old labs table. '
  'The Master Lab Admin syncs leaderboard data from each set via the HackerRank API.';


-- ---------------------------------------------------------------------------
-- STEP 6: Tie-Breaker Rules (configurable ranking)
-- ---------------------------------------------------------------------------

CREATE TABLE public.tie_breaker_rules (
  rule_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID        NOT NULL REFERENCES public.competitions(competition_id) ON DELETE CASCADE,
  criterion      VARCHAR(50) NOT NULL CHECK (criterion IN (
                   'total_score', 'problems_solved', 'penalty',
                   'final_submission_time', 'incorrect_submissions'
                 )),
  priority       INTEGER     NOT NULL CHECK (priority > 0),
  direction      VARCHAR(4)  NOT NULL CHECK (direction IN ('ASC', 'DESC')),
  enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  approved_by    UUID        REFERENCES public.users(user_id),
  UNIQUE (competition_id, priority)
);

COMMENT ON TABLE public.tie_breaker_rules IS
  'Ordered ranking criteria per competition. priority=1 is the primary sort key. '
  'Super Admin approves the final configuration before leaderboard generation.';


-- ---------------------------------------------------------------------------
-- STEP 7: Uploads (modified — references contest_sets, not labs)
-- ---------------------------------------------------------------------------

CREATE TABLE public.uploads (
  upload_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    UUID          NOT NULL REFERENCES public.competitions(competition_id) ON DELETE CASCADE,
  set_id            UUID          NOT NULL REFERENCES public.contest_sets(set_id) ON DELETE CASCADE,
  uploaded_by       UUID          NOT NULL REFERENCES public.users(user_id),
  hackerrank_slug   VARCHAR(255)  NOT NULL,
  upload_version    INTEGER       NOT NULL DEFAULT 1,
  status            upload_status NOT NULL DEFAULT 'PENDING',
  record_count      INTEGER,
  sync_metadata     JSONB,       -- raw summary from HackerRank (total, page counts)
  validation_errors JSONB,       -- array of {row, field, message} objects
  collision_flags   JSONB,       -- array of {external_id, conflicting_set_id}
  uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  approved_by       UUID         REFERENCES public.users(user_id),
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT
);

CREATE INDEX idx_uploads_competition ON public.uploads(competition_id);
CREATE INDEX idx_uploads_set         ON public.uploads(set_id);
CREATE INDEX idx_uploads_status      ON public.uploads(status);

COMMENT ON TABLE public.uploads IS
  'One row per HackerRank sync attempt per contest set. Versioned — re-syncing creates '
  'a new version and archives the previous one.';


-- ---------------------------------------------------------------------------
-- STEP 8: Participants
-- ---------------------------------------------------------------------------

CREATE TABLE public.participants (
  participant_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id   UUID        NOT NULL REFERENCES public.competitions(competition_id) ON DELETE CASCADE,
  set_id           UUID        NOT NULL REFERENCES public.contest_sets(set_id) ON DELETE CASCADE,
  upload_id        UUID        NOT NULL REFERENCES public.uploads(upload_id) ON DELETE CASCADE,
  external_id      VARCHAR(255) NOT NULL,  -- HackerRank username / handle
  participant_name VARCHAR(255) NOT NULL,
  has_collision    BOOLEAN     NOT NULL DEFAULT FALSE  -- same external_id found in another set
);

CREATE INDEX idx_participants_competition ON public.participants(competition_id);
CREATE INDEX idx_participants_set         ON public.participants(set_id);
CREATE INDEX idx_participants_external_id ON public.participants(external_id);

COMMENT ON TABLE public.participants IS
  'One row per participant per upload. has_collision=TRUE means the same external_id '
  'appeared in a different contest set — requires admin review before publishing.';


-- ---------------------------------------------------------------------------
-- STEP 9: Results (scores from HackerRank)
-- ---------------------------------------------------------------------------

CREATE TABLE public.results (
  result_id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id          UUID          NOT NULL REFERENCES public.participants(participant_id) ON DELETE CASCADE,
  upload_id               UUID          NOT NULL REFERENCES public.uploads(upload_id) ON DELETE CASCADE,
  total_score             NUMERIC(10,2) NOT NULL,
  problems_solved         INTEGER,
  penalty                 NUMERIC(10,2),         -- lower is better (seconds or minutes)
  final_submission_time   NUMERIC(10,2),         -- seconds from contest start
  incorrect_submissions   INTEGER,
  raw_data                JSONB,                 -- original HackerRank API row preserved for audit
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_results_participant ON public.results(participant_id);
CREATE INDEX idx_results_upload      ON public.results(upload_id);

COMMENT ON TABLE public.results IS
  'Score data for each participant, sourced directly from the HackerRank API response. '
  'raw_data preserves the original API row for audit purposes.';


-- ---------------------------------------------------------------------------
-- STEP 10: Leaderboard Snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE public.leaderboard_snapshots (
  snapshot_id    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID            NOT NULL REFERENCES public.competitions(competition_id) ON DELETE CASCADE,
  version        INTEGER         NOT NULL DEFAULT 1,
  generated_by   UUID            REFERENCES public.users(user_id),
  approved_by    UUID            REFERENCES public.users(user_id),
  published_by   UUID            REFERENCES public.users(user_id),
  status         snapshot_status NOT NULL DEFAULT 'DRAFT',
  generated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  approved_at    TIMESTAMPTZ,
  published_at   TIMESTAMPTZ,
  UNIQUE (competition_id, version)
);

COMMENT ON TABLE public.leaderboard_snapshots IS
  'Immutable versioned snapshots of the unified leaderboard. '
  'Published snapshots are never modified; corrections produce a new version.';


-- ---------------------------------------------------------------------------
-- STEP 11: Leaderboard Entries
-- ---------------------------------------------------------------------------

CREATE TABLE public.leaderboard_entries (
  entry_id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id          UUID          NOT NULL REFERENCES public.leaderboard_snapshots(snapshot_id) ON DELETE CASCADE,
  participant_id       UUID          NOT NULL REFERENCES public.participants(participant_id),
  set_id               UUID          NOT NULL REFERENCES public.contest_sets(set_id),
  overall_rank         INTEGER       NOT NULL,
  total_score          NUMERIC(10,2) NOT NULL,
  problems_solved      INTEGER,
  penalty              NUMERIC(10,2),
  qualification_status VARCHAR(20)   NOT NULL DEFAULT 'NOT_QUALIFIED'
                       CHECK (qualification_status IN ('QUALIFIED', 'NOT_QUALIFIED', 'BOUNDARY_REVIEW'))
);

CREATE INDEX idx_entries_snapshot ON public.leaderboard_entries(snapshot_id);
CREATE INDEX idx_entries_rank     ON public.leaderboard_entries(overall_rank);

COMMENT ON TABLE public.leaderboard_entries IS
  'One row per participant per snapshot. qualification_status=BOUNDARY_REVIEW means '
  'the participant tied at exactly the Top-K cutoff and requires Super Admin review.';


-- ---------------------------------------------------------------------------
-- STEP 12: Audit Logs
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_logs (
  log_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,   -- e.g. 'UPLOAD_APPROVED', 'LEADERBOARD_PUBLISHED'
  entity_type VARCHAR(50),             -- e.g. 'upload', 'leaderboard_snapshot'
  entity_id   UUID,
  details     JSONB,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user      ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity    ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

COMMENT ON TABLE public.audit_logs IS
  'Append-only audit trail of all significant administrative actions.';


-- ---------------------------------------------------------------------------
-- STEP 13: Row-Level Security Policies
-- ---------------------------------------------------------------------------

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_sets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tie_breaker_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- Helper: get caller role (cast auth.uid() to users.role)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users
  WHERE user_id = auth.uid() AND account_status = 'ACTIVE'
  LIMIT 1;
$$;

-- ---- competitions: Super Admin full access, everyone else read ----
CREATE POLICY "super_admin_full_competitions"
  ON public.competitions FOR ALL
  USING (public.current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "read_competitions"
  ON public.competitions FOR SELECT
  USING (public.current_user_role() IN ('MASTER_LAB_ADMIN', 'HOD', 'PRINCIPAL'));

-- ---- contest_sets: Super Admin manages, others read ----
CREATE POLICY "super_admin_full_contest_sets"
  ON public.contest_sets FOR ALL
  USING (public.current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "read_contest_sets"
  ON public.contest_sets FOR SELECT
  USING (public.current_user_role() IN ('MASTER_LAB_ADMIN', 'HOD', 'PRINCIPAL'));

-- ---- uploads: Super Admin + Master Lab Admin write, monitors read ----
CREATE POLICY "admin_full_uploads"
  ON public.uploads FOR ALL
  USING (public.current_user_role() IN ('SUPER_ADMIN', 'MASTER_LAB_ADMIN'));

CREATE POLICY "monitors_read_uploads"
  ON public.uploads FOR SELECT
  USING (public.current_user_role() IN ('HOD', 'PRINCIPAL'));

-- ---- participants + results: Super Admin + Master Lab Admin write, monitors read ----
CREATE POLICY "admin_full_participants"
  ON public.participants FOR ALL
  USING (public.current_user_role() IN ('SUPER_ADMIN', 'MASTER_LAB_ADMIN'));

CREATE POLICY "monitors_read_participants"
  ON public.participants FOR SELECT
  USING (public.current_user_role() IN ('HOD', 'PRINCIPAL'));

CREATE POLICY "admin_full_results"
  ON public.results FOR ALL
  USING (public.current_user_role() IN ('SUPER_ADMIN', 'MASTER_LAB_ADMIN'));

CREATE POLICY "monitors_read_results"
  ON public.results FOR SELECT
  USING (public.current_user_role() IN ('HOD', 'PRINCIPAL'));

-- ---- tie_breaker_rules: Super Admin manages, others read ----
CREATE POLICY "super_admin_full_tiebreakers"
  ON public.tie_breaker_rules FOR ALL
  USING (public.current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "read_tiebreakers"
  ON public.tie_breaker_rules FOR SELECT
  USING (public.current_user_role() IN ('MASTER_LAB_ADMIN', 'HOD', 'PRINCIPAL'));

-- ---- leaderboard: Super Admin manages, others read published only ----
CREATE POLICY "super_admin_full_snapshots"
  ON public.leaderboard_snapshots FOR ALL
  USING (public.current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "admin_read_all_snapshots"
  ON public.leaderboard_snapshots FOR SELECT
  USING (public.current_user_role() = 'MASTER_LAB_ADMIN');

CREATE POLICY "monitors_read_snapshots"
  ON public.leaderboard_snapshots FOR SELECT
  USING (
    public.current_user_role() IN ('HOD', 'PRINCIPAL')
    -- monitors can see all snapshots (draft included) for transparency per spec §18.5
  );

CREATE POLICY "super_admin_full_entries"
  ON public.leaderboard_entries FOR ALL
  USING (public.current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "read_entries"
  ON public.leaderboard_entries FOR SELECT
  USING (public.current_user_role() IN ('MASTER_LAB_ADMIN', 'HOD', 'PRINCIPAL'));

-- ---- audit_logs: Super Admin + Master Lab Admin read, no one writes directly ----
CREATE POLICY "admin_read_audit"
  ON public.audit_logs FOR SELECT
  USING (public.current_user_role() IN ('SUPER_ADMIN', 'MASTER_LAB_ADMIN'));

-- ---- users: Super Admin full, others read own row only ----
CREATE POLICY "super_admin_full_users"
  ON public.users FOR ALL
  USING (public.current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "read_own_user"
  ON public.users FOR SELECT
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- STEP 14: Default Tie-Breaker seed function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_default_tiebreakers(p_competition_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.tie_breaker_rules
    (competition_id, criterion, priority, direction, enabled)
  VALUES
    (p_competition_id, 'total_score',       1, 'DESC', TRUE),
    (p_competition_id, 'problems_solved',   2, 'DESC', TRUE),
    (p_competition_id, 'penalty',           3, 'ASC',  TRUE),
    (p_competition_id, 'final_submission_time', 4, 'ASC', FALSE),
    (p_competition_id, 'incorrect_submissions', 5, 'ASC', FALSE)
  ON CONFLICT (competition_id, priority) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.seed_default_tiebreakers IS
  'Inserts the default ranking configuration for a new competition. '
  'Super Admin can enable/disable and reorder before approving.';
