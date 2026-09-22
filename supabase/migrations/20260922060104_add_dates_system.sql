-- =========================================================
-- Dates
-- Core shared date / trip planning system
-- =========================================================

create table public.dates (
  id uuid primary key default gen_random_uuid(),

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  title text not null,

  description text,

  kind text not null default 'date'
    check (
      kind in (
        'meal',
        'date',
        'half_day',
        'day',
        'trip'
      )
    ),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'accepted',
        'declined',
        'cancelled',
        'completed'
      )
    ),

  start_date date not null,
  end_date date not null,

  organizer_id uuid not null
    references auth.users(id)
    on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dates_valid_range
    check (
      end_date >= start_date
    )
);


-- Needed for composite foreign keys on child tables.

alter table public.dates
add constraint dates_id_space_unique
unique (id, space_id);


-- =========================================================
-- Date participants / invitations
-- =========================================================

create table public.date_participants (
  id uuid primary key default gen_random_uuid(),

  date_id uuid not null,

  space_id uuid not null,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role text not null
    check (
      role in (
        'organizer',
        'invitee'
      )
    ),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'accepted',
        'declined'
      )
    ),

  responded_at timestamptz,

  created_at timestamptz not null default now(),

  constraint date_participants_date_space_fkey
    foreign key (
      date_id,
      space_id
    )
    references public.dates (
      id,
      space_id
    )
    on delete cascade,

  constraint organizer_must_be_accepted
    check (
      role <> 'organizer'
      or status = 'accepted'
    ),

  constraint date_participant_unique
    unique (
      date_id,
      user_id
    )
);


-- =========================================================
-- Date days
--
-- A single dinner:
--   Day 1 = 2026-10-03
--
-- A three-day trip:
--   Day 1 = 2026-10-03
--   Day 2 = 2026-10-04
--   Day 3 = 2026-10-05
-- =========================================================

create table public.date_days (
  id uuid primary key default gen_random_uuid(),

  date_id uuid not null,

  space_id uuid not null,

  day_number integer not null
    check (
      day_number >= 1
    ),

  date date not null,

  title text,

  note text,

  planning_start_time time
    not null
    default '09:00',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint date_days_date_space_fkey
    foreign key (
      date_id,
      space_id
    )
    references public.dates (
      id,
      space_id
    )
    on delete cascade,

  constraint date_day_number_unique
    unique (
      date_id,
      day_number
    ),

  constraint date_day_date_unique
    unique (
      date_id,
      date
    )
);


alter table public.date_days
add constraint date_days_id_date_space_unique
unique (
  id,
  date_id,
  space_id
);


-- =========================================================
-- Itinerary items
-- =========================================================

create table public.date_itinerary_items (
  id uuid primary key default gen_random_uuid(),

  date_id uuid not null,

  date_day_id uuid not null,

  space_id uuid not null,

  item_type text not null default 'activity'
    check (
      item_type in (
        'place',
        'restaurant',
        'transport',
        'hotel',
        'activity',
        'note'
      )
    ),

  title text not null,

  description text,

  -- Optional links to existing An & Yao modules.

  place_id uuid
    references public.places(id)
    on delete set null,

  restaurant_id uuid
    references public.restaurants(id)
    on delete set null,

  -- Snapshot / manual location information.

  location_name text,
  address text,

  latitude double precision,
  longitude double precision,

  google_maps_url text,

  -- Position inside the day.

  sort_order integer not null default 0,

  -- flexible:
  --   time is calculated from order + durations
  --
  -- fixed:
  --   starts at fixed_start_time

  timing_type text not null default 'flexible'
    check (
      timing_type in (
        'flexible',
        'fixed'
      )
    ),

  fixed_start_time time,

  duration_minutes integer not null default 60
    check (
      duration_minutes > 0
      and duration_minutes <= 1440
    ),

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint itinerary_day_date_space_fkey
    foreign key (
      date_day_id,
      date_id,
      space_id
    )
    references public.date_days (
      id,
      date_id,
      space_id
    )
    on delete cascade,

  constraint fixed_item_requires_time
    check (
      timing_type <> 'fixed'
      or fixed_start_time is not null
    )
);


-- =========================================================
-- Indexes
-- =========================================================

create index dates_space_dates_idx
on public.dates (
  space_id,
  start_date,
  end_date
);


create index dates_space_status_idx
on public.dates (
  space_id,
  status
);


create index date_participants_user_idx
on public.date_participants (
  user_id,
  status
);


create index date_participants_date_idx
on public.date_participants (
  date_id
);


create index date_days_date_idx
on public.date_days (
  date_id,
  day_number
);


create index itinerary_day_order_idx
on public.date_itinerary_items (
  date_day_id,
  sort_order
);


create index itinerary_date_idx
on public.date_itinerary_items (
  date_id
);


-- =========================================================
-- updated_at
-- private.set_updated_at already exists from Eat
-- =========================================================

create trigger dates_set_updated_at
before update on public.dates
for each row
execute function private.set_updated_at();


create trigger date_days_set_updated_at
before update on public.date_days
for each row
execute function private.set_updated_at();


create trigger itinerary_items_set_updated_at
before update on public.date_itinerary_items
for each row
execute function private.set_updated_at();


-- =========================================================
-- Date authorization helpers
-- =========================================================

create or replace function private.is_date_participant(
  target_date_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.date_participants
    where date_id = target_date_id
      and user_id = auth.uid()
  );
$$;


create or replace function private.is_date_accepted_participant(
  target_date_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.date_participants
    where date_id = target_date_id
      and user_id = auth.uid()
      and status = 'accepted'
  );
$$;


create or replace function private.is_date_organizer(
  target_date_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dates
    where id = target_date_id
      and organizer_id = auth.uid()
  );
$$;


grant execute
on function private.is_date_participant(uuid)
to authenticated;

grant execute
on function private.is_date_accepted_participant(uuid)
to authenticated;

grant execute
on function private.is_date_organizer(uuid)
to authenticated;


-- =========================================================
-- RLS
-- =========================================================

alter table public.dates
enable row level security;

alter table public.date_participants
enable row level security;

alter table public.date_days
enable row level security;

alter table public.date_itinerary_items
enable row level security;


-- =========================================================
-- Dates policies
-- =========================================================

create policy "space members can read dates"
on public.dates
for select
to authenticated
using (
  private.is_space_member(space_id)
);


create policy "space members can create dates"
on public.dates
for insert
to authenticated
with check (
  private.is_space_member(space_id)
  and organizer_id = auth.uid()
);


create policy "accepted participants can update dates"
on public.dates
for update
to authenticated
using (
  private.is_date_accepted_participant(id)
)
with check (
  private.is_space_member(space_id)
);


create policy "organizer can delete dates"
on public.dates
for delete
to authenticated
using (
  private.is_date_organizer(id)
);


-- =========================================================
-- Participant policies
-- =========================================================

create policy "space members can read date participants"
on public.date_participants
for select
to authenticated
using (
  private.is_space_member(space_id)
);


create policy "organizer can add date participants"
on public.date_participants
for insert
to authenticated
with check (
  private.is_space_member(space_id)
  and private.is_date_organizer(date_id)
);


-- We intentionally do NOT add a general UPDATE policy here.
-- Invitation responses go through the controlled RPC below.


-- =========================================================
-- Date day policies
-- =========================================================

create policy "space members can read date days"
on public.date_days
for select
to authenticated
using (
  private.is_space_member(space_id)
);


create policy "accepted participants can create date days"
on public.date_days
for insert
to authenticated
with check (
  private.is_date_accepted_participant(date_id)
);


create policy "accepted participants can update date days"
on public.date_days
for update
to authenticated
using (
  private.is_date_accepted_participant(date_id)
)
with check (
  private.is_date_accepted_participant(date_id)
);


create policy "accepted participants can delete date days"
on public.date_days
for delete
to authenticated
using (
  private.is_date_accepted_participant(date_id)
);


-- =========================================================
-- Itinerary policies
-- =========================================================

create policy "space members can read itinerary items"
on public.date_itinerary_items
for select
to authenticated
using (
  private.is_space_member(space_id)
);


create policy "accepted participants can create itinerary items"
on public.date_itinerary_items
for insert
to authenticated
with check (
  private.is_date_accepted_participant(date_id)
  and (
    created_by is null
    or created_by = auth.uid()
  )
);


create policy "accepted participants can update itinerary items"
on public.date_itinerary_items
for update
to authenticated
using (
  private.is_date_accepted_participant(date_id)
)
with check (
  private.is_date_accepted_participant(date_id)
);


create policy "accepted participants can delete itinerary items"
on public.date_itinerary_items
for delete
to authenticated
using (
  private.is_date_accepted_participant(date_id)
);


-- =========================================================
-- Controlled invitation response
--
-- The invitee cannot arbitrarily edit the participant row.
-- They can only accept or decline their own invitation.
-- =========================================================

create or replace function public.respond_to_date_invitation(
  p_date_id uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_response not in (
    'accepted',
    'declined'
  ) then
    raise exception
      'Invalid invitation response';
  end if;

  update public.date_participants
  set
    status = p_response,
    responded_at = now()
  where date_id = p_date_id
    and user_id = auth.uid()
    and role = 'invitee'
    and status = 'pending';

  if not found then
    raise exception
      'Pending invitation not found';
  end if;

  update public.dates
  set
    status = p_response,
    updated_at = now()
  where id = p_date_id;
end;
$$;


revoke all
on function public.respond_to_date_invitation(uuid, text)
from public;

grant execute
on function public.respond_to_date_invitation(uuid, text)
to authenticated;
