-- Execute this script once in the Supabase SQL Editor.
-- It stores one selected Gmail instance per authenticated user and company.

create table if not exists public.gmail_active_instances (
  company_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_instance_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists gmail_active_instances_instance_idx
  on public.gmail_active_instances (gmail_instance_id);

alter table public.gmail_active_instances enable row level security;

drop policy if exists "Users can read their active Gmail instance" on public.gmail_active_instances;
create policy "Users can read their active Gmail instance"
  on public.gmail_active_instances
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their active Gmail instance" on public.gmail_active_instances;
create policy "Users can insert their active Gmail instance"
  on public.gmail_active_instances
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update their active Gmail instance" on public.gmail_active_instances;
create policy "Users can update their active Gmail instance"
  on public.gmail_active_instances
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their active Gmail instance" on public.gmail_active_instances;
create policy "Users can delete their active Gmail instance"
  on public.gmail_active_instances
  for delete
  using (user_id = auth.uid());
