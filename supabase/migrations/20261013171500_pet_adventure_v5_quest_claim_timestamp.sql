-- V5 quest AI claim timestamp.
-- Used for stale recovery without repeating a paid request.

BEGIN;

ALTER TABLE public.pet_adventure_quests
  ADD COLUMN ai_requested_at timestamptz;

COMMIT;

NOTIFY pgrst, 'reload schema';
