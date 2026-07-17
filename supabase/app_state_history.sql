-- Wido — app_state version history (recovery safety net)
-- Run this in Supabase → SQL Editor (after schema.sql).
--
-- On every UPDATE of app_state we archive the PREVIOUS state into
-- app_state_history via a trigger. That makes an accidental overwrite (bug,
-- fat-finger import, empty clobber) recoverable from inside the app: the user
-- can browse recent versions and restore one. We keep the newest 50 versions
-- per user so the table stays bounded.

create table if not exists public.app_state_history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  state       jsonb not null,
  replaced_at timestamptz not null default now()
);

create index if not exists app_state_history_user_idx
  on public.app_state_history (user_id, replaced_at desc);

alter table public.app_state_history enable row level security;

-- Users may only READ their own history. There is intentionally no insert/
-- update/delete policy: history is written and pruned solely by the trigger
-- below (SECURITY DEFINER), so it can't be tampered with from the client.
drop policy if exists "app_state_history_select_own" on public.app_state_history;
create policy "app_state_history_select_own"
  on public.app_state_history for select
  using (auth.uid() = user_id);

-- Trigger: archive the OLD state before it's overwritten.
create or replace function public.archive_app_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only archive when the state actually changed AND the previous version had
  -- content worth recovering (skip empty->something churn).
  if OLD.state is distinct from NEW.state
     and OLD.state is not null
     and (jsonb_array_length(coalesce(OLD.state->'tasks', '[]'::jsonb)) > 0
          or jsonb_array_length(coalesce(OLD.state->'clients', '[]'::jsonb)) > 0
          or jsonb_array_length(coalesce(OLD.state->'notes', '[]'::jsonb)) > 0)
  then
    insert into public.app_state_history (user_id, state, replaced_at)
    values (OLD.user_id, OLD.state, now());

    -- Keep only the 50 most recent versions per user.
    delete from public.app_state_history
    where user_id = OLD.user_id
      and id not in (
        select id from public.app_state_history
        where user_id = OLD.user_id
        order by replaced_at desc
        limit 50
      );
  end if;
  return NEW;
end;
$$;

drop trigger if exists app_state_archive on public.app_state;
create trigger app_state_archive
  before update on public.app_state
  for each row execute function public.archive_app_state();

-- Summary list for the in-app history browser: ids + timestamps + counts,
-- without shipping every full state blob. SECURITY DEFINER + explicit
-- auth.uid() filter keeps each user scoped to their own rows.
create or replace function public.list_app_state_history()
returns table (
  id           bigint,
  replaced_at  timestamptz,
  task_count   int,
  client_count int,
  note_count   int
)
language sql
security definer
set search_path = public
as $$
  select h.id,
         h.replaced_at,
         jsonb_array_length(coalesce(h.state->'tasks', '[]'::jsonb)),
         jsonb_array_length(coalesce(h.state->'clients', '[]'::jsonb)),
         jsonb_array_length(coalesce(h.state->'notes', '[]'::jsonb))
  from public.app_state_history h
  where h.user_id = auth.uid()
  order by h.replaced_at desc;
$$;
