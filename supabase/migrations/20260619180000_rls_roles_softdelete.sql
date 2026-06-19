-- Welle 4: Rollen serverseitig absichern (RLS) + Papierkorb (soft-delete).

-- is_admin(): liest die Rolle des angemeldeten Nutzers (SECURITY DEFINER -> umgeht RLS)
create or replace function public.is_admin() returns boolean
  language sql security definer stable set search_path = public as $$
  select coalesce((select rolle from public.profiles where id = auth.uid()) = 'admin', false);
$$;

-- Finanzen/Personal/Abos/Zeiten/E-Mails nur für Admins
drop policy if exists auth_all on public.rechnungen;
create policy admin_all on public.rechnungen for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists auth_all on public.personal;
create policy admin_all on public.personal for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists abos_all on public.abos;
create policy admin_all on public.abos for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists zeiten_all on public.zeiten;
create policy admin_all on public.zeiten for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists emails_all on public.emails;
create policy admin_all on public.emails for all using (public.is_admin()) with check (public.is_admin());

-- Papierkorb: geloescht-Flag statt echtem Löschen
alter table public.kunden     add column if not exists geloescht boolean not null default false;
alter table public.rechnungen add column if not exists geloescht boolean not null default false;
alter table public.anbieter   add column if not exists geloescht boolean not null default false;
alter table public.personal   add column if not exists geloescht boolean not null default false;
alter table public.aufgaben   add column if not exists geloescht boolean not null default false;
alter table public.termine    add column if not exists geloescht boolean not null default false;
