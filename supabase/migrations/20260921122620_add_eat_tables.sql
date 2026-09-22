-- =========================================================
-- Eat
-- =========================================================

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  name text not null,

  area text,
  address text,

  cuisines text[] not null default '{}',
  contexts text[] not null default '{}',

  price_level smallint
    check (
      price_level is null
      or price_level between 1 and 4
    ),

  latitude double precision,
  longitude double precision,

  google_place_id text,
  google_maps_url text,

  note text,

  source text not null default 'manual'
    check (
      source in (
        'manual',
        'ntufood',
        'google'
      )
    ),

  source_key text,

  is_hidden boolean not null default false,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- Restaurant visits
-- =========================================================

create table public.restaurant_visits (
  id uuid primary key default gen_random_uuid(),

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  restaurant_id uuid not null
    references public.restaurants(id)
    on delete cascade,

  visited_at timestamptz not null default now(),

  selected_by_picker boolean not null default false,

  note text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now()
);


-- =========================================================
-- Indexes
-- =========================================================

create index restaurants_space_id_idx
  on public.restaurants(space_id);

create index restaurants_area_idx
  on public.restaurants(space_id, area);

create index restaurants_price_level_idx
  on public.restaurants(space_id, price_level);

create index restaurants_source_idx
  on public.restaurants(space_id, source);

create index restaurants_cuisines_idx
  on public.restaurants
  using gin(cuisines);

create index restaurants_contexts_idx
  on public.restaurants
  using gin(contexts);

create index restaurant_visits_restaurant_id_idx
  on public.restaurant_visits(restaurant_id);

create index restaurant_visits_space_date_idx
  on public.restaurant_visits(
    space_id,
    visited_at desc
  );


-- Same imported restaurant should not be duplicated.

create unique index restaurants_source_key_unique_idx
  on public.restaurants(
    space_id,
    source,
    source_key
  )
  where source_key is not null;


-- Prepare for Google Places integration later.

create unique index restaurants_google_place_id_unique_idx
  on public.restaurants(
    space_id,
    google_place_id
  )
  where google_place_id is not null;


-- =========================================================
-- updated_at
-- =========================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row
execute function private.set_updated_at();


-- =========================================================
-- RLS
-- =========================================================

alter table public.restaurants
enable row level security;

alter table public.restaurant_visits
enable row level security;


-- Restaurants

create policy "space members can read restaurants"
on public.restaurants
for select
to authenticated
using (
  private.is_space_member(space_id)
);


create policy "space members can create restaurants"
on public.restaurants
for insert
to authenticated
with check (
  private.is_space_member(space_id)
  and created_by = auth.uid()
);


create policy "space members can update restaurants"
on public.restaurants
for update
to authenticated
using (
  private.is_space_member(space_id)
)
with check (
  private.is_space_member(space_id)
);


create policy "space members can delete restaurants"
on public.restaurants
for delete
to authenticated
using (
  private.is_space_member(space_id)
);


-- Restaurant visits

create policy "space members can read restaurant visits"
on public.restaurant_visits
for select
to authenticated
using (
  private.is_space_member(space_id)
);


create policy "space members can create restaurant visits"
on public.restaurant_visits
for insert
to authenticated
with check (
  private.is_space_member(space_id)
  and created_by = auth.uid()
);


create policy "space members can update restaurant visits"
on public.restaurant_visits
for update
to authenticated
using (
  private.is_space_member(space_id)
)
with check (
  private.is_space_member(space_id)
);


create policy "space members can delete restaurant visits"
on public.restaurant_visits
for delete
to authenticated
using (
  private.is_space_member(space_id)
);
