-- =========================================================
-- Profile bootstrap + initial shared space
-- =========================================================


-- ---------------------------------------------------------
-- Give every space a stable slug.
-- For this project the main one will be:
-- an-and-yao
-- ---------------------------------------------------------

alter table public.spaces
add column slug text not null unique;


-- Useful if we look up a space by slug.
create index spaces_slug_idx
on public.spaces(slug);


-- =========================================================
-- PROFILE AUTO CREATION
-- =========================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    coalesce(
      nullif(
        new.raw_user_meta_data ->> 'display_name',
        ''
      ),
      nullif(
        split_part(new.email, '@', 1),
        ''
      ),
      'Member'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


revoke all
on function private.handle_new_user()
from public, anon, authenticated;


drop trigger if exists on_auth_user_created
on auth.users;


create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();


-- ---------------------------------------------------------
-- Backfill profiles for users that existed before
-- this trigger was created.
--
-- This matters because Yao's Auth account already exists.
-- ---------------------------------------------------------

insert into public.profiles (
  id,
  display_name
)
select
  id,
  coalesce(
    nullif(
      raw_user_meta_data ->> 'display_name',
      ''
    ),
    nullif(
      split_part(email, '@', 1),
      ''
    ),
    'Member'
  )
from auth.users
on conflict (id) do nothing;


-- =========================================================
-- INITIAL SPACE CREATION
--
-- Uses security invoker (the default security model).
-- The existing RLS policies still apply.
-- =========================================================

create or replace function public.claim_initial_space(
  space_name text,
  space_slug text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid;
  new_space_id uuid;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.spaces (
    name,
    slug,
    created_by
  )
  values (
    space_name,
    space_slug,
    current_user_id
  )
  returning id into new_space_id;

  insert into public.space_members (
    space_id,
    user_id,
    role
  )
  values (
    new_space_id,
    current_user_id,
    'owner'
  );

  return new_space_id;
end;
$$;


revoke execute
on function public.claim_initial_space(text, text)
from public, anon;


grant execute
on function public.claim_initial_space(text, text)
to authenticated;
