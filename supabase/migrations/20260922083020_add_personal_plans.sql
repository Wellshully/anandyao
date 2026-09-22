create table public.personal_plans (
  id uuid primary key default gen_random_uuid(),

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null,

  plan_date date not null,

  start_time time,

  duration_minutes integer not null default 30
    check (
      duration_minutes > 0
      and duration_minutes <= 1440
    ),

  note text,

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index personal_plans_user_date_idx
on public.personal_plans (
  user_id,
  plan_date
);


create index personal_plans_space_date_idx
on public.personal_plans (
  space_id,
  plan_date
);


create trigger personal_plans_set_updated_at
before update on public.personal_plans
for each row
execute function private.set_updated_at();


alter table public.personal_plans
enable row level security;


create policy "users can read own personal plans"
on public.personal_plans
for select
to authenticated
using (
  user_id = auth.uid()
  and private.is_space_member(space_id)
);


create policy "users can create own personal plans"
on public.personal_plans
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.is_space_member(space_id)
);


create policy "users can update own personal plans"
on public.personal_plans
for update
to authenticated
using (
  user_id = auth.uid()
  and private.is_space_member(space_id)
)
with check (
  user_id = auth.uid()
  and private.is_space_member(space_id)
);


create policy "users can delete own personal plans"
on public.personal_plans
for delete
to authenticated
using (
  user_id = auth.uid()
  and private.is_space_member(space_id)
);
