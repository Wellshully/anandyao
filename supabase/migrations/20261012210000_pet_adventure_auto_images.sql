-- Pet Adventure V3.2
-- Allow reward image preparation before the reveal time.
-- Existing gifts and images are preserved.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure(
    'public.claim_pet_adventure_reward_image(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Please apply the V3 image migration first';
  END IF;
END;
$$;

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
BEGIN
  -- Serialize concurrent requests for this shared pet.
  PERFORM 1
  FROM public.pets
  WHERE id = p_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;

  -- Daily quota uses Taipei midnight.
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
  public.claim_pet_adventure_reward_image(uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.claim_pet_adventure_reward_image(uuid,uuid)
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
