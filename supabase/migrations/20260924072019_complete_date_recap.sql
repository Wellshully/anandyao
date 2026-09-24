alter table public.date_recaps
add column if not exists memory_id uuid
references public.memories(id)
on delete set null;


create unique index if not exists date_recaps_memory_id_unique
on public.date_recaps(memory_id)
where memory_id is not null;


create or replace function public.complete_date_recap(
  p_date_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;

  v_recap public.date_recaps%rowtype;
  v_date public.dates%rowtype;

  v_memory_id uuid;

  v_today date;

  v_photo_count integer;

  v_location_name text;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_today :=
    (
      now()
      at time zone 'Asia/Taipei'
    )::date;


  /*
   * Lock the Date while completing.
   */
  select *
  into v_date
  from public.dates
  where id = p_date_id
  for update;

  if not found then
    raise exception 'Date not found';
  end if;


  /*
   * User must be an accepted participant.
   */
  if not exists (
    select 1
    from public.date_participants dp
    where dp.date_id = p_date_id
      and dp.user_id = v_user_id
      and dp.status = 'accepted'
  ) then
    raise exception 'You are not an accepted participant';
  end if;


  select *
  into v_recap
  from public.date_recaps
  where date_id = p_date_id
  for update;

  if not found then
    raise exception 'Recap not found';
  end if;


  /*
   * Make the operation idempotent.
   */
  if (
    v_recap.status = 'completed'
    and v_recap.memory_id is not null
  ) then
    return v_recap.memory_id;
  end if;


  if v_date.status <> 'accepted' then
    raise exception 'This Date cannot be completed';
  end if;


  /*
   * Must actually be after the Date.
   */
  if v_date.end_date >= v_today then
    raise exception 'This Date has not ended yet';
  end if;


  /*
   * Recap is only available for 7 days.
   */
  if v_today > (
    v_date.end_date + 7
  ) then
    raise exception 'The recap window has expired';
  end if;


  /*
   * Require some text.
   */
  if coalesce(
    trim(
      v_recap.favorite_moment
    ),
    ''
  ) = '' then
    raise exception 'Please write something about this Date';
  end if;


  /*
   * Require at least one photo.
   */
  select count(*)
  into v_photo_count
  from public.date_recap_media drm
  where drm.recap_id =
    v_recap.id;

  if v_photo_count = 0 then
    raise exception 'Please add at least one photo';
  end if;


  /*
   * Automatically use the first itinerary
   * location as the Memory location.
   */
  select di.location_name
  into v_location_name
  from public.date_itinerary_items di

  join public.date_days dd
    on dd.id =
      di.date_day_id

  where di.date_id =
      p_date_id

    and di.location_name
      is not null

    and trim(
      di.location_name
    ) <> ''

  order by
    dd.day_number asc,
    di.sort_order asc

  limit 1;


  /*
   * Create the Memory.
   */
  insert into public.memories (
    space_id,
    created_by,
    title,
    body,
    memory_date,
    location_name
  )
  values (
    v_date.space_id,
    v_user_id,
    v_date.title,
    v_recap.favorite_moment,
    v_date.start_date,
    v_location_name
  )
  returning id
  into v_memory_id;


  /*
   * Reuse the exact same media rows.
   * No duplicate upload.
   */
  insert into public.memory_media (
    memory_id,
    media_id,
    sort_order
  )
  select
    v_memory_id,
    drm.media_id,
    drm.sort_order
  from public.date_recap_media drm
  where drm.recap_id =
    v_recap.id
  order by
    drm.sort_order;


  update public.date_recaps
  set
    status = 'completed',
    completed_at = now(),
    memory_id = v_memory_id
  where id =
    v_recap.id;


  update public.dates
  set
    status = 'completed',
    updated_at = now()
  where id =
    p_date_id;


  return v_memory_id;
end;
$$;


revoke all
on function public.complete_date_recap(uuid)
from public;

grant execute
on function public.complete_date_recap(uuid)
to authenticated;
