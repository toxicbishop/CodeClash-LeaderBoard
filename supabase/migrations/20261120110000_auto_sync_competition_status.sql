-- Migration: auto-sync competition lifecycle status via trigger
-- Fixes: manual competition status updates that could drift out of sync
-- with actual lab upload states.
--
-- The trigger fires after any INSERT/UPDATE/DELETE on uploads.
-- It recalculates the competition status purely from uploads data
-- so the two tables can never disagree.

CREATE OR REPLACE FUNCTION public.sync_competition_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_competition_id UUID;
  v_total_labs     INTEGER;
  v_submitted_labs INTEGER;
  v_approved_labs  INTEGER;
  v_new_status     public.competition_status;
BEGIN
  -- Determine which competition to update
  v_competition_id := COALESCE(NEW.competition_id, OLD.competition_id);

  -- Count total active labs for this competition
  SELECT COUNT(*) INTO v_total_labs
    FROM public.labs
   WHERE competition_id = v_competition_id
     AND status = 'ACTIVE';

  -- Count labs that have at least one non-rejected upload
  SELECT COUNT(DISTINCT lab_id) INTO v_submitted_labs
    FROM public.uploads
   WHERE competition_id = v_competition_id
     AND status IN ('PENDING_APPROVAL', 'APPROVED');

  -- Count labs that have an approved upload
  SELECT COUNT(DISTINCT lab_id) INTO v_approved_labs
    FROM public.uploads
   WHERE competition_id = v_competition_id
     AND status = 'APPROVED';

  -- Determine new status
  IF v_total_labs = 0 THEN
    v_new_status := 'NOT_STARTED';
  ELSIF v_approved_labs = v_total_labs THEN
    -- All labs approved → ready to publish
    v_new_status := 'PROCESSING';
  ELSIF v_submitted_labs = v_total_labs THEN
    -- All labs submitted (some still pending) → ready for review
    v_new_status := 'READY_FOR_REVIEW';
  ELSIF v_submitted_labs > 0 THEN
    -- At least one lab submitted → awaiting remaining
    v_new_status := 'AWAITING_UPLOAD';
  ELSE
    v_new_status := 'NOT_STARTED';
  END IF;

  -- Only update if the status actually changed (avoid unnecessary writes)
  UPDATE public.competitions
     SET status = v_new_status
   WHERE competition_id = v_competition_id
     AND status IS DISTINCT FROM v_new_status
     -- Never overwrite PUBLISHED — that's a one-way gate managed by the app
     AND status != 'PUBLISHED';

  RETURN NULL;
END;
$$;

-- Drop old trigger if it exists (safe re-run)
DROP TRIGGER IF EXISTS trg_sync_competition_status ON public.uploads;

CREATE TRIGGER trg_sync_competition_status
  AFTER INSERT OR UPDATE OF status OR DELETE
  ON public.uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_competition_status();

COMMENT ON FUNCTION public.sync_competition_status IS
  'Automatically recalculates competitions.status from uploads data after any
   upload insert, status change, or deletion. This prevents manual drift between
   the two tables. PUBLISHED status is never overwritten.';
