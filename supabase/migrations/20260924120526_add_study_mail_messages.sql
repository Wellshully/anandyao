create table public.study_mail_messages (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  uidl text not null,

  subject text not null
    default '(無主旨)',

  from_name text,

  from_address text,

  sent_at timestamptz,

  message_id_header text,

  seen_at timestamptz,

  synced_at timestamptz not null
    default now(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    user_id,
    uidl
  )
);


create index study_mail_messages_user_sent_idx
on public.study_mail_messages(
  user_id,
  sent_at desc
);


create index study_mail_messages_unseen_idx
on public.study_mail_messages(
  user_id,
  seen_at,
  sent_at desc
);


create trigger set_study_mail_messages_updated_at
before update
on public.study_mail_messages
for each row
execute function private.set_updated_at();


alter table public.study_mail_messages
enable row level security;


create policy "study mail select own"
on public.study_mail_messages
for select
to authenticated
using (
  user_id = auth.uid()
);


create policy "study mail insert own"
on public.study_mail_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
);


create policy "study mail update own"
on public.study_mail_messages
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


create policy "study mail delete own"
on public.study_mail_messages
for delete
to authenticated
using (
  user_id = auth.uid()
);
