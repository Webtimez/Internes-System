-- Trennt die Datei-Ablage beim Kunden in zwei Bereiche.
-- art = 'Rechnung' -> Datei liegt im Bereich "Rechnungen (Ablage)"
-- art = 'Beleg'    -> Datei liegt im Bereich "Belege (Ablage)" (Default)
alter table public.belege add column if not exists art text not null default 'Beleg';
