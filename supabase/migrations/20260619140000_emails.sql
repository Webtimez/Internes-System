-- E-Mail-Postfach: gesendete, geplante und wiederkehrende E-Mails.
-- status: 'gesendet' (Postausgang) | 'geplant' (einmalig zu senden_am) | 'wiederkehrend' (naechster_lauf + wiederholung) | 'fehler'
create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  betreff text,
  text text,
  empfaenger text,            -- komma-getrennt
  status text not null default 'gesendet',
  senden_am timestamptz,      -- für geplant
  wiederholung text,          -- Täglich/Wöchentlich/Monatlich/Jährlich (für wiederkehrend)
  naechster_lauf date,        -- für wiederkehrend
  erstellt_von uuid,
  gesendet_am timestamptz,
  fehler text,
  created_at timestamptz not null default now()
);
alter table public.emails enable row level security;
create policy emails_all on public.emails for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Versand-Engine läuft per Edge Function process-emails + pg_cron (alle 15 Min),
-- einmalig über Dashboard/MCP eingerichtet (nicht Teil dieser Migration).
