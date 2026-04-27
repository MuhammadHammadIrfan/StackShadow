-- ============================================================
-- StackShadow — Supabase SQL Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- MANIFESTS
-- ─────────────────────────────────────────────
create table if not exists public.manifests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  repo_url text not null,
  repo_name text not null,
  raw_files jsonb default '{}'::jsonb not null,
  parsed_manifest jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists manifests_user_id_idx on public.manifests(user_id);

alter table public.manifests enable row level security;

create policy "Users manage their own manifests"
  on public.manifests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists manifests_updated_at on public.manifests;
create trigger manifests_updated_at
  before update on public.manifests
  for each row execute procedure public.update_updated_at();

-- ─────────────────────────────────────────────
-- ALERTS
-- ─────────────────────────────────────────────
create table if not exists public.alerts (
  id uuid primary key default uuid_generate_v4(),
  manifest_id uuid not null references public.manifests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent text not null check (agent in ('fuzzer', 'scraper')),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  title text not null,
  description text not null,
  source_url text,
  affected_package text,
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

create index if not exists alerts_user_id_idx on public.alerts(user_id);
create index if not exists alerts_manifest_id_idx on public.alerts(manifest_id);
create index if not exists alerts_severity_idx on public.alerts(severity);

alter table public.alerts enable row level security;

create policy "Users manage their own alerts"
  on public.alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- AGENT RUNS
-- ─────────────────────────────────────────────
create table if not exists public.agent_runs (
  id uuid primary key default uuid_generate_v4(),
  manifest_id uuid not null references public.manifests(id) on delete cascade,
  agent text not null check (agent in ('fuzzer', 'scraper')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz default now() not null,
  completed_at timestamptz,
  error text
);

create index if not exists agent_runs_manifest_id_idx on public.agent_runs(manifest_id);

alter table public.agent_runs enable row level security;

-- Users can read their own agent runs (via manifest join)
create policy "Users can view their agent runs"
  on public.agent_runs for select
  using (
    exists (
      select 1 from public.manifests m
      where m.id = agent_runs.manifest_id
        and m.user_id = auth.uid()
    )
  );

-- Service role (used by agents) can write — no RLS restriction via service key
create policy "Service role can insert agent runs"
  on public.agent_runs for insert
  with check (true);

create policy "Service role can update agent runs"
  on public.agent_runs for update
  using (true);
