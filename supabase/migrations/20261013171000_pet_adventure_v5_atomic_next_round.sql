-- Pet Adventure V5: atomic creation of the next quest round.
-- Does not delete or rewrite historical quests and rewards.
-- Only service_role may execute this RPC.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pet_adventure_test_settings') IS NULL THEN
    RAISE EXCEPTION 'Apply the V5 test settings migration first';
  END IF;

  IF to_regclass('public.pet_adventure_quests') IS NULL
     OR to_regclass('public.pet_adventure_rewards') IS NULL THEN
    RAISE EXCEPTION 'Pet Adventure base tables are missing';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_pet_adventure_next_round(
  p_pet_id uuid,
  p_quest_mode text,
  p_action_type text,
  p_goal integer,
  p_title text,
  p_story text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_today date;
  v_previous record;
  v_reward_choice text;
  v_unlimited boolean;
  v_next_round integer;
BEGIN
  -- Validate server-supplied fallback quest metadata.
  IF p_pet_id IS NULL
     OR p_quest_mode IS NULL
     OR p_action_type IS NULL
     OR p_goal IS NULL
     OR p_title IS NULL
     OR p_story IS NULL
  THEN
    RETURN 'INVALID_QUEST';
  END IF;

  IF p_quest_mode NOT IN ('pet_actions', 'couple')
     OR p_action_type NOT IN ('feed', 'pet', 'play')
     OR p_goal NOT BETWEEN 1 AND 3
     OR length(btrim(p_title)) NOT BETWEEN 1 AND 120
     OR length(btrim(p_story)) NOT BETWEEN 1 AND 1200
  THEN
    RETURN 'INVALID_QUEST';
  END IF;

  IF p_quest_mode = 'couple'
     AND (p_action_type <> 'play' OR p_goal <> 2)
  THEN
    RETURN 'INVALID_QUEST';
  END IF;

  -- Serialize requests from both members of the shared pet.
  PERFORM 1
  FROM public.pets
  WHERE id = p_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;

  -- Determine the date after acquiring the lock.
  v_today := (clock_timestamp() AT TIME ZONE 'Asia/Taipei')::date;

  SELECT
    q.id,
    q.test_round,
    q.completed_at
  INTO v_previous
  FROM public.pet_adventure_quests AS q
  WHERE q.pet_id = p_pet_id
    AND q.quest_date = v_today
  ORDER BY q.test_round DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'NO_QUEST';
  END IF;

  IF v_previous.completed_at IS NULL THEN
    RETURN 'NOT_COMPLETED';
  END IF;

  -- A new quest cannot replace an unopened or undecided reward.
  SELECT r.choice
  INTO v_reward_choice
  FROM public.pet_adventure_rewards AS r
  WHERE r.pet_id = p_pet_id
    AND r.quest_id = v_previous.id;

  IF NOT FOUND OR v_reward_choice IS NULL THEN
    RETURN 'REWARD_UNDECIDED';
  END IF;

  IF v_reward_choice NOT IN ('accepted', 'discarded') THEN
    RETURN 'REWARD_UNDECIDED';
  END IF;

  -- Testing privileges must be active for this exact pet.
  SELECT EXISTS (
    SELECT 1
    FROM public.pet_adventure_test_settings AS s
    WHERE s.pet_id = p_pet_id
      AND s.unlimited_quests = true
      AND s.expires_at > clock_timestamp()
  )
  INTO v_unlimited;

  -- Preserve the historical October 13 bonus quest.
  -- All other normal-mode dates allow only one round.
  IF NOT v_unlimited
     AND NOT (
       v_today = DATE '2026-10-13'
       AND v_previous.test_round = 0
     )
  THEN
    RETURN 'DAILY_LIMIT';
  END IF;

  -- The column remains a PostgreSQL integer.
  IF v_previous.test_round >= 2147483647 THEN
    RETURN 'ROUND_OVERFLOW';
  END IF;

  v_next_round := v_previous.test_round + 1;

  -- A request crossing Taipei midnight must not insert a stale round.
  IF (clock_timestamp() AT TIME ZONE 'Asia/Taipei')::date
     <> v_today
  THEN
    RETURN 'DAY_CHANGED';
  END IF;

  -- Pet-row locking serializes normal next-round requests.
  -- The existing unique index is an additional safeguard.
  INSERT INTO public.pet_adventure_quests (
    pet_id,
    quest_date,
    test_round,
    quest_mode,
    ai_status,
    action_type,
    goal,
    title,
    story
  )
  VALUES (
    p_pet_id,
    v_today,
    v_next_round,
    p_quest_mode,
    'pending',
    p_action_type,
    p_goal::smallint,
    btrim(p_title),
    btrim(p_story)
  );

  RETURN 'CREATED';
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.start_pet_adventure_next_round(
    uuid, text, text, integer, text, text
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.start_pet_adventure_next_round(
    uuid, text, text, integer, text, text
  )
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
