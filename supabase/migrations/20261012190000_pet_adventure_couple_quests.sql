-- Pet Adventure V2: couple-confirmed daily quests; prior quests, gifts,
-- furniture coordinates, scale and inventory remain unchanged.
BEGIN;

ALTER TABLE public.pet_adventure_quests
  ADD COLUMN quest_mode text NOT NULL DEFAULT 'pet_actions'
    CHECK (quest_mode IN ('pet_actions', 'couple')),
  ADD COLUMN ai_status text NOT NULL DEFAULT 'legacy'
    CHECK (ai_status IN ('legacy','pending','generating','gemini','failed','fallback'));

CREATE TABLE public.pet_adventure_quest_confirmations (
  quest_id uuid NOT NULL REFERENCES public.pet_adventure_quests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quest_id, user_id)
);
CREATE INDEX pet_adventure_quest_confirmations_user_idx
  ON public.pet_adventure_quest_confirmations (user_id);
ALTER TABLE public.pet_adventure_quest_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pet_adventure_quest_confirmations FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_adventure_quest_confirmations TO service_role;

CREATE FUNCTION public.set_pet_adventure_quest_confirmation(
  p_pet_id uuid,
  p_quest_id uuid,
  p_user_id uuid,
  p_confirm boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_space_id uuid;
  v_member_count integer;
  v_active_id uuid;
  v_confirm_count integer;
  v_mode text;
  v_completed timestamptz;
BEGIN
  IF p_confirm IS NULL OR p_pet_id IS NULL OR p_quest_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Serialize confirmations by both users, including final completion.
  SELECT space_id INTO v_space_id
  FROM public.pets WHERE id = p_pet_id FOR UPDATE;
  IF v_space_id IS NULL THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = v_space_id AND user_id = p_user_id
  ) THEN RETURN false; END IF;

  SELECT count(DISTINCT user_id) INTO v_member_count
  FROM public.space_members WHERE space_id = v_space_id;
  IF v_member_count <> 2 THEN RETURN false; END IF;

  -- An old test round cannot be completed after reroll.
  SELECT id, quest_mode, completed_at
  INTO v_active_id, v_mode, v_completed
  FROM public.pet_adventure_quests
  WHERE pet_id = p_pet_id
    AND quest_date = (now() AT TIME ZONE 'Asia/Taipei')::date
  ORDER BY test_round DESC
  LIMIT 1;
  IF v_active_id IS DISTINCT FROM p_quest_id
     OR v_mode IS DISTINCT FROM 'couple'
     OR v_completed IS NOT NULL
  THEN RETURN false; END IF;

  IF p_confirm THEN
    INSERT INTO public.pet_adventure_quest_confirmations (quest_id, user_id)
    VALUES (p_quest_id, p_user_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.pet_adventure_quest_confirmations
    WHERE quest_id = p_quest_id AND user_id = p_user_id;
  END IF;

  SELECT count(*) INTO v_confirm_count
  FROM public.pet_adventure_quest_confirmations
  WHERE quest_id = p_quest_id;
  IF v_confirm_count = 2 THEN
    UPDATE public.pet_adventure_quests
       SET completed_at = now()
     WHERE id = p_quest_id AND completed_at IS NULL;
  END IF;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION
  public.set_pet_adventure_quest_confirmation(uuid,uuid,uuid,boolean)
FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.set_pet_adventure_quest_confirmation(uuid,uuid,uuid,boolean)
TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
