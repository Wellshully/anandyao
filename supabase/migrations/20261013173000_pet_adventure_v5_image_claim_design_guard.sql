-- V5: paid image claims require finalized reward design.
-- Keep the existing Taipei-day quota and per-pet test override.

BEGIN;

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
    AND r.design_status IN ('legacy', 'ready', 'fallback')
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
