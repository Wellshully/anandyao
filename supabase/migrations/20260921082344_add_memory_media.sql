-- =========================================================
-- Memory <-> Media
-- =========================================================

create table public.memory_media (
  memory_id uuid not null
    references public.memories(id)
    on delete cascade,

  media_id uuid not null
    references public.media(id)
    on delete cascade,

  sort_order integer not null default 0
    check (sort_order >= 0),

  caption text,

  created_at timestamptz not null default now(),

  primary key (memory_id, media_id)
);


create index memory_media_memory_sort_idx
on public.memory_media (
  memory_id,
  sort_order
);


-- =========================================================
-- RLS helper
-- =========================================================

create or replace function private.can_access_memory_media(
  target_memory_id uuid,
  target_media_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memories m
    join public.media md
      on md.space_id = m.space_id
    where m.id = target_memory_id
      and md.id = target_media_id
      and private.is_space_member(m.space_id)
  );
$$;


revoke all
on function private.can_access_memory_media(uuid, uuid)
from public;


grant execute
on function private.can_access_memory_media(uuid, uuid)
to authenticated;


-- =========================================================
-- RLS
-- =========================================================

alter table public.memory_media
enable row level security;


revoke all
on table public.memory_media
from anon, authenticated;


grant select, insert, delete
on table public.memory_media
to authenticated;


grant update (
  sort_order,
  caption
)
on table public.memory_media
to authenticated;


create policy "Members can view memory media"
on public.memory_media
for select
to authenticated
using (
  private.can_access_memory_media(
    memory_id,
    media_id
  )
);


create policy "Members can attach memory media"
on public.memory_media
for insert
to authenticated
with check (
  private.can_access_memory_media(
    memory_id,
    media_id
  )
);


create policy "Members can update memory media"
on public.memory_media
for update
to authenticated
using (
  private.can_access_memory_media(
    memory_id,
    media_id
  )
)
with check (
  private.can_access_memory_media(
    memory_id,
    media_id
  )
);


create policy "Members can detach memory media"
on public.memory_media
for delete
to authenticated
using (
  private.can_access_memory_media(
    memory_id,
    media_id
  )
);
