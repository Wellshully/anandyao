create table public.date_recap_media (
  recap_id uuid not null
    references public.date_recaps(id)
    on delete cascade,

  media_id uuid not null
    references public.media(id)
    on delete cascade,

  sort_order integer not null
    default 0,

  created_at timestamptz not null
    default now(),

  primary key (
    recap_id,
    media_id
  )
);


create index date_recap_media_order_idx
on public.date_recap_media(
  recap_id,
  sort_order
);


alter table public.date_recap_media
enable row level security;


/*
 * Both accepted participants may see
 * photos belonging to this recap.
 */
create policy "date recap media select"
on public.date_recap_media
for select
to authenticated
using (
  exists (
    select 1
    from public.date_recaps dr

    join public.date_participants dp
      on dp.date_id = dr.date_id

    where dr.id =
      date_recap_media.recap_id

      and dp.user_id =
        auth.uid()

      and dp.status =
        'accepted'
  )
);


/*
 * Both accepted participants may
 * add photos to the shared recap.
 */
create policy "date recap media insert"
on public.date_recap_media
for insert
to authenticated
with check (
  exists (
    select 1
    from public.date_recaps dr

    join public.date_participants dp
      on dp.date_id = dr.date_id

    where dr.id =
      date_recap_media.recap_id

      and dp.user_id =
        auth.uid()

      and dp.status =
        'accepted'
  )
);


/*
 * Both accepted participants may
 * remove photos from the recap.
 */
create policy "date recap media delete"
on public.date_recap_media
for delete
to authenticated
using (
  exists (
    select 1
    from public.date_recaps dr

    join public.date_participants dp
      on dp.date_id = dr.date_id

    where dr.id =
      date_recap_media.recap_id

      and dp.user_id =
        auth.uid()

      and dp.status =
        'accepted'
  )
);
