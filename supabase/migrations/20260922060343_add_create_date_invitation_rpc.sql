create or replace function public.create_date_invitation(
  p_space_id uuid,
  p_invitee_id uuid,
  p_title text,
  p_description text,
  p_kind text,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_date_id uuid;
  v_day_offset integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if trim(p_title) = '' then
    raise exception 'Title is required';
  end if;

  if p_kind not in (
    'meal',
    'date',
    'half_day',
    'day',
    'trip'
  ) then
    raise exception 'Invalid date kind';
  end if;

  if p_end_date < p_start_date then
    raise exception 'End date cannot be before start date';
  end if;

  if p_invitee_id = v_user_id then
    raise exception 'Cannot invite yourself';
  end if;

  if not exists (
    select 1
    from public.space_members
    where space_id = p_space_id
      and user_id = v_user_id
  ) then
    raise exception 'You are not a member of this space';
  end if;

  if not exists (
    select 1
    from public.space_members
    where space_id = p_space_id
      and user_id = p_invitee_id
  ) then
    raise exception 'Invitee is not a member of this space';
  end if;

  insert into public.dates (
    space_id,
    title,
    description,
    kind,
    status,
    start_date,
    end_date,
    organizer_id
  )
  values (
    p_space_id,
    trim(p_title),
    nullif(trim(p_description), ''),
    p_kind,
    'pending',
    p_start_date,
    p_end_date,
    v_user_id
  )
  returning id
  into v_date_id;

  insert into public.date_participants (
    date_id,
    space_id,
    user_id,
    role,
    status,
    responded_at
  )
  values (
    v_date_id,
    p_space_id,
    v_user_id,
    'organizer',
    'accepted',
    now()
  );

  insert into public.date_participants (
    date_id,
    space_id,
    user_id,
    role,
    status
  )
  values (
    v_date_id,
    p_space_id,
    p_invitee_id,
    'invitee',
    'pending'
  );

  for v_day_offset in
    0..(p_end_date - p_start_date)
  loop
    insert into public.date_days (
      date_id,
      space_id,
      day_number,
      date,
      planning_start_time
    )
    values (
      v_date_id,
      p_space_id,
      v_day_offset + 1,
      p_start_date + v_day_offset,
      '09:00'
    );
  end loop;

  return v_date_id;
end;
$$;


revoke all
on function public.create_date_invitation(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  date
)
from public;


grant execute
on function public.create_date_invitation(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  date
)
to authenticated;
