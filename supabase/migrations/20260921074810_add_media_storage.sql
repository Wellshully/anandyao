-- =========================================================
-- An & Yao - Private Media Storage
-- =========================================================


-- =========================================================
-- MEDIA TABLE
-- =========================================================

create table public.media (
  id uuid primary key default gen_random_uuid(),

  space_id uuid not null
    references public.spaces(id)
    on delete cascade,

  uploaded_by uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  storage_path text not null unique,

  file_name text not null,

  mime_type text,

  file_size bigint
    check (
      file_size is null
      or file_size >= 0
    ),

  width integer
    check (
      width is null
      or width > 0
    ),

  height integer
    check (
      height is null
      or height > 0
    ),

  alt_text text,

  created_at timestamptz not null default now()
);


create index media_space_created_idx
on public.media(
  space_id,
  created_at desc
);


-- =========================================================
-- MEDIA RLS
-- =========================================================

alter table public.media
enable row level security;


revoke all
on table public.media
from anon, authenticated;


grant select, insert, delete
on table public.media
to authenticated;


grant update (
  alt_text
)
on table public.media
to authenticated;


create policy "Members can view media"
on public.media
for select
to authenticated
using (
  (select private.is_space_member(space_id))
);


create policy "Members can upload media"
on public.media
for insert
to authenticated
with check (
  (select private.is_space_member(space_id))
  and uploaded_by = (select auth.uid())
);


create policy "Members can update media"
on public.media
for update
to authenticated
using (
  (select private.is_space_member(space_id))
)
with check (
  (select private.is_space_member(space_id))
);


create policy "Members can delete media"
on public.media
for delete
to authenticated
using (
  (select private.is_space_member(space_id))
);


-- =========================================================
-- PRIVATE STORAGE BUCKET
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'media',
  'media',
  false,

  -- 20 MB maximum per uploaded image.
  -- We will compress images well below this in the app.
  20971520,

  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id)
do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- =========================================================
-- STORAGE RLS
--
-- Required file structure:
--
-- <space_id>/<category>/<filename>
--
-- Example:
--
-- abc-123/memories/photo.webp
-- =========================================================


-- READ

create policy "Space members can read media files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'media'
  and
  (
    select private.is_space_member(
      ((storage.foldername(name))[1])::uuid
    )
  )
);


-- UPLOAD

create policy "Space members can upload media files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and
  (
    select private.is_space_member(
      ((storage.foldername(name))[1])::uuid
    )
  )
);


-- UPDATE

create policy "Space members can update media files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'media'
  and
  (
    select private.is_space_member(
      ((storage.foldername(name))[1])::uuid
    )
  )
)
with check (
  bucket_id = 'media'
  and
  (
    select private.is_space_member(
      ((storage.foldername(name))[1])::uuid
    )
  )
);


-- DELETE

create policy "Space members can delete media files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'media'
  and
  (
    select private.is_space_member(
      ((storage.foldername(name))[1])::uuid
    )
  )
);
