-- =========================================================
-- Journal publishing workflow
-- =========================================================

alter table public.journal_entries
add column status text not null default 'draft'
check (
  status in ('draft', 'published')
);

alter table public.journal_entries
add column published_at timestamptz;


create index journal_space_status_date_idx
on public.journal_entries (
  space_id,
  status,
  entry_date desc
);


-- Allow these columns to be edited.

grant update (
  status,
  published_at
)
on table public.journal_entries
to authenticated;


-- =========================================================
-- Replace journal RLS
--
-- Draft:
-- only its author can see/edit/delete.
--
-- Published:
-- all members of the space can read it.
--
-- Only the author can edit/delete either type.
-- =========================================================

drop policy if exists
"Members can view journal entries"
on public.journal_entries;

drop policy if exists
"Members can create journal entries"
on public.journal_entries;

drop policy if exists
"Members can update journal entries"
on public.journal_entries;

drop policy if exists
"Members can delete journal entries"
on public.journal_entries;


create policy "Members can view published or own journal entries"
on public.journal_entries
for select
to authenticated
using (
  (select private.is_space_member(space_id))
  and
  (
    status = 'published'
    or author_id = (select auth.uid())
  )
);


create policy "Members can create own journal entries"
on public.journal_entries
for insert
to authenticated
with check (
  (select private.is_space_member(space_id))
  and author_id = (select auth.uid())
);


create policy "Authors can update own journal entries"
on public.journal_entries
for update
to authenticated
using (
  (select private.is_space_member(space_id))
  and author_id = (select auth.uid())
)
with check (
  (select private.is_space_member(space_id))
  and author_id = (select auth.uid())
);


create policy "Authors can delete own journal entries"
on public.journal_entries
for delete
to authenticated
using (
  (select private.is_space_member(space_id))
  and author_id = (select auth.uid())
);
