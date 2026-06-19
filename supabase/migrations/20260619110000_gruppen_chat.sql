-- Gruppen-Chats in den Nachrichten: Gruppen anlegen, benennen, Mitglieder, Gruppen-Nachrichten.
create table if not exists public.gruppen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  erstellt_von uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.gruppen_mitglieder (
  id uuid primary key default gen_random_uuid(),
  gruppe_id uuid not null references public.gruppen(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (gruppe_id, user_id)
);
alter table public.nachrichten add column if not exists gruppe_id uuid references public.gruppen(id) on delete cascade;

-- SECURITY DEFINER Helfer umgehen RLS (verhindert Policy-Rekursion)
create or replace function public.is_group_member(gid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.gruppen_mitglieder m where m.gruppe_id = gid and m.user_id = auth.uid());
$$;
create or replace function public.is_group_creator(gid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.gruppen g where g.id = gid and g.erstellt_von = auth.uid());
$$;

alter table public.gruppen enable row level security;
alter table public.gruppen_mitglieder enable row level security;

create policy gruppen_select on public.gruppen for select
  using (erstellt_von = auth.uid() or public.is_group_member(id));
create policy gruppen_insert on public.gruppen for insert with check (erstellt_von = auth.uid());
create policy gruppen_update on public.gruppen for update
  using (erstellt_von = auth.uid()) with check (erstellt_von = auth.uid());
create policy gruppen_delete on public.gruppen for delete using (erstellt_von = auth.uid());

create policy gm_select on public.gruppen_mitglieder for select
  using (user_id = auth.uid() or public.is_group_member(gruppe_id) or public.is_group_creator(gruppe_id));
create policy gm_insert on public.gruppen_mitglieder for insert
  with check (public.is_group_creator(gruppe_id) or user_id = auth.uid());
create policy gm_delete on public.gruppen_mitglieder for delete
  using (public.is_group_creator(gruppe_id) or user_id = auth.uid());

-- Nachrichten-Select um Gruppen erweitern (Insert/Update bleiben wie bisher)
drop policy if exists nachrichten_select on public.nachrichten;
create policy nachrichten_select on public.nachrichten for select
  using (auth.uid() = von or auth.uid() = an or (gruppe_id is not null and public.is_group_member(gruppe_id)));
