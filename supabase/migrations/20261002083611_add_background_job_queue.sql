-- =========================================================
-- Background Job Queue
-- =========================================================
--
-- Generic durable queue for asynchronous application work.
--
-- Lifecycle:
--
-- pending
--   ↓ claim
-- running
--   ↓ success
-- succeeded
--
-- running
--   ↓ failure + attempts remaining
-- pending (with a future run_at)
--
-- running
--   ↓ failure + attempts exhausted
-- dead
-- =========================================================


create table public.background_jobs (
  id uuid primary key
    default gen_random_uuid(),

  job_type text not null,

  payload jsonb not null
    default '{}'::jsonb,

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'running',
        'succeeded',
        'dead',
        'cancelled'
      )
    ),

  /*
   * Higher values run first when multiple
   * jobs are ready at the same time.
   */
  priority smallint not null
    default 0,

  /*
   * A pending job cannot be claimed before
   * this timestamp.
   *
   * Retry backoff will also be implemented
   * by moving run_at into the future.
   */
  run_at timestamptz not null
    default now(),

  attempts integer not null
    default 0
    check (attempts >= 0),

  max_attempts integer not null
    default 5
    check (max_attempts > 0),

  /*
   * Optional producer-provided key.
   *
   * Example:
   *
   * study-sync:2026-10-02T12
   *
   * This prevents the same logical job
   * from being enqueued more than once.
   */
  idempotency_key text,

  locked_at timestamptz,
  locked_by text,

  started_at timestamptz,
  finished_at timestamptz,

  last_error text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


-- ---------------------------------------------------------
-- Queue indexes
-- ---------------------------------------------------------

create unique index
  background_jobs_idempotency_key_idx
on public.background_jobs (
  idempotency_key
)
where idempotency_key is not null;


/*
 * Main worker query:
 *
 * find pending jobs that are ready,
 * ordered by priority and scheduled time.
 */
create index
  background_jobs_claim_idx
on public.background_jobs (
  priority desc,
  run_at asc,
  created_at asc
)
where status = 'pending';


create index
  background_jobs_status_created_idx
on public.background_jobs (
  status,
  created_at desc
);


-- ---------------------------------------------------------
-- Security
-- ---------------------------------------------------------

alter table public.background_jobs
  enable row level security;


/*
 * Jobs are infrastructure state.
 *
 * Normal browser clients should never write
 * directly to this table.
 *
 * Producers and workers will use server-side
 * privileged clients.
 */
revoke all privileges
on table public.background_jobs
from anon, authenticated;


-- =========================================================
-- Atomic Job Claim
-- =========================================================
--
-- Multiple workers may call this concurrently.
--
-- FOR UPDATE SKIP LOCKED guarantees that two
-- workers do not claim the same job.
-- =========================================================

create or replace function public.claim_background_jobs(
  p_worker_id text,
  p_limit integer default 10
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null
     or btrim(p_worker_id) = '' then
    raise exception
      'worker id must not be empty';
  end if;

  return query

  with candidates as (
    select job.id
    from public.background_jobs as job
    where
      job.status = 'pending'
      and job.run_at <= now()
    order by
      job.priority desc,
      job.run_at asc,
      job.created_at asc
    for update skip locked
    limit least(
      greatest(p_limit, 1),
      50
    )
  ),

  claimed as (
    update public.background_jobs as job
    set
      status = 'running',
      attempts = job.attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      started_at = now(),
      updated_at = now()
    from candidates
    where job.id = candidates.id
    returning job.*
  )

  select *
  from claimed;
end;
$$;


/*
 * Only privileged server-side code should be
 * allowed to claim jobs.
 */
revoke all
on function public.claim_background_jobs(
  text,
  integer
)
from public, anon, authenticated;

grant execute
on function public.claim_background_jobs(
  text,
  integer
)
to service_role;
