-- Bluebuild: token-holder tiers and daily design limits.
--
-- bluebuild_usage        one counter per (day, subject). Subjects look like
--                        "all", "free", "wallet:<address>", "user:<id>", "ip:<hash>".
-- bluebuild_snapshots    $BLUEBUILD held by each wallet at the day's snapshot.
-- bluebuild_snapshot_runs one row per day once a snapshot has been started/finished.

create table if not exists public.bluebuild_usage (
  day date not null,
  subject text not null,
  used integer not null default 0,
  primary key (day, subject)
);

create table if not exists public.bluebuild_snapshots (
  day date not null,
  owner text not null,
  amount numeric not null,
  primary key (day, owner)
);

create table if not exists public.bluebuild_snapshot_runs (
  day date primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  holders integer
);

-- Only the backend (service role) touches these tables.
alter table public.bluebuild_usage enable row level security;
alter table public.bluebuild_snapshots enable row level security;
alter table public.bluebuild_snapshot_runs enable row level security;

grant select, insert, update, delete on public.bluebuild_usage to service_role;
grant select, insert, update, delete on public.bluebuild_snapshots to service_role;
grant select, insert, update, delete on public.bluebuild_snapshot_runs to service_role;

-- Atomically check every limit and, only if all pass, add one to each counter.
-- Returns NULL on success, or the first subject whose limit was reached.
create or replace function public.bluebuild_consume(p_day date, p_subjects text[], p_limits integer[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
  current_used integer;
begin
  if coalesce(array_length(p_subjects, 1), 0) <> coalesce(array_length(p_limits, 1), 0) then
    raise exception 'subjects and limits must have the same length';
  end if;

  for i in 1 .. coalesce(array_length(p_subjects, 1), 0) loop
    insert into bluebuild_usage (day, subject, used)
      values (p_day, p_subjects[i], 0)
      on conflict (day, subject) do nothing;
  end loop;

  for i in 1 .. coalesce(array_length(p_subjects, 1), 0) loop
    select used into current_used
      from bluebuild_usage
      where day = p_day and subject = p_subjects[i]
      for update;
    if current_used >= p_limits[i] then
      return p_subjects[i];
    end if;
  end loop;

  update bluebuild_usage
    set used = used + 1
    where day = p_day and subject = any (p_subjects);
  return null;
end;
$$;

-- Give a design back when the generation itself failed.
create or replace function public.bluebuild_refund(p_day date, p_subjects text[])
returns void
language sql
security definer
set search_path = public
as $$
  update bluebuild_usage
    set used = greatest(used - 1, 0)
    where day = p_day and subject = any (p_subjects);
$$;

revoke all on function public.bluebuild_consume(date, text[], integer[]) from public, anon, authenticated;
revoke all on function public.bluebuild_refund(date, text[]) from public, anon, authenticated;
grant execute on function public.bluebuild_consume(date, text[], integer[]) to service_role;
grant execute on function public.bluebuild_refund(date, text[]) to service_role;
