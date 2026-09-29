alter table public.pet_tasks
  add column if not exists temporal_kind text not null
    default 'flexible',
  add column if not exists time_precision text not null
    default 'none';

alter table public.pet_tasks
  drop constraint if exists pet_tasks_temporal_kind_check;

alter table public.pet_tasks
  add constraint pet_tasks_temporal_kind_check
  check (
    temporal_kind in (
      'scheduled',
      'deadline',
      'flexible'
    )
  );

alter table public.pet_tasks
  drop constraint if exists pet_tasks_time_precision_check;

alter table public.pet_tasks
  add constraint pet_tasks_time_precision_check
  check (
    time_precision in (
      'none',
      'date',
      'daypart',
      'exact'
    )
  );

-- 舊資料無法可靠判斷「行程」或「截止」，
-- 所以有日期的一律先保守視為 deadline。
update public.pet_tasks
set
  temporal_kind =
    case
      when due_at is null
        then 'flexible'
      else 'deadline'
    end,
  time_precision =
    case
      when due_at is null
        then 'none'
      when due_has_time
        then 'exact'
      else 'date'
    end;
