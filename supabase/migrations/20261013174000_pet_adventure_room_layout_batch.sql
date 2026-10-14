-- Pet Adventure: atomic room layout saving.
-- Preserve existing furniture, inventory and individual RPCs.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_pet_adventure_room_layout(
  p_pet_id uuid,
  p_items jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_id uuid;
  v_seen uuid[] := ARRAY[]::uuid[];

  v_x numeric;
  v_y numeric;
  v_scale numeric;

  v_expected_x numeric;
  v_expected_y numeric;
  v_expected_scale numeric;

  v_current_x numeric;
  v_current_y numeric;
  v_current_scale numeric;
BEGIN
  IF p_pet_id IS NULL
     OR p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
  THEN
    RETURN false;
  END IF;

  -- The existing room permits at most ten decorations.
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 10 THEN
    RETURN false;
  END IF;

  -- Serialize layout saves for the shared pet.
  PERFORM 1
  FROM public.pets
  WHERE id = p_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Phase 1: validate and lock ALL affected furniture.
  -- No modifications are performed during this phase.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS items(value)
    ORDER BY value->>'id'
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR COALESCE(v_item->>'id', '') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN
      RETURN false;
    END IF;

    v_id := (v_item->>'id')::uuid;

    IF v_id = ANY(v_seen) THEN
      RETURN false;
    END IF;

    v_seen := array_append(v_seen, v_id);

    v_x := (v_item->>'x')::numeric;
    v_y := (v_item->>'y')::numeric;
    v_scale := (v_item->>'scale')::numeric;

    v_expected_x := (v_item->>'expectedX')::numeric;
    v_expected_y := (v_item->>'expectedY')::numeric;
    v_expected_scale := (v_item->>'expectedScale')::numeric;

    IF v_x IS NULL OR v_y IS NULL OR v_scale IS NULL
       OR v_expected_x IS NULL
       OR v_expected_y IS NULL
       OR v_expected_scale IS NULL
       OR v_x NOT BETWEEN 0.08 AND 0.92
       OR v_y NOT BETWEEN 0.10 AND 0.90
       OR v_scale NOT BETWEEN 0.50 AND 2.00
       OR v_scale * 4 <> trunc(v_scale * 4)
    THEN
      RETURN false;
    END IF;

    SELECT position_x, position_y, size_scale
    INTO v_current_x, v_current_y, v_current_scale
    FROM public.pet_adventure_rewards
    WHERE id = v_id
      AND pet_id = p_pet_id
      AND reward_type = 'decor'
      AND choice = 'accepted'
      AND equipped = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    -- Reject stale local drafts instead of overwriting
    -- another player's changes.
    IF v_current_x <> v_expected_x
       OR v_current_y <> v_expected_y
       OR v_current_scale <> v_expected_scale
    THEN
      RETURN false;
    END IF;
  END LOOP;

  -- Phase 2: all items are valid and locked.
  -- The transaction saves the complete change set.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS items(value)
    ORDER BY value->>'id'
  LOOP
    UPDATE public.pet_adventure_rewards
    SET
      position_x = (v_item->>'x')::numeric,
      position_y = (v_item->>'y')::numeric,
      size_scale = (v_item->>'scale')::numeric
    WHERE id = (v_item->>'id')::uuid
      AND pet_id = p_pet_id
      AND reward_type = 'decor'
      AND choice = 'accepted'
      AND equipped = true;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION
  public.save_pet_adventure_room_layout(uuid, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.save_pet_adventure_room_layout(uuid, jsonb)
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
