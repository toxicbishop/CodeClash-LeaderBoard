BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
INSERT INTO public.users (user_id, name, email, role) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Lab A', 'a@fixture.invalid', 'LAB_ADMIN'),
  ('00000000-0000-4000-8000-000000000002', 'Lab B', 'b@fixture.invalid', 'LAB_ADMIN');

INSERT INTO public.competitions (competition_id, slug, competition_name, contest_date, upload_deadline, created_by)
SELECT id, slug, slug, current_date, now(), '00000000-0000-4000-8000-000000000001'
FROM (VALUES
  ('10000000-0000-4000-8000-000000000001'::uuid, 'fixture-contest-a'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'fixture-contest-b')
) AS fixtures(id, slug);

INSERT INTO public.labs (lab_id, lab_name, assigned_admin_id, competition_id) VALUES
  ('20000000-0000-4000-8000-000000000001', 'A', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'B', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');

CREATE FUNCTION pg_temp.submit_fixture(lab uuid, competition uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER AS $$
  INSERT INTO public.uploads (lab_id, competition_id, uploaded_by, file_name, file_path)
  VALUES (lab, competition, auth.uid(), 'fixture.csv', 'fixture.csv');
$$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SELECT lives_ok(
  $$SELECT pg_temp.submit_fixture('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')$$,
  'active lab admin may submit for the assigned lab and competition'
);
SELECT throws_ok(
  $$SELECT pg_temp.submit_fixture('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'another lab is outside the assignment'
);
SELECT throws_ok(
  $$SELECT pg_temp.submit_fixture('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')$$,
  '42501', NULL, 'competition must match the assigned lab'
);

RESET ROLE;
UPDATE public.users SET account_status = 'INACTIVE' WHERE user_id = auth.uid();
SET LOCAL ROLE authenticated;
SELECT is(public.current_user_role(), NULL::public.user_role, 'inactive account has no authorized role');
SELECT throws_ok(
  $$SELECT pg_temp.submit_fixture('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'inactive lab admin cannot submit'
);
SELECT * FROM finish();
ROLLBACK;
