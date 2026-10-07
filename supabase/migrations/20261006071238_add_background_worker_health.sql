create table public.background_worker_health (
  worker_name text primary key,

  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,

  last_worker_id text,

  last_recovered integer not null default 0,
  last_requeued integer not null default 0,
  last_recovery_dead integer not null default 0,

  last_claimed integer not null default 0,
  last_succeeded integer not null default 0,
  last_retrying integer not null default 0,
  last_dead integer not null default 0,

  last_error text,

  updated_at timestamptz not null default now()
);

alter table public.background_worker_health
  enable row level security;

revoke all
on table public.background_worker_health
from anon, authenticated;

grant select, insert, update
on table public.background_worker_health
to service_role;
