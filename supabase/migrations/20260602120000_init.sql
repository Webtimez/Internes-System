-- Internes System · Initiales Datenbankschema
-- Erzeugt die Tabellen passend zu den Modulen der App.
-- Hinweis: RLS ist aktiviert, aber bewusst OHNE offene Policies.
-- Die Zugriffsregeln werden im Auth-Schritt ergänzt (sonst ist der
-- öffentliche anon/publishable-Key wirkungslos – gewollt, bis Login steht).

create extension if not exists "pgcrypto";

-- Kunden / CRM
create table if not exists public.kunden (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kontakt text,
  email text,
  telefon text,
  strasse text,
  plz text,
  ort text,
  ustid text,
  zahlungsziel int,
  status text default 'Lead',
  notiz text,
  created_at timestamptz default now()
);

-- Rechnungen (Forderungen + Verbindlichkeiten in einer Tabelle, getrennt über "typ")
create table if not exists public.rechnungen (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('Forderung','Verbindlichkeit')),
  nr text,
  partner text,
  kunde_id uuid references public.kunden(id) on delete set null,
  datum date,
  faellig date,
  leistung text,
  netto numeric(12,2),
  ust_satz numeric(5,2),
  betrag numeric(12,2),
  status text default 'Offen',
  beschreibung text,
  created_at timestamptz default now()
);
create index if not exists idx_rechnungen_typ on public.rechnungen(typ);
create index if not exists idx_rechnungen_faellig on public.rechnungen(faellig);

-- Anbieter (externe Dienste, von denen wir abhängig sind)
create table if not exists public.anbieter (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kategorie text,
  kritikalitaet text,
  zweck text,
  url text,
  konto text,
  kosten numeric(12,2),
  intervall text,
  naechste date,
  kuendigung text,
  email text,
  status text default 'Aktiv',
  notiz text,
  created_at timestamptz default now()
);

-- Personal
create table if not exists public.personal (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rolle text,
  email text,
  art text,
  eintritt date,
  arbeitszeit text,
  resturlaub int,
  notiz text,
  created_at timestamptz default now()
);

-- Aufgaben (To-Do)
create table if not exists public.aufgaben (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  faellig date,
  prio text default 'Mittel',
  done boolean default false,
  created_at timestamptz default now()
);

-- Termine (Kalender)
create table if not exists public.termine (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  datum date,
  typ text default 'Termin',
  created_at timestamptz default now()
);

-- Firmendaten / Rechnungsvorlage (eine Zeile)
create table if not exists public.settings (
  id int primary key default 1,
  data jsonb default '{}'::jsonb,
  constraint settings_single_row check (id = 1)
);

-- RLS aktivieren (Policies folgen mit der Authentifizierung)
alter table public.kunden       enable row level security;
alter table public.rechnungen   enable row level security;
alter table public.anbieter     enable row level security;
alter table public.personal     enable row level security;
alter table public.aufgaben     enable row level security;
alter table public.termine      enable row level security;
alter table public.settings     enable row level security;
