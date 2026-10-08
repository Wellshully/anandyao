create table public.pet_recurring_schedule_exceptions (
  schedule_id uuid not null
    references public.pet_recurring_schedules(id)
    on delete cascade,

  occurrence_date date not null,

  kind text not null
    check (kind in ('override', 'cancelled')),

  title_override text,
  note_override text,

  time_precision_override text
    check (
      time_precision_override is null
      or time_precision_override in (
        'none',
        'daypart',
        'exact'
      )
    ),

  start_time_override time without time zone,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (
    schedule_id,
    occurrence_date
  ),

  constraint exception_valid_time_override
    check (
      (
        time_precision_override is null
        and start_time_override is null
      )
      or (
        time_precision_override = 'exact'
        and start_time_override is not null
      )
      or (
        time_precision_override in ('none', 'daypart')
        and start_time_override is null
      )
    ),

  constraint cancelled_has_no_overrides
    check (
      kind <> 'cancelled'
      or (
        title_override is null
        and note_override is null
        and time_precision_override is null
        and start_time_override is null
      )
    )
);

create index pet_recurring_exceptions_date_idx
on public.pet_recurring_schedule_exceptions (
  occurrence_date
);

alter table public.pet_recurring_schedule_exceptions
enable row level security;

create policy "Users manage own recurring exceptions"
on public.pet_recurring_schedule_exceptions
for all
to authenticated
using (
  exists (
    select 1
    from public.pet_recurring_schedules s
    where s.id = schedule_id
      and s.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.pet_recurring_schedules s
    where s.id = schedule_id
      and s.user_id = (select auth.uid())
  )
);

revoke all
on public.pet_recurring_schedule_exceptions
from anon;

grant select, insert, update, delete
on public.pet_recurring_schedule_exceptions
to authenticated;

grant all
on public.pet_recurring_schedule_exceptions
to service_role;
