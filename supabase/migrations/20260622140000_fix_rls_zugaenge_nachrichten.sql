-- Welle 5: RLS-/Daten-Reparatur (bereits live angewendet, hier fuer das Repo).
-- Behebt zwei Fehler:
--   1) "Zugang hinzufuegen" -> "new row violates row-level security policy for
--      table zugaenge"; vorhandene Logins waren unsichtbar. Ursache: RLS aktiv,
--      aber GAR KEINE Policy auf zugaenge. Die Daten waren nie geloescht.
--   2) Nachrichten-Benachrichtigungen verschwanden nie. Ursache waren
--      Notiz-an-sich-selbst-Nachrichten (von = an, z. B. der Tagesueberblick),
--      die als ungelesen gezaehlt, aber nie "geoeffnet" wurden.
-- Idempotent (mehrfach ausfuehrbar).

-- 1) ZUGAENGE: saubere Policy fuer eingeloggte Nutzer setzen.
alter table public.zugaenge enable row level security;
drop policy if exists auth_all    on public.zugaenge;
drop policy if exists zugaenge_all on public.zugaenge;
drop policy if exists admin_all    on public.zugaenge;
create policy zugaenge_all on public.zugaenge for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 2) NACHRICHTEN: bestehende Selbst-Notizen als gelesen markieren.
--    (Das Frontend setzt neue Selbst-Notizen jetzt direkt auf gelesen=true und
--     zaehlt von=an ohnehin nicht mehr als ungelesen.)
update public.nachrichten set gelesen = true where von = an and gelesen = false;
