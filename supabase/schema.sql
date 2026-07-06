-- Task Tracker — Supabase schema (Phase 1: private per user)
-- Run this in Supabase → SQL Editor.
--
-- Design: one row per user holding the whole AppState as JSON. This maps 1:1
-- to the app's existing storage adapter (load = read blob, save = upsert blob),
-- so a single network write per change. Row-Level Security keeps each user's
-- data private. Sharing/workspaces (Phase 2) will migrate this to per-row
-- tables with an owner/workspace column — no client rewrite needed thanks to
-- the storage-adapter layer.

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null default '{"tasks":[],"clients":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Each user can only read/write their own row.
drop policy if exists "app_state_select_own" on public.app_state;
create policy "app_state_select_own"
  on public.app_state for select
  using (auth.uid() = user_id);

drop policy if exists "app_state_insert_own" on public.app_state;
create policy "app_state_insert_own"
  on public.app_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "app_state_update_own" on public.app_state;
create policy "app_state_update_own"
  on public.app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
