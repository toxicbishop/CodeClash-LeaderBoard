-- =============================================================================
-- Migration: 20261128000000_multi_round_support.sql
-- Description:
--   Adds round_number support to contest_sets and leaderboard_snapshots so a
--   single competition can host sequential rounds (Round 1..N) while reusing
--   the same set codes (e.g. setA..setD) with distinct HackerRank slugs.
-- =============================================================================

ALTER TABLE public.contest_sets
  ADD COLUMN IF NOT EXISTS round_number INTEGER NOT NULL DEFAULT 1
    CHECK (round_number > 0);

-- Replace per-competition set_code uniqueness with per-(competition, round) uniqueness
ALTER TABLE public.contest_sets
  DROP CONSTRAINT IF EXISTS contest_sets_competition_id_set_code_key;

ALTER TABLE public.contest_sets
  ADD CONSTRAINT contest_sets_competition_id_round_number_set_code_key
    UNIQUE (competition_id, round_number, set_code);

CREATE INDEX IF NOT EXISTS idx_contest_sets_comp_round
  ON public.contest_sets(competition_id, round_number);

ALTER TABLE public.leaderboard_snapshots
  ADD COLUMN IF NOT EXISTS round_number INTEGER NOT NULL DEFAULT 1
    CHECK (round_number > 0);

CREATE INDEX IF NOT EXISTS idx_snapshots_comp_round_status
  ON public.leaderboard_snapshots(competition_id, round_number, status);

-- Refresh public_leaderboard view to include snapshot round_number
CREATE OR REPLACE VIEW public.public_leaderboard AS
SELECT 
  le.entry_id,
  le.snapshot_id,
  ls.competition_id,
  c.slug,
  c.competition_name,
  c.top_k,
  ls.version AS snapshot_version,
  ls.published_at,
  le.overall_rank,
  le.total_score,
  le.problems_solved,
  le.penalty,
  le.qualification_status,
  p.external_id,
  p.participant_name,
  cs.set_name,
  cs.set_code,
  ls.round_number
FROM public.leaderboard_entries le
JOIN public.leaderboard_snapshots ls ON ls.snapshot_id = le.snapshot_id
JOIN public.competitions c ON c.competition_id = ls.competition_id
JOIN public.participants p ON p.participant_id = le.participant_id
JOIN public.contest_sets cs ON cs.set_id = le.set_id
WHERE ls.status = 'PUBLISHED'
  AND c.status = 'PUBLISHED';

GRANT SELECT ON public.public_leaderboard TO anon, authenticated;
