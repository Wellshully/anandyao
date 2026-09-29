-- ============================================================
-- Per-user NTU COOL synchronization lease
--
-- Prevent app-triggered and background-triggered synchronization
-- from writing overlapping snapshots for the same user.
-- ============================================================

alter table public.study_sync_state
  add column cool_sync_claimed_at timestamptz,
  add column cool_sync_claim_token uuid;

alter table public.study_sync_state
  add constraint study_sync_state_cool_lease_check
  check (
    (
      cool_sync_claimed_at is null
      and cool_sync_claim_token is null
    )
    or
    (
      cool_sync_claimed_at is not null
      and cool_sync_claim_token is not null
    )
  );

comment on column public.study_sync_state.cool_sync_claimed_at is
  'Time at which the current NTU COOL synchronization lease was acquired or renewed.';

comment on column public.study_sync_state.cool_sync_claim_token is
  'Opaque token identifying the worker that currently owns the NTU COOL synchronization lease.';


-- ============================================================
-- Claim
-- ============================================================

create or replace function public.claim_cool_sync_lease(
  p_user_id uuid,
  p_lease_seconds integer default 900
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
  v_result uuid;
begin
  if p_lease_seconds < 60
     or p_lease_seconds > 3600 then
    raise exception 'Invalid COOL sync lease duration.';
  end if;

  insert into public.study_sync_state (
    user_id,
    cool_sync_claimed_at,
    cool_sync_claim_token
  )
  values (
    p_user_id,
    now(),
    v_token
  )
  on conflict (user_id)
  do update
  set
    cool_sync_claimed_at =
      excluded.cool_sync_claimed_at,

    cool_sync_claim_token =
      excluded.cool_sync_claim_token
  where
    public.study_sync_state.cool_sync_claim_token is null
    or
    public.study_sync_state.cool_sync_claimed_at
      < now()
        - (
          p_lease_seconds
          * interval '1 second'
        )
  returning cool_sync_claim_token
  into v_result;

  return v_result;
end;
$$;


-- ============================================================
-- Renew
--
-- Called after all remote COOL requests finish and immediately
-- before the database snapshot is written.
-- ============================================================

create or replace function public.renew_cool_sync_lease(
  p_user_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_renewed boolean := false;
begin
  update public.study_sync_state
  set cool_sync_claimed_at = now()
  where
    user_id = p_user_id
    and cool_sync_claim_token = p_claim_token
  returning true
  into v_renewed;

  return coalesce(v_renewed, false);
end;
$$;


-- ============================================================
-- Complete
--
-- Completing the lease also records the provider heartbeat.
-- This makes "snapshot committed" + "sync became fresh" one
-- token-checked operation.
-- ============================================================

create or replace function public.complete_cool_sync_lease(
  p_user_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_completed boolean := false;
begin
  update public.study_sync_state
  set
    cool_last_synced_at = now(),
    last_synced_at = now(),
    cool_sync_claimed_at = null,
    cool_sync_claim_token = null
  where
    user_id = p_user_id
    and cool_sync_claim_token = p_claim_token
  returning true
  into v_completed;

  return coalesce(v_completed, false);
end;
$$;


-- ============================================================
-- Release after normal failure
-- ============================================================

create or replace function public.release_cool_sync_lease(
  p_user_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_released boolean := false;
begin
  update public.study_sync_state
  set
    cool_sync_claimed_at = null,
    cool_sync_claim_token = null
  where
    user_id = p_user_id
    and cool_sync_claim_token = p_claim_token
  returning true
  into v_released;

  return coalesce(v_released, false);
end;
$$;


-- ============================================================
-- Server worker only
-- ============================================================

revoke execute on function
  public.claim_cool_sync_lease(uuid, integer)
from public, anon, authenticated;

revoke execute on function
  public.renew_cool_sync_lease(uuid, uuid)
from public, anon, authenticated;

revoke execute on function
  public.complete_cool_sync_lease(uuid, uuid)
from public, anon, authenticated;

revoke execute on function
  public.release_cool_sync_lease(uuid, uuid)
from public, anon, authenticated;


grant execute on function
  public.claim_cool_sync_lease(uuid, integer)
to service_role;

grant execute on function
  public.renew_cool_sync_lease(uuid, uuid)
to service_role;

grant execute on function
  public.complete_cool_sync_lease(uuid, uuid)
to service_role;

grant execute on function
  public.release_cool_sync_lease(uuid, uuid)
to service_role;
