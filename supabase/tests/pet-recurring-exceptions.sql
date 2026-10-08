\set ON_ERROR_STOP on

BEGIN;

-- Generate unique fixture IDs.
SELECT
  gen_random_uuid() AS user_a,
  gen_random_uuid() AS user_b,
  gen_random_uuid() AS space_id,
  gen_random_uuid() AS pet_id,
  gen_random_uuid() AS schedule_a,
  gen_random_uuid() AS schedule_b,
  'recurring-test-' || substr(gen_random_uuid()::text, 1, 12) AS slug
\gset

-- Create two temporary Auth users.
INSERT INTO auth.users (id, aud, role, email)
VALUES
  (
    :'user_a'::uuid,
    'authenticated',
    'authenticated',
    'test-a-' || :'slug' || '@example.invalid'
  ),
  (
    :'user_b'::uuid,
    'authenticated',
    'authenticated',
    'test-b-' || :'slug' || '@example.invalid'
  );

-- Profiles are normally created by the Auth trigger.
-- ON CONFLICT also supports environments where that
-- trigger has already created them.
INSERT INTO public.profiles (id, display_name)
VALUES
  (:'user_a'::uuid, 'Test User A'),
  (:'user_b'::uuid, 'Test User B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.spaces (id, name, slug, created_by)
VALUES (
  :'space_id'::uuid,
  'Recurring Test Space',
  :'slug',
  :'user_a'::uuid
);

INSERT INTO public.pets (id, space_id, name)
VALUES (
  :'pet_id'::uuid,
  :'space_id'::uuid,
  'Test Pet'
);

-- Both schedules belong to different users.
INSERT INTO public.pet_recurring_schedules (
  id, pet_id, user_id, title,
  recurrence_rule, recurrence_start_date
)
VALUES
  (
    :'schedule_a'::uuid,
    :'pet_id'::uuid,
    :'user_a'::uuid,
    '家教',
    'FREQ=WEEKLY;BYDAY=TU,FR',
    '2026-10-06'
  ),
  (
    :'schedule_b'::uuid,
    :'pet_id'::uuid,
    :'user_b'::uuid,
    '吉他課',
    'FREQ=WEEKLY;BYDAY=FR',
    '2026-10-09'
  );

-- Store fixture identifiers for DO blocks.
SELECT set_config(
  'test.schedule_a', :'schedule_a', true
);
SELECT set_config(
  'test.schedule_b', :'schedule_b', true
);

-- Simulate an authenticated Supabase request.
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub', :'user_a', true
);

-- TEST 1: User A can override own occurrence.
INSERT INTO public.pet_recurring_schedule_exceptions (
  schedule_id, occurrence_date, kind, title_override
)
VALUES (
  :'schedule_a'::uuid,
  '2026-10-09',
  'override',
  '北車家教'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.pet_recurring_schedule_exceptions
    WHERE schedule_id =
      current_setting('test.schedule_a')::uuid
      AND occurrence_date = '2026-10-09'
      AND title_override = '北車家教'
  ) THEN
    RAISE EXCEPTION 'FAIL: override not stored';
  END IF;

  RAISE NOTICE 'PASS: occurrence override';
END;
$$;

-- TEST 2: Duplicate occurrences are rejected.
DO $$
BEGIN
  INSERT INTO public.pet_recurring_schedule_exceptions (
    schedule_id, occurrence_date, kind, title_override
  )
  VALUES (
    current_setting('test.schedule_a')::uuid,
    '2026-10-09',
    'override',
    '重複家教'
  );

  RAISE EXCEPTION 'FAIL: duplicate accepted';

EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'PASS: duplicate blocked';
END;
$$;

-- TEST 3: Cancel one occurrence.
INSERT INTO public.pet_recurring_schedule_exceptions (
  schedule_id, occurrence_date, kind
)
VALUES (
  :'schedule_a'::uuid,
  '2026-10-13',
  'cancelled'
);

-- TEST 4: Invalid exact time is rejected.
DO $$
BEGIN
  INSERT INTO public.pet_recurring_schedule_exceptions (
    schedule_id,
    occurrence_date,
    kind,
    time_precision_override
  )
  VALUES (
    current_setting('test.schedule_a')::uuid,
    '2026-10-16',
    'override',
    'exact'
  );

  RAISE EXCEPTION 'FAIL: invalid time accepted';

EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'PASS: invalid time blocked';
END;
$$;

-- TEST 5: Cancelled occurrence cannot have overrides.
DO $$
BEGIN
  INSERT INTO public.pet_recurring_schedule_exceptions (
    schedule_id,
    occurrence_date,
    kind,
    title_override
  )
  VALUES (
    current_setting('test.schedule_a')::uuid,
    '2026-10-20',
    'cancelled',
    '北車家教'
  );

  RAISE EXCEPTION 'FAIL: cancelled override accepted';

EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'PASS: cancelled overrides blocked';
END;
$$;

-- Switch to User B.
SELECT set_config(
  'request.jwt.claim.sub', :'user_b', true
);

-- TEST 6: User B cannot insert an exception
-- for User A's schedule.
DO $$
BEGIN
  INSERT INTO public.pet_recurring_schedule_exceptions (
    schedule_id, occurrence_date, kind
  )
  VALUES (
    current_setting('test.schedule_a')::uuid,
    '2026-10-23',
    'cancelled'
  );

  RAISE EXCEPTION 'FAIL: cross-user insert accepted';

EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: cross-user insert blocked';
END;
$$;

-- TEST 7: User B cannot update User A's exception.
DO $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.pet_recurring_schedule_exceptions
  SET title_override = 'Unauthorized Change'
  WHERE schedule_id =
    current_setting('test.schedule_a')::uuid
    AND occurrence_date = '2026-10-09';

  GET DIAGNOSTICS affected = ROW_COUNT;

  IF affected <> 0 THEN
    RAISE EXCEPTION 'FAIL: cross-user update accepted';
  END IF;

  RAISE NOTICE 'PASS: cross-user update blocked';
END;
$$;

-- TEST 8: User B can manage their own schedule.
INSERT INTO public.pet_recurring_schedule_exceptions (
  schedule_id, occurrence_date, kind
)
VALUES (
  :'schedule_b'::uuid,
  '2026-10-09',
  'cancelled'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.pet_recurring_schedule_exceptions
    WHERE schedule_id =
      current_setting('test.schedule_b')::uuid
      AND occurrence_date = '2026-10-09'
      AND kind = 'cancelled'
  ) THEN
    RAISE EXCEPTION 'FAIL: own cancellation not stored';
  END IF;

  RAISE NOTICE 'PASS: own occurrence cancelled';
END;
$$;

-- Remove all test data.
ROLLBACK;

SELECT 'PASS: integration transaction rolled back' AS result;
