create table public.date_recaps (
  id uuid primary key default gen_random_uuid(),

  date_id uuid not null
    references public.dates(id)
    on delete cascade,

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  created_by uuid not null
    references public.profiles(id)
    on delete cascade,

  favorite_moment text,
  future_note text,

  status text not null
    default 'draft'
    check (
      status in (
        'draft',
        'completed'
      )
    ),

  completed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique(date_id)
);


create index date_recaps_space_id_idx
on public.date_recaps(space_id);

create index date_recaps_date_id_idx
on public.date_recaps(date_id);


create trigger set_date_recaps_updated_at
before update
on public.date_recaps
for each row
execute function private.set_updated_at();


alter table public.date_recaps
enable row level security;


/*
 * Both accepted participants may read
 * the shared recap.
 */
create policy "date recap select"
on public.date_recaps
for select
to authenticated
using (
  exists (
    select 1
    from public.date_participants dp
    where dp.date_id = date_recaps.date_id
      and dp.user_id = auth.uid()
      and dp.status = 'accepted'
  )
);


/*
 * Either accepted participant may
 * start the recap.
 */
create policy "date recap insert"
on public.date_recaps
for insert
to authenticated
with check (
  created_by = auth.uid()

  and exists (
    select 1
    from public.date_participants dp
    where dp.date_id = date_recaps.date_id
      and dp.user_id = auth.uid()
      and dp.status = 'accepted'
  )

  and exists (
    select 1
    from public.dates d
    where d.id = date_recaps.date_id
      and d.space_id = date_recaps.space_id
  )
);


/*
 * The recap is shared, so either accepted
 * participant may continue editing it.
 */
create policy "date recap update"
on public.date_recaps
for update
to authenticated
using (
  exists (
    select 1
    from public.date_participants dp
    where dp.date_id = date_recaps.date_id
      and dp.user_id = auth.uid()
      and dp.status = 'accepted'
  )
)
with check (
  exists (
    select 1
    from public.date_participants dp
    where dp.date_id = date_recaps.date_id
      and dp.user_id = auth.uid()
      and dp.status = 'accepted'
  )
);
