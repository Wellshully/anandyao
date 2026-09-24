create or replace function public.get_project_usage()
returns table (
  storage_bytes bigint,
  database_bytes bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.space_members sm
    where sm.user_id = auth.uid()
  ) then
    raise exception 'Not a space member';
  end if;

  return query
  select
    coalesce(
      (
        select sum(
          coalesce(
            nullif(
              o.metadata->>'size',
              ''
            )::bigint,
            0
          )
        )
        from storage.objects o
      ),
      0
    )::bigint,

    pg_catalog.pg_database_size(
      pg_catalog.current_database()
    )::bigint;
end;
$$;


revoke all
on function public.get_project_usage()
from public;

grant execute
on function public.get_project_usage()
to authenticated;
