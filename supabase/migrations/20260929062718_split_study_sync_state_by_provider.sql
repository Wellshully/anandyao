-- ============================================================
-- Study provider sync heartbeat
--
-- Data rows such as study_courses / study_mail_messages should
-- describe data, not whether a provider sync completed.
--
-- Track successful COOL and Mail sync independently.
-- ============================================================

alter table public.study_sync_state
  add column cool_last_synced_at timestamptz,
  add column mail_last_synced_at timestamptz;

-- The legacy state predates the Mail integration and is safest
-- to treat as an old COOL heartbeat.
update public.study_sync_state
set cool_last_synced_at = last_synced_at
where cool_last_synced_at is null;

-- Keep the legacy column temporarily for compatibility, but new
-- code will no longer depend on it.
alter table public.study_sync_state
  alter column last_synced_at drop not null;

comment on column public.study_sync_state.cool_last_synced_at is
  'Last successfully completed NTU COOL synchronization.';

comment on column public.study_sync_state.mail_last_synced_at is
  'Last successfully completed NTU Mail synchronization.';

comment on column public.study_sync_state.last_synced_at is
  'Deprecated legacy synchronization timestamp.';

-- Sync state is written only by trusted server workers.
-- Authenticated users only need to read their own state through RLS.
revoke all privileges
on table public.study_sync_state
from anon, authenticated;

grant select
on table public.study_sync_state
to authenticated;
