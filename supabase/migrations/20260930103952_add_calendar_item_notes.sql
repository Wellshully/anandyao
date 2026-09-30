create table public.calendar_item_notes (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  source_type text not null
    check (
      source_type in (
        'google',
        'study',
        'date',
        'pet_task'
      )
    ),

  /*
   * text intentionally:
   *
   * Internal sources use UUIDs,
   * while Google event IDs are strings.
   */
  source_id text not null,

  note text not null default '',

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    user_id,
    source_type,
    source_id
  )
);


create index calendar_item_notes_user_source_idx
on public.calendar_item_notes (
  user_id,
  source_type,
  source_id
);


alter table public.calendar_item_notes
enable row level security;


create policy "users can read own calendar notes"
on public.calendar_item_notes
for select
to authenticated
using (
  auth.uid() = user_id
);


create policy "users can insert own calendar notes"
on public.calendar_item_notes
for insert
to authenticated
with check (
  auth.uid() = user_id
);


create policy "users can update own calendar notes"
on public.calendar_item_notes
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);


create policy "users can delete own calendar notes"
on public.calendar_item_notes
for delete
to authenticated
using (
  auth.uid() = user_id
);
