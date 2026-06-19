-- Zeiterfassung pro Kunde/Projekt. Offene Stunden lassen sich in eine Rechnung umwandeln
-- (dann abgerechnet=true und rechnung_id verweist auf die erzeugte Rechnung).
create table if not exists public.zeiten (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid,
  partner text,
  projekt text,
  datum date,
  dauer numeric,            -- Stunden
  stundensatz numeric,
  beschreibung text,
  abgerechnet boolean not null default false,
  rechnung_id uuid,
  erstellt_von uuid,
  created_at timestamptz not null default now()
);
alter table public.zeiten enable row level security;
create policy zeiten_all on public.zeiten for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
