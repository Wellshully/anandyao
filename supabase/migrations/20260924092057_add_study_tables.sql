create table public.study_courses (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  cool_course_id bigint not null,

  name text not null,

  course_code text,

  synced_at timestamptz not null,

  created_at timestamptz not null
    default now(),

  unique (
    user_id,
    cool_course_id
  )
);


create table public.study_assignments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  cool_assignment_id bigint not null,

  cool_course_id bigint not null,

  course_name text not null,

  title text not null,

  due_at timestamptz,

  submitted boolean not null
    default false,

  submission_state text,

  submitted_at timestamptz,

  late boolean not null
    default false,

  missing boolean not null
    default false,

  html_url text not null,

  synced_at timestamptz not null,

  created_at timestamptz not null
    default now(),

  unique (
    user_id,
    cool_assignment_id
  )
);


create table public.study_announcements (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  cool_announcement_id bigint not null,

  cool_course_id bigint,

  course_name text,

  title text not null,

  posted_at timestamptz,

  read_state text not null
    check (
      read_state in (
        'read',
        'unread'
      )
    ),

  html_url text not null,

  synced_at timestamptz not null,

  created_at timestamptz not null
    default now(),

  unique (
    user_id,
    cool_announcement_id
  )
);


create table public.study_sync_state (
  user_id uuid primary key
    references public.profiles(id)
    on delete cascade,

  last_synced_at timestamptz not null
);


create index study_assignments_user_due_idx
on public.study_assignments(
  user_id,
  due_at
);


create index study_announcements_user_read_idx
on public.study_announcements(
  user_id,
  read_state
);


alter table public.study_courses
enable row level security;

alter table public.study_assignments
enable row level security;

alter table public.study_announcements
enable row level security;

alter table public.study_sync_state
enable row level security;


/*
 * Study data is private to each user.
 */

create policy "study courses own data"
on public.study_courses
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


create policy "study assignments own data"
on public.study_assignments
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


create policy "study announcements own data"
on public.study_announcements
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


create policy "study sync state own data"
on public.study_sync_state
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);
