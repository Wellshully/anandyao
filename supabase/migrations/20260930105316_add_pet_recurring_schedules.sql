create table public.pet_recurring_schedules (
  id uuid primary key default gen_random_uuid(),

  pet_id uuid not null
    references public.pets(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  title text not null,

  note text,

  /*
   * RFC 5545-style recurrence body.
   *
   * Examples:
   *
   * FREQ=WEEKLY;BYDAY=TU,FR
   *
   * FREQ=WEEKLY;INTERVAL=2;BYDAY=TH
   */
  recurrence_rule text not null,

  /*
   * Important for INTERVAL=2.
   *
   * This defines which week is the first week
   * of an every-other-week schedule.
   */
  recurrence_start_date date not null,

  recurrence_end_date date,

  time_precision text not null
    default 'none'
    check (
      time_precision in (
        'none',
        'daypart',
        'exact'
      )
    ),

  /*
   * Used only when time_precision = exact.
   *
   * Example:
   * 每週二晚上 7 點家教
   * → 19:00
   */
  start_time time,

  /*
   * Preserve the original human expression
   * for detail UI / future reparsing.
   *
   * Examples:
   * 每週二跟五
   * 隔週四
   * 每週二晚上七點
   */
  recurrence_expression text,

  status text not null
    default 'active'
    check (
      status in (
        'active',
        'paused',
        'cancelled'
      )
    ),

  created_from text not null
    default 'chat',

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint pet_recurring_schedules_valid_range
    check (
      recurrence_end_date is null
      or recurrence_end_date >= recurrence_start_date
    ),

  constraint pet_recurring_schedules_exact_requires_time
    check (
      time_precision <> 'exact'
      or start_time is not null
    )
);


create index pet_recurring_schedules_user_status_idx
on public.pet_recurring_schedules (
  user_id,
  status
);


create index pet_recurring_schedules_start_idx
on public.pet_recurring_schedules (
  user_id,
  recurrence_start_date
);


alter table public.pet_recurring_schedules
enable row level security;


create policy "users can read own recurring schedules"
on public.pet_recurring_schedules
for select
to authenticated
using (
  auth.uid() = user_id
);


create policy "users can insert own recurring schedules"
on public.pet_recurring_schedules
for insert
to authenticated
with check (
  auth.uid() = user_id
);


create policy "users can update own recurring schedules"
on public.pet_recurring_schedules
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);


create policy "users can delete own recurring schedules"
on public.pet_recurring_schedules
for delete
to authenticated
using (
  auth.uid() = user_id
);
