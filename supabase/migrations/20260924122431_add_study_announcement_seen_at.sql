alter table public.study_announcements
add column seen_at timestamptz;

create index study_announcements_unseen_idx
on public.study_announcements(
  user_id,
  seen_at,
  posted_at desc
);
