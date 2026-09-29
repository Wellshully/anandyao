-- =========================================================
-- Harden application table privileges
-- =========================================================
--
-- RLS protects row-level SELECT / INSERT / UPDATE / DELETE,
-- but privileges such as TRUNCATE are not governed by RLS.
--
-- Application tables should therefore expose only the
-- operations that the browser-side authenticated client
-- actually needs.
-- =========================================================


-- ---------------------------------------------------------
-- Remove automatic broad privileges
-- ---------------------------------------------------------

revoke all privileges
on table public.interaction_settings
from anon, authenticated;

revoke all privileges
on table public.notification_deliveries
from anon, authenticated;

revoke all privileges
on table public.pet_daily_reports
from anon, authenticated;

revoke all privileges
on table public.pet_events
from anon, authenticated;

revoke all privileges
on table public.pet_memories
from anon, authenticated;

revoke all privileges
on table public.pet_report_deliveries
from anon, authenticated;

revoke all privileges
on table public.pet_report_settings
from anon, authenticated;

revoke all privileges
on table public.pet_tasks
from anon, authenticated;

revoke all privileges
on table public.pets
from anon, authenticated;

revoke all privileges
on table public.push_subscriptions
from anon, authenticated;

revoke all privileges
on table public.study_sync_runs
from anon, authenticated;


-- ---------------------------------------------------------
-- Authenticated application access
-- ---------------------------------------------------------

-- Interaction settings:
-- owner can read/create/update their settings.
grant select, insert, update
on table public.interaction_settings
to authenticated;


-- Notification deliveries:
-- written/read internally by server workers only.
-- No direct authenticated table access required.


-- Daily report:
-- users only need to read their generated reports.
grant select
on table public.pet_daily_reports
to authenticated;


-- Pet events:
-- signed-in space members can read and create events.
grant select, insert
on table public.pet_events
to authenticated;


-- Pet memories:
-- current policies support full CRUD for space members.
grant select, insert, update, delete
on table public.pet_memories
to authenticated;


-- Report delivery records:
-- users may inspect their own delivery records.
grant select
on table public.pet_report_deliveries
to authenticated;


-- Report settings:
-- users can read/create/update their own settings.
grant select, insert, update
on table public.pet_report_settings
to authenticated;


-- Pet tasks:
-- users manage their own tasks.
grant select, insert, update, delete
on table public.pet_tasks
to authenticated;


-- Pet:
-- space members use normal CRUD subject to RLS.
grant select, insert, update, delete
on table public.pets
to authenticated;


-- Push subscriptions:
-- users manage their own browser/device subscriptions.
grant select, insert, update, delete
on table public.push_subscriptions
to authenticated;


-- Study sync history:
-- exposed only as read-only history where RLS permits it.
grant select
on table public.study_sync_runs
to authenticated;


-- ---------------------------------------------------------
-- Safer defaults for future public tables
-- ---------------------------------------------------------
--
-- Future migrations should explicitly grant only the
-- operations each table needs.
-- ---------------------------------------------------------

alter default privileges in schema public
revoke all on tables
from anon, authenticated;
