-- =============================================================================
-- Migration: 20261126000000_auto_sync_authorization.sql
-- Description:
--   Adds one-time Super Admin auto-sync authorization and Lab In-Charge
--   identity tracking to public.contest_sets.
-- =============================================================================

ALTER TABLE public.contest_sets
  ADD COLUMN IF NOT EXISTS lab_incharge_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS auto_sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (auto_sync_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  ADD COLUMN IF NOT EXISTS auto_sync_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS auto_sync_approved_by UUID REFERENCES public.users(user_id),
  ADD COLUMN IF NOT EXISTS auto_sync_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_lab_admin_id UUID REFERENCES public.users(user_id);

CREATE INDEX IF NOT EXISTS idx_contest_sets_auto_sync_status
  ON public.contest_sets(competition_id, auto_sync_status);
