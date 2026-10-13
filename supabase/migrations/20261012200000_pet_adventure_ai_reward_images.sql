-- Pet Adventure V3.0: manual Gemini reward images.
-- Existing gifts and furniture are preserved.

BEGIN;

ALTER TABLE public.pet_adventure_rewards
  ADD COLUMN image_status text NOT NULL DEFAULT 'none'
    CHECK (
      image_status IN ('none', 'generating', 'ready', 'failed')
    ),
  ADD COLUMN image_path text,
  ADD COLUMN image_requested_at timestamptz;

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
VALUES (
  'pet-adventure-assets',
  'pet-adventure-assets',
  false,
  8388608,
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'pet-adventure-assets' AND public
  ) THEN
    RAISE EXCEPTION 'pet-adventure-assets must be private';
  END IF;
END;
$$;

CREATE FUNCTION public.claim_pet_adventure_reward_image(
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
  -- Serialize concurrent claims by locking the shared pet.
  PERFORM 1
  FROM public.pets
  WHERE id = p_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;

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

  UPDATE public.pet_adventure_rewards r
  SET
    image_status = 'generating',
    image_requested_at = now()
  FROM public.pet_adventure_quests q
  WHERE r.id = p_reward_id
    AND r.pet_id = p_pet_id
    AND r.quest_id = q.id
    AND q.pet_id = p_pet_id
    AND q.completed_at IS NOT NULL
    AND r.choice = 'accepted'
    AND r.available_at <= now()
    AND r.image_status = 'none'
  RETURNING r.id INTO v_claimed;

  IF v_claimed IS NULL THEN
    RETURN 'UNAVAILABLE';
  END IF;

  RETURN 'CLAIMED';
END;
$$;

REVOKE ALL ON FUNCTION
  public.claim_pet_adventure_reward_image(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.claim_pet_adventure_reward_image(uuid, uuid)
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
