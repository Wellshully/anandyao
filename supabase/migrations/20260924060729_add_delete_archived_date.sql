create or replace function public.delete_archived_date(
  p_date_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_status text;
  v_end_date date;
  v_is_organizer boolean;
  v_today date;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_today :=
    (now() at time zone 'Asia/Taipei')::date;

  select
    d.status::text,
    d.end_date
  into
    v_status,
    v_end_date
  from public.dates d
  where d.id = p_date_id;

  if not found then
    raise exception 'Date not found';
  end if;

  select exists (
    select 1
    from public.date_participants dp
    where dp.date_id = p_date_id
      and dp.user_id = v_user_id
      and dp.role = 'organizer'
  )
  into v_is_organizer;

  if not v_is_organizer then
    raise exception 'Only the organizer can permanently delete this date';
  end if;

  /*
   * Permanent deletion is only allowed
   * after the Date belongs in Archive.
   */
  if not (
    v_status in (
      'cancelled',
      'completed',
      'declined'
    )
    or v_end_date < v_today
  ) then
    raise exception 'Only archived dates can be permanently deleted';
  end if;

  delete from public.dates
  where id = p_date_id;
end;
$$;


revoke all
on function public.delete_archived_date(uuid)
from public;

grant execute
on function public.delete_archived_date(uuid)
to authenticated;
