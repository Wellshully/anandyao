alter table public.pet_tasks
add column due_has_time boolean not null default false;

-- Existing rows whose Taipei time is not our old
-- synthetic 23:59:59 fallback are treated as having
-- an explicit time.
update public.pet_tasks
set due_has_time = true
where due_at is not null
  and to_char(
    due_at at time zone 'Asia/Taipei',
    'HH24:MI:SS'
  ) <> '23:59:59';

alter table public.pet_tasks
add constraint pet_tasks_due_has_time_requires_due_at
check (
  not due_has_time
  or due_at is not null
);
