-- termine hatte RLS aktiv, aber keine Policy -> Kalender-Termine waren unsichtbar
-- (gleicher Fehler wie zuvor bei zugaenge). Wiederherstellung identisch zu den
-- Schwester-Tabellen kunden/aufgaben/termin_teilnahme (auth_all). Idempotent.
alter table public.termine enable row level security;
drop policy if exists auth_all on public.termine;
create policy auth_all on public.termine for all using (true) with check (true);
