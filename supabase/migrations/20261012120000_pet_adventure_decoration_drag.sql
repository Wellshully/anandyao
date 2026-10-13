-- Pet Adventure V1.4: decoration coordinates

BEGIN;

ALTER TABLE public.pet_adventure_rewards
  ADD COLUMN position_x numeric(6,4) NOT NULL DEFAULT 0.8200
    CHECK (position_x BETWEEN 0.0800 AND 0.9200),
  ADD COLUMN position_y numeric(6,4) NOT NULL DEFAULT 0.8000
    CHECK (position_y BETWEEN 0.1000 AND 0.9000);

CREATE FUNCTION public.move_pet_adventure_decoration(
  p_pet_id uuid,
  p_reward_id uuid,
  p_x numeric,
  p_y numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  saved boolean := false;
BEGIN
  IF p_x IS NULL OR p_y IS NULL
     OR p_x NOT BETWEEN 0.0800 AND 0.9200
     OR p_y NOT BETWEEN 0.1000 AND 0.9000
  THEN
    RETURN false;
  END IF;

  UPDATE public.pet_adventure_rewards
  SET
    position_x = p_x,
    position_y = p_y
  WHERE id = p_reward_id
    AND pet_id = p_pet_id
    AND reward_type = 'decor'
    AND choice = 'accepted'
    AND equipped = true
  RETURNING true INTO saved;

  RETURN COALESCE(saved, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.move_pet_adventure_decoration(
    uuid, uuid, numeric, numeric
  )
FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.move_pet_adventure_decoration(
    uuid, uuid, numeric, numeric
  )
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
