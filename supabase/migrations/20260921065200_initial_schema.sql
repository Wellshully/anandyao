-- =========================================================
-- An & Yao - Initial Database Schema
-- =========================================================


-- ---------------------------------------------------------
-- Private schema
-- Used for helper functions that should not be exposed
-- through the Supabase Data API.
-- ---------------------------------------------------------

create schema if not exists private;

revoke all on schema private from public;


-- =========================================================
-- TABLES
-- =========================================================


-- ---------------------------------------------------------
-- Profiles
-- One profile for each Supabase Auth user.
-- ---------------------------------------------------------

create table public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  display_name text not null,

  avatar_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- Spaces
-- "An & Yao" is one shared space.
-- This allows the architecture to stay generic.
-- ---------------------------------------------------------

create table public.spaces (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  created_by uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- Space Members
-- Users who belong to a shared space.
-- ---------------------------------------------------------

create table public.space_members (
  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role text not null default 'member'
    check (role in ('owner', 'member')),

  joined_at timestamptz not null default now(),

  primary key (space_id, user_id)
);


-- ---------------------------------------------------------
-- Memories
-- Timeline entries / shared memories.
-- Photos will be connected later through Storage.
-- ---------------------------------------------------------

create table public.memories (
  id uuid primary key default gen_random_uuid(),

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  created_by uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  title text not null,

  body text,

  memory_date date not null,

  location_name text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- Places
-- Shared bucket list / visited places.
-- ---------------------------------------------------------

create table public.places (
  id uuid primary key default gen_random_uuid(),

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  created_by uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  name text not null,

  status text not null default 'want_to_go'
    check (
      status in (
        'want_to_go',
        'visited',
        'revisit'
      )
    ),

  note text,

  address text,

  latitude double precision
    check (
      latitude is null
      or latitude between -90 and 90
    ),

  longitude double precision
    check (
      longitude is null
      or longitude between -180 and 180
    ),

  visited_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- Journal
-- Blog / shared journal entries.
-- ---------------------------------------------------------

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  author_id uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  title text not null,

  content text not null,

  entry_date date not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- Events
-- Our own calendar/event metadata.
-- Google Calendar integration can be added later.
-- ---------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  created_by uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  title text not null,

  starts_at timestamptz not null,

  ends_at timestamptz,

  all_day boolean not null default false,

  location text,

  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    ends_at is null
    or ends_at >= starts_at
  )
);


-- =========================================================
-- INDEXES
-- =========================================================

create index space_members_user_id_idx
  on public.space_members(user_id);

create index spaces_created_by_idx
  on public.spaces(created_by);

create index memories_space_date_idx
  on public.memories(space_id, memory_date desc);

create index places_space_status_idx
  on public.places(space_id, status);

create index journal_space_date_idx
  on public.journal_entries(space_id, entry_date desc);

create index events_space_starts_at_idx
  on public.events(space_id, starts_at);


-- =========================================================
-- UPDATED_AT TRIGGER
-- =========================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();


create trigger spaces_set_updated_at
before update on public.spaces
for each row
execute function private.set_updated_at();


create trigger memories_set_updated_at
before update on public.memories
for each row
execute function private.set_updated_at();


create trigger places_set_updated_at
before update on public.places
for each row
execute function private.set_updated_at();


create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row
execute function private.set_updated_at();


create trigger events_set_updated_at
before update on public.events
for each row
execute function private.set_updated_at();


-- =========================================================
-- RLS HELPER FUNCTIONS
-- =========================================================


-- Is the current user a member of this space?

create or replace function private.is_space_member(
  target_space_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members
    where space_id = target_space_id
      and user_id = (select auth.uid())
  );
$$;


-- Is the current user an owner of this space?

create or replace function private.is_space_owner(
  target_space_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members
    where space_id = target_space_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;


-- Did the current user originally create this space?

create or replace function private.is_space_creator(
  target_space_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.spaces
    where id = target_space_id
      and created_by = (select auth.uid())
  );
$$;


-- Can the current user view another user's profile?

create or replace function private.can_view_profile(
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_user_id = (select auth.uid())

    or exists (
      select 1
      from public.space_members mine
      join public.space_members theirs
        on theirs.space_id = mine.space_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = target_user_id
    );
$$;


revoke execute on function private.is_space_member(uuid)
from public;

revoke execute on function private.is_space_owner(uuid)
from public;

revoke execute on function private.is_space_creator(uuid)
from public;

revoke execute on function private.can_view_profile(uuid)
from public;

revoke execute on function private.set_updated_at()
from public;


grant usage on schema private
to authenticated;

grant execute on function private.is_space_member(uuid)
to authenticated;

grant execute on function private.is_space_owner(uuid)
to authenticated;

grant execute on function private.is_space_creator(uuid)
to authenticated;

grant execute on function private.can_view_profile(uuid)
to authenticated;

grant execute on function private.set_updated_at()
to authenticated;


-- =========================================================
-- ENABLE ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles
enable row level security;

alter table public.spaces
enable row level security;

alter table public.space_members
enable row level security;

alter table public.memories
enable row level security;

alter table public.places
enable row level security;

alter table public.journal_entries
enable row level security;

alter table public.events
enable row level security;


-- =========================================================
-- TABLE PRIVILEGES
-- =========================================================

revoke all on table public.profiles
from anon, authenticated;

revoke all on table public.spaces
from anon, authenticated;

revoke all on table public.space_members
from anon, authenticated;

revoke all on table public.memories
from anon, authenticated;

revoke all on table public.places
from anon, authenticated;

revoke all on table public.journal_entries
from anon, authenticated;

revoke all on table public.events
from anon, authenticated;


-- Profiles

grant select, insert
on table public.profiles
to authenticated;

grant update (display_name, avatar_path)
on table public.profiles
to authenticated;


-- Spaces

grant select, insert, delete
on table public.spaces
to authenticated;

grant update (name)
on table public.spaces
to authenticated;


-- Space members

grant select, insert, delete
on table public.space_members
to authenticated;

grant update (role)
on table public.space_members
to authenticated;


-- Memories

grant select, insert, delete
on table public.memories
to authenticated;

grant update (
  title,
  body,
  memory_date,
  location_name
)
on table public.memories
to authenticated;


-- Places

grant select, insert, delete
on table public.places
to authenticated;

grant update (
  name,
  status,
  note,
  address,
  latitude,
  longitude,
  visited_on
)
on table public.places
to authenticated;


-- Journal

grant select, insert, delete
on table public.journal_entries
to authenticated;

grant update (
  title,
  content,
  entry_date
)
on table public.journal_entries
to authenticated;


-- Events

grant select, insert, delete
on table public.events
to authenticated;

grant update (
  title,
  starts_at,
  ends_at,
  all_day,
  location,
  note
)
on table public.events
to authenticated;


-- =========================================================
-- PROFILES POLICIES
-- =========================================================

create policy "Profiles are visible to shared-space users"
on public.profiles
for select
to authenticated
using (
  (select private.can_view_profile(id))
);


create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
);


create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);


-- =========================================================
-- SPACES POLICIES
-- =========================================================

create policy "Members can view spaces"
on public.spaces
for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.is_space_member(id))
);


create policy "Users can create spaces"
on public.spaces
for insert
to authenticated
with check (
  created_by = (select auth.uid())
);


create policy "Owners can update spaces"
on public.spaces
for update
to authenticated
using (
  (select private.is_space_owner(id))
)
with check (
  (select private.is_space_owner(id))
);


create policy "Owners can delete spaces"
on public.spaces
for delete
to authenticated
using (
  (select private.is_space_owner(id))
);


-- =========================================================
-- SPACE MEMBERS POLICIES
-- =========================================================

create policy "Members can view memberships"
on public.space_members
for select
to authenticated
using (
  (select private.is_space_member(space_id))
  or
  (select private.is_space_creator(space_id))
);


create policy "Owners can add members"
on public.space_members
for insert
to authenticated
with check (
  (select private.is_space_owner(space_id))
  or
  (select private.is_space_creator(space_id))
);


create policy "Owners can update members"
on public.space_members
for update
to authenticated
using (
  (select private.is_space_owner(space_id))
)
with check (
  (select private.is_space_owner(space_id))
);


create policy "Owners can remove members"
on public.space_members
for delete
to authenticated
using (
  (select private.is_space_owner(space_id))
);


-- =========================================================
-- MEMORIES POLICIES
-- =========================================================

create policy "Members can view memories"
on public.memories
for select
to authenticated
using (
  (select private.is_space_member(space_id))
);


create policy "Members can create memories"
on public.memories
for insert
to authenticated
with check (
  (select private.is_space_member(space_id))
  and created_by = (select auth.uid())
);


create policy "Members can update memories"
on public.memories
for update
to authenticated
using (
  (select private.is_space_member(space_id))
)
with check (
  (select private.is_space_member(space_id))
);


create policy "Members can delete memories"
on public.memories
for delete
to authenticated
using (
  (select private.is_space_member(space_id))
);


-- =========================================================
-- PLACES POLICIES
-- =========================================================

create policy "Members can view places"
on public.places
for select
to authenticated
using (
  (select private.is_space_member(space_id))
);


create policy "Members can create places"
on public.places
for insert
to authenticated
with check (
  (select private.is_space_member(space_id))
  and created_by = (select auth.uid())
);


create policy "Members can update places"
on public.places
for update
to authenticated
using (
  (select private.is_space_member(space_id))
)
with check (
  (select private.is_space_member(space_id))
);


create policy "Members can delete places"
on public.places
for delete
to authenticated
using (
  (select private.is_space_member(space_id))
);


-- =========================================================
-- JOURNAL POLICIES
-- =========================================================

create policy "Members can view journal entries"
on public.journal_entries
for select
to authenticated
using (
  (select private.is_space_member(space_id))
);


create policy "Members can create journal entries"
on public.journal_entries
for insert
to authenticated
with check (
  (select private.is_space_member(space_id))
  and author_id = (select auth.uid())
);


create policy "Members can update journal entries"
on public.journal_entries
for update
to authenticated
using (
  (select private.is_space_member(space_id))
)
with check (
  (select private.is_space_member(space_id))
);


create policy "Members can delete journal entries"
on public.journal_entries
for delete
to authenticated
using (
  (select private.is_space_member(space_id))
);


-- =========================================================
-- EVENTS POLICIES
-- =========================================================

create policy "Members can view events"
on public.events
for select
to authenticated
using (
  (select private.is_space_member(space_id))
);


create policy "Members can create events"
on public.events
for insert
to authenticated
with check (
  (select private.is_space_member(space_id))
  and created_by = (select auth.uid())
);


create policy "Members can update events"
on public.events
for update
to authenticated
using (
  (select private.is_space_member(space_id))
)
with check (
  (select private.is_space_member(space_id))
);


create policy "Members can delete events"
on public.events
for delete
to authenticated
using (
  (select private.is_space_member(space_id))
);
