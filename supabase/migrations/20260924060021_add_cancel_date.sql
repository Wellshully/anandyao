create or replace function public.cancel_date(
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
  v_is_organizer boolean;
  v_is_accepted_participant boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select d.status::text
  into v_status
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

  select exists (
    select 1
    from public.date_participants dp
    where dp.date_id = p_date_id
      and dp.user_id = v_user_id
      and dp.status = 'accepted'
  )
  into v_is_accepted_participant;

  /*
   * Pending invitation:
   * only organizer may withdraw it.
   */
  if v_status = 'pending' then
    if not v_is_organizer then
      raise exception 'Only the organizer can cancel a pending date';
    end if;

  /*
   * Accepted Date:
   * either accepted participant may cancel.
   */
  elsif v_status = 'accepted' then
    if not v_is_accepted_participant then
      raise exception 'You are not an accepted participant of this date';
    end if;

  else
    raise exception 'This date can no longer be cancelled';
  end if;

  update public.dates
  set
    status = 'cancelled',
    updated_at = now()
  where id = p_date_id;
end;
$$;


revoke all
on function public.cancel_date(uuid)
from public;

grant execute
on function public.cancel_date(uuid)
to authenticated;
