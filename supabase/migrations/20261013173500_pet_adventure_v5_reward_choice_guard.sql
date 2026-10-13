-- V5: Allow reward decisions only after design is finalized.
-- Preserve the V4 per-pet lock, storage capacity and reveal wait.

BEGIN;

CREATE OR REPLACE FUNCTION public.choose_pet_adventure_reward(
  p_pet_id uuid,
  p_reward_id uuid,
  p_choice text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_stored integer;
BEGIN
  IF p_choice IS NULL OR
     p_choice NOT IN ('accepted', 'discarded')
  THEN
    RAISE EXCEPTION 'Invalid reward choice';
  END IF;

  -- 鎖定共用萌蛋，避免兩位使用者同時超過容量
  PERFORM 1
  FROM public.pets
  WHERE id = p_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_choice = 'accepted' THEN
    SELECT count(*)
    INTO v_stored
    FROM public.pet_adventure_rewards
    WHERE pet_id = p_pet_id
      AND choice = 'accepted'
      AND NOT equipped;

    IF v_stored >= 50 THEN
      RAISE EXCEPTION 'STORAGE_FULL';
    END IF;
  END IF;

  UPDATE public.pet_adventure_rewards
  SET
    choice = p_choice,
    chosen_at = now(),
    equipped = false
  WHERE id = p_reward_id
    AND pet_id = p_pet_id
    AND choice IS NULL
    AND design_status IN ('legacy', 'ready', 'fallback')
    AND available_at <= now();

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.choose_pet_adventure_reward(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.choose_pet_adventure_reward(uuid, uuid, text)
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
