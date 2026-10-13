-- Pet Adventure V1.5
-- Room: 10 decorations
-- Storage: 50 accepted unequipped items
-- Existing gifts and coordinates remain unchanged.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pet_adventure_rewards') IS NULL OR
     NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'pet_adventure_rewards'
         AND column_name = 'position_x'
     ) OR
     NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'pet_adventure_rewards'
         AND column_name = 'position_y'
     )
  THEN
    RAISE EXCEPTION
      'Please apply Pet Adventure V1.4 decoration position migration first';
  END IF;
END;
$$;

-- 移除同種類只能裝備一件的舊限制
DROP INDEX IF EXISTS public.pet_adventure_one_equipped_per_type;

-- 房間背景仍然只能有一個
CREATE UNIQUE INDEX IF NOT EXISTS pet_adventure_one_equipped_room
  ON public.pet_adventure_rewards (pet_id)
  WHERE equipped = true AND reward_type = 'room';

-- 領取獎勵時確認倉庫空間
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
    AND available_at <= now();

  RETURN FOUND;
END;
$$;

-- 房間裝備邏輯
CREATE OR REPLACE FUNCTION public.equip_pet_adventure_reward(
  p_pet_id uuid,
  p_reward_id uuid,
  p_enabled boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_type text;
  v_equipped boolean;
  v_placed integer;
  v_stored integer;
BEGIN
  PERFORM 1
  FROM public.pets
  WHERE id = p_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT reward_type, equipped
  INTO v_type, v_equipped
  FROM public.pet_adventure_rewards
  WHERE id = p_reward_id
    AND pet_id = p_pet_id
    AND choice = 'accepted';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_enabled THEN
    IF v_equipped THEN
      RETURN true;
    END IF;

    -- 背景仍維持一次一個
    IF v_type = 'room' THEN
      UPDATE public.pet_adventure_rewards
      SET equipped = false
      WHERE pet_id = p_pet_id
        AND reward_type = 'room'
        AND equipped = true;

      UPDATE public.pet_adventure_rewards
      SET equipped = true
      WHERE id = p_reward_id
        AND pet_id = p_pet_id
        AND choice = 'accepted';

      RETURN FOUND;
    END IF;

    -- 擺飾最多十件
    SELECT count(*)
    INTO v_placed
    FROM public.pet_adventure_rewards
    WHERE pet_id = p_pet_id
      AND reward_type = 'decor'
      AND choice = 'accepted'
      AND equipped = true;

    IF v_placed >= 10 THEN
      RAISE EXCEPTION 'ROOM_FULL';
    END IF;

    -- 新家具安排在不同預設位置
    -- 已拖曳過的座標則保留
    UPDATE public.pet_adventure_rewards
    SET
      equipped = true,
      position_x = CASE
        WHEN position_x = 0.8200
         AND position_y = 0.8000
        THEN 0.1900 + (v_placed % 3) * 0.3100
        ELSE position_x
      END,
      position_y = CASE
        WHEN position_x = 0.8200
         AND position_y = 0.8000
        THEN 0.3600 + floor(v_placed / 3.0) * 0.1600
        ELSE position_y
      END
    WHERE id = p_reward_id
      AND pet_id = p_pet_id
      AND choice = 'accepted'
      AND reward_type = 'decor';

    RETURN FOUND;
  END IF;

  -- 收回倉庫前也要檢查容量
  IF NOT v_equipped THEN
    RETURN true;
  END IF;

  SELECT count(*)
  INTO v_stored
  FROM public.pet_adventure_rewards
  WHERE pet_id = p_pet_id
    AND choice = 'accepted'
    AND NOT equipped;

  IF v_stored >= 50 THEN
    RAISE EXCEPTION 'STORAGE_FULL';
  END IF;

  UPDATE public.pet_adventure_rewards
  SET equipped = false
  WHERE id = p_reward_id
    AND pet_id = p_pet_id
    AND choice = 'accepted';

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.choose_pet_adventure_reward(uuid,uuid,text)
FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.equip_pet_adventure_reward(uuid,uuid,boolean)
FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.choose_pet_adventure_reward(uuid,uuid,text)
TO service_role;

GRANT EXECUTE ON FUNCTION
  public.equip_pet_adventure_reward(uuid,uuid,boolean)
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
