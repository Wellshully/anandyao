create or replace function public.reorder_date_itinerary(
  p_date_day_id uuid,
  p_item_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date_id uuid;
  v_space_id uuid;
  v_existing_count integer;
  v_input_count integer;
  v_distinct_count integer;
begin
  select
    date_id,
    space_id
  into
    v_date_id,
    v_space_id
  from public.date_days
  where id = p_date_day_id;

  if v_date_id is null then
    raise exception 'Date day not found';
  end if;

  if not private.is_date_accepted_participant(v_date_id) then
    raise exception 'You cannot edit this date';
  end if;

  select count(*)
  into v_existing_count
  from public.date_itinerary_items
  where date_day_id = p_date_day_id;

  v_input_count :=
    coalesce(
      array_length(
        p_item_ids,
        1
      ),
      0
    );

  select count(
    distinct item_id
  )
  into v_distinct_count
  from unnest(
    p_item_ids
  ) as item_id;

  if v_input_count <> v_existing_count then
    raise exception
      'Invalid itinerary item count';
  end if;

  if v_distinct_count <> v_input_count then
    raise exception
      'Duplicate itinerary items';
  end if;

  if exists (
    select 1
    from unnest(
      p_item_ids
    ) as input(item_id)
    where not exists (
      select 1
      from public.date_itinerary_items item
      where item.id = input.item_id
        and item.date_day_id = p_date_day_id
        and item.date_id = v_date_id
        and item.space_id = v_space_id
    )
  ) then
    raise exception
      'Invalid itinerary item';
  end if;

  update public.date_itinerary_items item
  set
    sort_order =
      ordered.position - 1,
    updated_at = now()
  from (
    select
      item_id,
      ordinality::integer
        as position
    from unnest(
      p_item_ids
    )
    with ordinality
      as input(
        item_id,
        ordinality
      )
  ) ordered
  where item.id =
    ordered.item_id;
end;
$$;


revoke all
on function public.reorder_date_itinerary(
  uuid,
  uuid[]
)
from public;


grant execute
on function public.reorder_date_itinerary(
  uuid,
  uuid[]
)
to authenticated;
