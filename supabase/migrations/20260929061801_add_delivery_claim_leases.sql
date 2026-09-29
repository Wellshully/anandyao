-- ============================================================
-- Delivery claim leases
--
-- A delivery row must distinguish:
--
--   processing
--     A worker currently owns a temporary lease.
--
--   delivered
--     Push delivery succeeded and the notification is terminal.
--
-- A processing claim can be reclaimed after its lease expires.
-- claim_token prevents an old worker from completing or deleting
-- a claim that has already been reclaimed by another worker.
-- ============================================================


-- ============================================================
-- notification_deliveries
-- ============================================================

alter table public.notification_deliveries
  add column status text not null default 'delivered',
  add column claimed_at timestamptz,
  add column claim_token uuid;

alter table public.notification_deliveries
  alter column sent_at drop not null;

update public.notification_deliveries
set
  status = 'delivered',
  claim_token = null
where true;

alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (
    status in ('processing', 'delivered')
  );

alter table public.notification_deliveries
  add constraint notification_deliveries_state_check
  check (
    (
      status = 'processing'
      and claimed_at is not null
      and claim_token is not null
      and sent_at is null
    )
    or
    (
      status = 'delivered'
      and claim_token is null
      and sent_at is not null
    )
  );


-- ============================================================
-- pet_report_deliveries
-- ============================================================

alter table public.pet_report_deliveries
  add column status text not null default 'delivered',
  add column claimed_at timestamptz,
  add column claim_token uuid;

alter table public.pet_report_deliveries
  alter column sent_at drop not null;

update public.pet_report_deliveries
set
  status = 'delivered',
  claim_token = null
where true;

alter table public.pet_report_deliveries
  add constraint pet_report_deliveries_status_check
  check (
    status in ('processing', 'delivered')
  );

alter table public.pet_report_deliveries
  add constraint pet_report_deliveries_state_check
  check (
    (
      status = 'processing'
      and claimed_at is not null
      and claim_token is not null
      and sent_at is null
    )
    or
    (
      status = 'delivered'
      and claim_token is null
      and sent_at is not null
    )
  );


-- ============================================================
-- Notification delivery lease RPC
-- ============================================================

create or replace function public.claim_notification_delivery(
  p_user_id uuid,
  p_notification_key text,
  p_notification_type text,
  p_source_id text,
  p_lease_seconds integer default 600
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
    raise exception 'Invalid delivery lease duration.';
  end if;

  insert into public.notification_deliveries (
    user_id,
    notification_key,
    notification_type,
    source_id,
    status,
    claimed_at,
    claim_token,
    sent_at
  )
  values (
    p_user_id,
    p_notification_key,
    p_notification_type,
    p_source_id,
    'processing',
    now(),
    v_token,
    null
  )
  on conflict (user_id, notification_key)
  do update
  set
    notification_type =
      excluded.notification_type,

    source_id =
      excluded.source_id,

    status =
      'processing',

    claimed_at =
      excluded.claimed_at,

    claim_token =
      excluded.claim_token,

    sent_at =
      null
  where
    public.notification_deliveries.status = 'processing'
    and
    public.notification_deliveries.claimed_at
      < now()
        - (
          p_lease_seconds
          * interval '1 second'
        )
  returning claim_token
  into v_result;

  return v_result;
end;
$$;


create or replace function public.complete_notification_delivery(
  p_user_id uuid,
  p_notification_key text,
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
  update public.notification_deliveries
  set
    status = 'delivered',
    sent_at = now(),
    claim_token = null
  where
    user_id = p_user_id
    and notification_key = p_notification_key
    and status = 'processing'
    and claim_token = p_claim_token
  returning true
  into v_completed;

  return coalesce(v_completed, false);
end;
$$;


create or replace function public.release_notification_delivery_claim(
  p_user_id uuid,
  p_notification_key text,
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
  delete from public.notification_deliveries
  where
    user_id = p_user_id
    and notification_key = p_notification_key
    and status = 'processing'
    and claim_token = p_claim_token
  returning true
  into v_released;

  return coalesce(v_released, false);
end;
$$;


-- ============================================================
-- Daily Report delivery lease RPC
-- ============================================================

create or replace function public.claim_pet_report_delivery(
  p_user_id uuid,
  p_report_date date,
  p_lease_seconds integer default 600
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
    raise exception 'Invalid delivery lease duration.';
  end if;

  insert into public.pet_report_deliveries (
    user_id,
    report_date,
    status,
    claimed_at,
    claim_token,
    sent_at
  )
  values (
    p_user_id,
    p_report_date,
    'processing',
    now(),
    v_token,
    null
  )
  on conflict (user_id, report_date)
  do update
  set
    status =
      'processing',

    claimed_at =
      excluded.claimed_at,

    claim_token =
      excluded.claim_token,

    sent_at =
      null
  where
    public.pet_report_deliveries.status = 'processing'
    and
    public.pet_report_deliveries.claimed_at
      < now()
        - (
          p_lease_seconds
          * interval '1 second'
        )
  returning claim_token
  into v_result;

  return v_result;
end;
$$;


create or replace function public.complete_pet_report_delivery(
  p_user_id uuid,
  p_report_date date,
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
  update public.pet_report_deliveries
  set
    status = 'delivered',
    sent_at = now(),
    claim_token = null
  where
    user_id = p_user_id
    and report_date = p_report_date
    and status = 'processing'
    and claim_token = p_claim_token
  returning true
  into v_completed;

  return coalesce(v_completed, false);
end;
$$;


create or replace function public.release_pet_report_delivery_claim(
  p_user_id uuid,
  p_report_date date,
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
  delete from public.pet_report_deliveries
  where
    user_id = p_user_id
    and report_date = p_report_date
    and status = 'processing'
    and claim_token = p_claim_token
  returning true
  into v_released;

  return coalesce(v_released, false);
end;
$$;


-- ============================================================
-- RPC permissions
--
-- These functions are worker infrastructure.
-- Browser users must not be able to claim / complete deliveries.
-- ============================================================

revoke execute on function
  public.claim_notification_delivery(
    uuid,
    text,
    text,
    text,
    integer
  )
from public, anon, authenticated;

revoke execute on function
  public.complete_notification_delivery(
    uuid,
    text,
    uuid
  )
from public, anon, authenticated;

revoke execute on function
  public.release_notification_delivery_claim(
    uuid,
    text,
    uuid
  )
from public, anon, authenticated;

revoke execute on function
  public.claim_pet_report_delivery(
    uuid,
    date,
    integer
  )
from public, anon, authenticated;

revoke execute on function
  public.complete_pet_report_delivery(
    uuid,
    date,
    uuid
  )
from public, anon, authenticated;

revoke execute on function
  public.release_pet_report_delivery_claim(
    uuid,
    date,
    uuid
  )
from public, anon, authenticated;


grant execute on function
  public.claim_notification_delivery(
    uuid,
    text,
    text,
    text,
    integer
  )
to service_role;

grant execute on function
  public.complete_notification_delivery(
    uuid,
    text,
    uuid
  )
to service_role;

grant execute on function
  public.release_notification_delivery_claim(
    uuid,
    text,
    uuid
  )
to service_role;

grant execute on function
  public.claim_pet_report_delivery(
    uuid,
    date,
    integer
  )
to service_role;

grant execute on function
  public.complete_pet_report_delivery(
    uuid,
    date,
    uuid
  )
to service_role;

grant execute on function
  public.release_pet_report_delivery_claim(
    uuid,
    date,
    uuid
  )
to service_role;
