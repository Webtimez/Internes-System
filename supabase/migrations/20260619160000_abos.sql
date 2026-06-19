-- Wiederkehrende Rechnungen (Abos). Edge Function generate-invoices + pg_cron (täglich) erzeugen daraus Rechnungen.
create table if not exists public.abos (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid,
  partner text,
  leistung text,
  netto numeric,
  ust_satz numeric,
  zahlungsziel int default 14,
  intervall text default 'Monatlich',   -- Monatlich/Wöchentlich/Vierteljährlich/Jährlich
  naechster_lauf date,
  aktiv boolean not null default true,
  erstellt_von uuid,
  created_at timestamptz not null default now()
);
alter table public.abos enable row level security;
create policy abos_all on public.abos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Angebote nutzen die bestehende rechnungen-Tabelle mit typ = 'Angebot' (keine Schemaänderung nötig).
