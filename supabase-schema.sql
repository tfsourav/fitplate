-- FitPlate — Supabase schema
-- Paste this into your Supabase project: SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).

-- One row per user per day.
create table if not exists public.daily_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  log_date      date not null,
  water_glasses integer not null default 0 check (water_glasses >= 0),
  foods         jsonb not null default '[]'::jsonb,  -- [{ "meal": "breakfast", "name": "Oats" }, ...]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, log_date)
);

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_daily_logs_updated_at on public.daily_logs;
create trigger trg_daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- Row-Level Security: each user can only see/modify their own rows.
alter table public.daily_logs enable row level security;

drop policy if exists "select own logs"  on public.daily_logs;
drop policy if exists "insert own logs"  on public.daily_logs;
drop policy if exists "update own logs"  on public.daily_logs;
drop policy if exists "delete own logs"  on public.daily_logs;

create policy "select own logs" on public.daily_logs
  for select using (auth.uid() = user_id);

create policy "insert own logs" on public.daily_logs
  for insert with check (auth.uid() = user_id);

create policy "update own logs" on public.daily_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own logs" on public.daily_logs
  for delete using (auth.uid() = user_id);
