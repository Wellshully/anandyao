-- =========================================================
-- Recover stale background jobs
-- =========================================================
--
-- A worker may crash after claiming a job.
--
-- Without recovery, the job would remain:
--
--   status = running
--
-- forever.
--
-- A stale running job is either:
--
--   1. returned to pending
--   2. moved to dead if attempts are exhausted
--
-- The caller decides what "stale" means by
-- providing p_stale_before.
-- =========================================================

create or replace function public.recover_stale_background_jobs(
  p_stale_before timestamptz,
  p_limit integer default 50
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_stale_before is null then
    raise exception
      'stale cutoff must not be null';
  end if;

  return query

  with stale_jobs as (
    select job.id
    from public.background_jobs as job
    where
      job.status = 'running'
      and job.locked_at is not null
      and job.locked_at < p_stale_before
    order by
      job.locked_at asc
    for update skip locked
    limit least(
      greatest(p_limit, 1),
      50
    )
  ),

  recovered as (
    update public.background_jobs as job
    set
      status =
        case
          when job.attempts >= job.max_attempts
            then 'dead'
          else 'pending'
        end,

      /*
       * Retry immediately.
       *
       * The normal worker retry policy is for
       * observed handler failures.
       *
       * Here the worker disappeared entirely,
       * so we simply make the job available
       * again.
       */
      run_at =
        case
          when job.attempts >= job.max_attempts
            then job.run_at
          else now()
        end,

      locked_at = null,
      locked_by = null,

      started_at =
        case
          when job.attempts >= job.max_attempts
            then job.started_at
          else null
        end,

      finished_at =
        case
          when job.attempts >= job.max_attempts
            then now()
          else null
        end,

      last_error =
        'Worker lease expired before the job completed.',

      updated_at = now()

    from stale_jobs
    where job.id = stale_jobs.id

    returning job.*
  )

  select *
  from recovered;
end;
$$;


revoke all
on function public.recover_stale_background_jobs(
  timestamptz,
  integer
)
from public, anon, authenticated;

grant execute
on function public.recover_stale_background_jobs(
  timestamptz,
  integer
)
to service_role;
