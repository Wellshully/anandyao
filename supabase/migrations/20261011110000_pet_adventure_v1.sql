-- Pet Adventure V1: one shared Taipei-day quest, mystery reward, and room.
-- Run in Supabase only AFTER the accompanying application code is reviewed.

create table public.pet_adventure_quests (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  quest_date date not null,
  action_type text not null check (action_type in ('feed', 'pet', 'play')),
  goal smallint not null check (goal between 1 and 5),
  title text not null,
  story text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (pet_id, quest_date)
);

create table public.pet_adventure_rewards (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  quest_id uuid not null unique references public.pet_adventure_quests(id) on delete cascade,
  reward_type text not null check (reward_type in ('decor', 'room')),
  variant smallint not null check (variant between 0 and 99),
  title text not null,
  story text not null,
  available_at timestamptz not null,
  choice text check (choice in ('accepted', 'discarded')),
  chosen_at timestamptz,
  equipped boolean not null default false,
  created_at timestamptz not null default now(),
  constraint pet_adventure_reward_choice_equipped
    check ((choice = 'accepted') or (equipped = false))
);

create unique index pet_adventure_one_equipped_per_type
on public.pet_adventure_rewards (pet_id, reward_type)
where equipped = true;

create index pet_adventure_rewards_pet_created
on public.pet_adventure_rewards (pet_id, created_at desc);

alter table public.pet_adventure_quests enable row level security;
alter table public.pet_adventure_rewards enable row level security;

-- All access is through authenticated Next.js Server Actions using a service role.
-- The service key MUST remain on the server.
revoke all on table public.pet_adventure_quests from public, anon, authenticated;
revoke all on table public.pet_adventure_rewards from public, anon, authenticated;
grant select, insert, update, delete on table public.pet_adventure_quests to service_role;
grant select, insert, update, delete on table public.pet_adventure_rewards to service_role;

-- Atomic accept/discard. Never reveal or claim a reward before available_at.
create or replace function public.choose_pet_adventure_reward(
  p_pet_id uuid,
  p_reward_id uuid,
  p_choice text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_choice not in ('accepted', 'discarded') then
    raise exception 'Invalid reward choice';
  end if;

  update public.pet_adventure_rewards
  set choice = p_choice,
      chosen_at = now(),
      equipped = false
  where id = p_reward_id
    and pet_id = p_pet_id
    and choice is null
    and available_at <= now();

  return found;
end;
$$;

-- One room background and one featured decoration at a time for V1.
create or replace function public.equip_pet_adventure_reward(
  p_pet_id uuid,
  p_reward_id uuid,
  p_enabled boolean default true
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_type text;
begin
  -- Serialize actions by two people playing with the same shared pet.
  perform 1 from public.pets where id = p_pet_id for update;
  if not found then return false; end if;

  select reward_type into v_type
  from public.pet_adventure_rewards
  where id = p_reward_id and pet_id = p_pet_id and choice = 'accepted';

  if v_type is null then return false; end if;

  if p_enabled then
    update public.pet_adventure_rewards
       set equipped = false
     where pet_id = p_pet_id and reward_type = v_type and equipped = true;
  end if;

  update public.pet_adventure_rewards
     set equipped = p_enabled
   where id = p_reward_id and pet_id = p_pet_id and choice = 'accepted';

  return found;
end;
$$;

-- Let the user delete a once-accepted bad result as well.
create or replace function public.discard_pet_adventure_reward(
  p_pet_id uuid,
  p_reward_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.pet_adventure_rewards
     set choice = 'discarded', equipped = false, chosen_at = now()
   where pet_id = p_pet_id
     and id = p_reward_id
     and choice = 'accepted';
  return found;
end;
$$;

revoke execute on function public.choose_pet_adventure_reward(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.equip_pet_adventure_reward(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke execute on function public.discard_pet_adventure_reward(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.choose_pet_adventure_reward(uuid, uuid, text) to service_role;
grant execute on function public.equip_pet_adventure_reward(uuid, uuid, boolean) to service_role;
grant execute on function public.discard_pet_adventure_reward(uuid, uuid) to service_role;
