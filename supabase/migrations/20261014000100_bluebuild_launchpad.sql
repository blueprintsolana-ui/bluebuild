-- Bluebuild launchpad: people launch a pump.fun coin for their design from
-- their own wallet. Bluebuild takes no fee and never holds keys or funds; it
-- only stores the coin's metadata and records which design a coin belongs to.
--
-- bluebuild_coin_launches  one row per launch attempt. "prepared" rows have
--                          metadata uploaded but no confirmed transaction yet;
--                          "launched" rows are confirmed on-chain.
-- storage bucket coin-metadata  public metadata JSON and logos referenced by
--                          each coin's on-chain URI. Never delete files here:
--                          live coins point at them.

create table if not exists public.bluebuild_coin_launches (
  id uuid primary key,
  project_id text not null,
  owner_user_id text not null,
  creator_wallet text not null,
  mint text not null unique,
  name text not null,
  symbol text not null,
  description text not null default '',
  website text,
  twitter text,
  telegram text,
  image_url text not null,
  metadata_uri text not null,
  initial_buy_sol numeric not null default 0,
  status text not null default 'prepared' check (status in ('prepared', 'launched', 'failed')),
  signature text,
  -- Product page snapshot taken at launch (see apps/api/bluebuild_pitch.py).
  pitch jsonb,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  launched_at timestamptz
);

create index if not exists ix_bluebuild_coin_launches_project
  on public.bluebuild_coin_launches (project_id, status);
create index if not exists ix_bluebuild_coin_launches_status
  on public.bluebuild_coin_launches (status, launched_at desc);
create index if not exists ix_bluebuild_coin_launches_owner_created
  on public.bluebuild_coin_launches (owner_user_id, created_at desc);
-- One live coin per design.
create unique index if not exists ux_bluebuild_coin_launches_one_per_project
  on public.bluebuild_coin_launches (project_id) where status = 'launched';

-- Only the backend (service role) touches this table.
alter table public.bluebuild_coin_launches enable row level security;
revoke all on public.bluebuild_coin_launches from anon, authenticated;
grant select, insert, update, delete on public.bluebuild_coin_launches to service_role;

-- Public read; only the backend's service role writes (no storage policies grant
-- uploads to anyone else). The bucket itself also refuses anything but small
-- PNG/JPEG images and JSON metadata.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coin-metadata', 'coin-metadata', true, 5242880, array['image/png', 'image/jpeg', 'application/json'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
