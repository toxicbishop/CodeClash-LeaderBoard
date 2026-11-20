BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

-- Setup test users
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');

INSERT INTO public.users (user_id, name, email, role) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Super Admin', 'super@fixture.invalid', 'SUPER_ADMIN'),
  ('00000000-0000-4000-8000-000000000002', 'Master Lab Admin', 'master@fixture.invalid', 'MASTER_LAB_ADMIN'),
  ('00000000-0000-4000-8000-000000000003', 'Dr. HOD', 'hod@fixture.invalid', 'HOD');

-- Test 1: Super Admin can create a competition
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

SELECT lives_ok(
  $$INSERT INTO public.competitions (competition_id, slug, competition_name, contest_date, created_by)
    VALUES ('10000000-0000-4000-8000-000000000001', 'contest-fixture', 'Fixture Contest', current_date, '00000000-0000-4000-8000-000000000001')$$,
  'Super Admin can create a competition'
);

-- Super Admin creates a contest set
SELECT lives_ok(
  $$INSERT INTO public.contest_sets (set_id, competition_id, set_name, set_code, hackerrank_slug)
    VALUES ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Set A', 'setA', 'fixture-setA')$$,
  'Super Admin can configure contest sets'
);

-- Test 2: Master Lab Admin can insert an upload for that set
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

SELECT lives_ok(
  $$INSERT INTO public.uploads (competition_id, set_id, uploaded_by, hackerrank_slug, record_count)
    VALUES ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'fixture-setA', 10)$$,
  'Master Lab Admin can insert an upload for a contest set'
);

-- Test 3: HOD can read the uploads and contest sets
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';

SELECT ok(
  (SELECT count(*) FROM public.contest_sets) >= 1,
  'HOD can view contest sets'
);

-- Test 4: HOD is read-only and CANNOT insert or mutate uploads
SELECT throws_ok(
  $$INSERT INTO public.uploads (competition_id, set_id, uploaded_by, hackerrank_slug)
    VALUES ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'fixture-setA')$$,
  '42501', NULL, 'HOD cannot insert uploads (read-only enforced by RLS)'
);

-- Test 5: Inactive account has no authorized role
RESET ROLE;
UPDATE public.users SET account_status = 'INACTIVE' WHERE user_id = '00000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

SELECT is(public.current_user_role(), NULL::public.user_role, 'inactive account returns null role');

SELECT * FROM finish();
ROLLBACK;
