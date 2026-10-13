-- Pet Adventure V5: atomic AI quest claim.
-- Prevent duplicate paid requests and concurrent quota overspending.
-- Only service_role can execute.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pet_adventure_test_settings') IS NULL THEN
    RAISE EXCEPTION 'Missing V5 test settings';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pet_adventure_quests'
      AND column_name = 'ai_requested_at'
  ) THEN
    RAISE EXCEPTION 'Missing AI quest claim timestamp';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_pet_adventure_quest_ai(
  p_pet_id uuid,
  p_quest_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_today date;
  v_status text;
  v_completed_at timestamptz;
  v_unlimited boolean;
  v_count integer;
  v_claimed uuid;
BEGIN
  IF p_pet_id IS NULL OR p_quest_id IS NULL THEN
    RETURN 'UNAVAILABLE';
  END IF;

  -- Serialize all AI claims for this shared pet.
  PERFORM 1
  FROM public.pets
  WHERE id = p_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;

  v_today :=
    (clock_timestamp() AT TIME ZONE 'Asia/Taipei')::date;

  -- Only the latest unfinished quest is eligible.
  SELECT q.ai_status, q.completed_at
  INTO v_status, v_completed_at
  FROM public.pet_adventure_quests AS q
  WHERE q.id = p_quest_id
    AND q.pet_id = p_pet_id
    AND q.quest_date = v_today
    AND NOT EXISTS (
      SELECT 1
      FROM public.pet_adventure_quests AS newer
      WHERE newer.pet_id = q.pet_id
        AND newer.quest_date = q.quest_date
        AND newer.test_round > q.test_round
    );

  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;

  IF v_status IS DISTINCT FROM 'pending'
     OR v_completed_at IS NOT NULL THEN
    RETURN 'NOT_ELIGIBLE';
  END IF;

  -- Database-controlled, per-pet test override.
  SELECT EXISTS (
    SELECT 1
    FROM public.pet_adventure_test_settings AS s
    WHERE s.pet_id = p_pet_id
      AND s.unlimited_quests = true
      AND s.expires_at > clock_timestamp()
  )
  INTO v_unlimited;

  -- Normal mode: maximum five claimed AI requests
  -- per pet, per Taipei calendar day.
  IF NOT v_unlimited THEN
    SELECT count(*)
    INTO v_count
    FROM public.pet_adventure_quests
    WHERE pet_id = p_pet_id
      AND quest_date = v_today
      AND ai_requested_at IS NOT NULL;

    IF v_count >= 5 THEN
      RETURN 'DAILY_LIMIT';
    END IF;
  END IF;

  -- Claim only once. Do not clear ai_requested_at
  -- even when the paid request fails.
  UPDATE public.pet_adventure_quests
  SET
    ai_status = 'generating',
    ai_requested_at = clock_timestamp()
  WHERE id = p_quest_id
    AND pet_id = p_pet_id
    AND quest_date = v_today
    AND ai_status = 'pending'
    AND completed_at IS NULL
  RETURNING id INTO v_claimed;

  IF v_claimed IS NULL THEN
    RETURN 'NOT_ELIGIBLE';
  END IF;

  RETURN 'CLAIMED';
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.claim_pet_adventure_quest_ai(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.claim_pet_adventure_quest_ai(uuid, uuid)
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
