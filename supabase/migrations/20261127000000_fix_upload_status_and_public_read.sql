-- =============================================================================
-- Migration: 20261127000000_fix_upload_status_and_public_read.sql
--
-- 1. Adds 'SUPERSEDED' to public.upload_status so re-syncing cleanly retires
--    prior APPROVED upload versions instead of failing silently.
-- 2. Idempotently ensures public_read_published_* RLS policies exist for anon
--    and authenticated readers of PUBLISHED competitions/snapshots.
-- =============================================================================

ALTER TYPE public.upload_status ADD VALUE IF NOT EXISTS 'SUPERSEDED';

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
