-- V5 reward diversity metadata.
-- Preserve all existing rewards and images.

BEGIN;

ALTER TABLE public.pet_adventure_rewards
  ADD COLUMN theme_tags text[] NOT NULL
    DEFAULT '{}'::text[]
    CONSTRAINT pet_adventure_reward_theme_tags_count_v5
    CHECK (cardinality(theme_tags) <= 5);

COMMIT;

NOTIFY pgrst, 'reload schema';
