create table public.google_calendar_connections (
  user_id uuid primary key
    references public.profiles(id)
    on delete cascade,

  /*
   * Never expose this token to browser code.
   */
  refresh_token text not null,

  scope text not null,

  primary_calendar_id text,

  primary_calendar_summary text,

  connected_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


alter table public.google_calendar_connections
enable row level security;


/*
 * Browser-side Supabase clients must never
 * be allowed to read OAuth refresh tokens.
 */
revoke all
on table public.google_calendar_connections
from anon;

revoke all
on table public.google_calendar_connections
from authenticated;


/*
 * Only our server-side service-role client
 * accesses this table.
 */
grant select, insert, update, delete
on table public.google_calendar_connections
to service_role;
