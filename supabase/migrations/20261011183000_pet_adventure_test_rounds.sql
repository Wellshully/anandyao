-- Pet Adventure V1.3: local test quest rounds
-- Preserves existing quests and rewards.

begin;

alter table public.pet_adventure_quests
  add column if not exists test_round integer not null default 0
  check (test_round between 0 and 99);

alter table public.pet_adventure_quests
  drop constraint if exists pet_adventure_quests_pet_id_quest_date_key;

create unique index if not exists pet_adventure_quests_pet_date_round_key
  on public.pet_adventure_quests(pet_id, quest_date, test_round);

commit;

notify pgrst, 'reload schema';
