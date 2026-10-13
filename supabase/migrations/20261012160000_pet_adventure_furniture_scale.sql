-- Pet Adventure V1.6: individual decoration scale
-- Existing furniture defaults to 1.00.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pet_adventure_rewards') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'pet_adventure_rewards'
         AND column_name = 'position_x'
     )
  THEN
    RAISE EXCEPTION
      'Apply Pet Adventure decoration position migration first';
  END IF;
END;
$$;

ALTER TABLE public.pet_adventure_rewards
  ADD COLUMN size_scale numeric(4,2) NOT NULL DEFAULT 1.00
  CONSTRAINT pet_adventure_reward_scale_range
    CHECK (
      size_scale BETWEEN 0.50 AND 2.00
      AND size_scale * 4 = trunc(size_scale * 4)
    );

CREATE FUNCTION public.resize_pet_adventure_decoration(
  p_pet_id uuid,
  p_reward_id uuid,
  p_scale numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_scale IS NULL
     OR p_scale NOT BETWEEN 0.50 AND 2.00
     OR p_scale * 4 <> trunc(p_scale * 4)
  THEN
    RETURN false;
  END IF;

  UPDATE public.pet_adventure_rewards
  SET size_scale = p_scale
  WHERE id = p_reward_id
    AND pet_id = p_pet_id
    AND reward_type = 'decor'
    AND choice = 'accepted'
    AND equipped = true;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION
  public.resize_pet_adventure_decoration(uuid,uuid,numeric)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.resize_pet_adventure_decoration(uuid,uuid,numeric)
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
