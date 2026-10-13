-- Pet Adventure V5: AI specs and per-pet temporary test limits.
-- Preserve all existing quests, rewards, image claims and inventory.
-- Apply only after review and controlled database testing.

BEGIN;

-- 1. Quest metadata for validated AI-generated objectives.
ALTER TABLE public.pet_adventure_quests
  ADD COLUMN goal_template_id text,
  ADD COLUMN quest_prompt_version text;

-- 2. Persistent AI reward design.
ALTER TABLE public.pet_adventure_rewards
  ADD COLUMN appearance_prompt text,
  ADD COLUMN design_status text NOT NULL DEFAULT 'legacy'
    CHECK (
      design_status IN (
        'legacy',
        'pending',
        'generating',
        'ready',
        'fallback',
        'failed'
      )
    ),
  ADD COLUMN design_prompt_version text,
  ADD COLUMN design_requested_at timestamptz;

-- 3. Remove only the old test_round <= 99 CHECK.
-- Find its actual database constraint name instead of guessing.
DO $$
DECLARE
  v_constraint_names text[];
BEGIN
  SELECT array_agg(c.conname::text ORDER BY c.conname)
  INTO v_constraint_names
  FROM pg_constraint AS c
  JOIN pg_attribute AS a
    ON a.attrelid = c.conrelid
   AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.pet_adventure_quests'::regclass
    AND c.contype = 'c'
    AND a.attname = 'test_round'
    AND pg_get_constraintdef(c.oid)
      ~ '(^|[^[:digit:]])99([^[:digit:]]|$)';

  IF COALESCE(array_length(v_constraint_names, 1), 0) <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one old test_round <= 99 constraint, found %',
      COALESCE(array_length(v_constraint_names, 1), 0);
  END IF;

  EXECUTE format(
    'ALTER TABLE public.pet_adventure_quests DROP CONSTRAINT %I',
    v_constraint_names[1]
  );
END;
$$;

ALTER TABLE public.pet_adventure_quests
  ADD CONSTRAINT pet_adventure_quests_test_round_nonnegative_v5
  CHECK (test_round >= 0);

-- Preserve the existing unique index on
-- (pet_id, quest_date, test_round).

-- 4. Temporary per-pet testing permissions.
CREATE TABLE public.pet_adventure_test_settings (
  pet_id uuid PRIMARY KEY
    REFERENCES public.pets(id) ON DELETE CASCADE,
  unlimited_quests boolean NOT NULL DEFAULT false,
  unlimited_images boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_adventure_test_settings
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pet_adventure_test_settings
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.pet_adventure_test_settings
  TO service_role;

-- 5. Preserve the V3.2 automatic-image claim behavior.
-- Only bypass the daily image quota for a valid test pet.
CREATE OR REPLACE FUNCTION public.claim_pet_adventure_reward_image(
  p_pet_id uuid,
  p_reward_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_claimed uuid;
  v_unlimited boolean;
BEGIN
  -- Serialize concurrent requests for the same shared pet.
  PERFORM 1
  FROM public.pets
  WHERE id = p_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;

  -- Read the testing policy directly from the database.
  -- Expired settings are never active.
  SELECT EXISTS (
    SELECT 1
    FROM public.pet_adventure_test_settings
    WHERE pet_id = p_pet_id
      AND unlimited_images = true
      AND expires_at > now()
  )
  INTO v_unlimited;

  -- Normal pets retain the two-images-per-Taipei-day limit.
  IF NOT v_unlimited THEN
    SELECT count(*)
    INTO v_count
    FROM public.pet_adventure_rewards
    WHERE pet_id = p_pet_id
      AND image_requested_at >= (
        ((now() AT TIME ZONE 'Asia/Taipei')::date)::timestamp
        AT TIME ZONE 'Asia/Taipei'
      );

    IF v_count >= 2 THEN
      RETURN 'DAILY_LIMIT';
    END IF;
  END IF;

  -- Never claim the same reward twice.
  -- Preserve the V3.2 automatic preparation behavior.
  UPDATE public.pet_adventure_rewards AS r
  SET
    image_status = 'generating',
    image_requested_at = now()
  FROM public.pet_adventure_quests AS q
  WHERE r.id = p_reward_id
    AND r.pet_id = p_pet_id
    AND r.quest_id = q.id
    AND q.pet_id = p_pet_id
    AND q.completed_at IS NOT NULL
    AND (r.choice IS NULL OR r.choice = 'accepted')
    AND r.image_status = 'none'
  RETURNING r.id INTO v_claimed;

  IF v_claimed IS NULL THEN
    RETURN 'UNAVAILABLE';
  END IF;

  RETURN 'CLAIMED';
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.claim_pet_adventure_reward_image(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.claim_pet_adventure_reward_image(uuid, uuid)
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
