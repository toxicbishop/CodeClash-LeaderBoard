-- =============================================================================
-- Migration: 20261123000000_harden_v2_security.sql
-- Description:
-- 1. Atomic RPC function for saving tie-breaker rules (blocks published competitions)
-- 2. Public read-only view and RLS policies for published leaderboard snapshots
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Atomic RPC: save_tie_breaker_rules
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_tie_breaker_rules(
  p_competition_id UUID,
  p_rules JSONB,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.competition_status;
BEGIN
  SELECT status INTO v_status
  FROM public.competitions
  WHERE competition_id = p_competition_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Competition not found';
  END IF;

  IF v_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Cannot modify tie-breaker rules for a published competition';
  END IF;

  DELETE FROM public.tie_breaker_rules
  WHERE competition_id = p_competition_id;

  INSERT INTO public.tie_breaker_rules (
    competition_id,
    criterion,
    direction,
    enabled,
    priority,
    approved_by
  )
  SELECT
    p_competition_id,
    (r->>'criterion')::public.ranking_criterion,
    (r->>'direction')::public.sort_direction,
    (r->>'enabled')::BOOLEAN,
    (r->>'priority')::INTEGER,
    p_user_id
  FROM jsonb_array_elements(p_rules) AS r;
END;
$$;

COMMENT ON FUNCTION public.save_tie_breaker_rules IS
  'Atomically updates tie breaker rules for an unpublished competition.';

-- ---------------------------------------------------------------------------
-- 2. Public Read-Only View: public_leaderboard
-- ---------------------------------------------------------------------------

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
  cs.set_code
FROM public.leaderboard_entries le
JOIN public.leaderboard_snapshots ls ON ls.snapshot_id = le.snapshot_id
JOIN public.competitions c ON c.competition_id = ls.competition_id
JOIN public.participants p ON p.participant_id = le.participant_id
JOIN public.contest_sets cs ON cs.set_id = le.set_id
WHERE ls.status = 'PUBLISHED'
  AND c.status = 'PUBLISHED';

GRANT SELECT ON public.public_leaderboard TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Public Read RLS Policies for Published Data
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'competitions' AND policyname = 'public_read_published_competitions'
  ) THEN
    CREATE POLICY "public_read_published_competitions"
      ON public.competitions FOR SELECT
      TO anon, authenticated
      USING (status = 'PUBLISHED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leaderboard_snapshots' AND policyname = 'public_read_published_snapshots'
  ) THEN
    CREATE POLICY "public_read_published_snapshots"
      ON public.leaderboard_snapshots FOR SELECT
      TO anon, authenticated
      USING (status = 'PUBLISHED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leaderboard_entries' AND policyname = 'public_read_published_entries'
  ) THEN
    CREATE POLICY "public_read_published_entries"
      ON public.leaderboard_entries FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.leaderboard_snapshots ls
          WHERE ls.snapshot_id = leaderboard_entries.snapshot_id
            AND ls.status = 'PUBLISHED'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contest_sets' AND policyname = 'public_read_published_contest_sets'
  ) THEN
    CREATE POLICY "public_read_published_contest_sets"
      ON public.contest_sets FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.competitions c
          WHERE c.competition_id = contest_sets.competition_id
            AND c.status = 'PUBLISHED'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tie_breaker_rules' AND policyname = 'public_read_published_tie_breakers'
  ) THEN
    CREATE POLICY "public_read_published_tie_breakers"
      ON public.tie_breaker_rules FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.competitions c
          WHERE c.competition_id = tie_breaker_rules.competition_id
            AND c.status = 'PUBLISHED'
        )
      );
  END IF;
END $$;
