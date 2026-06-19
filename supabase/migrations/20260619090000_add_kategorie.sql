-- Markiert absetzbare Belege (z. B. Tankbelege) in der Rechnungstabelle.
-- kategorie = 'Beleg'  -> taucht im Finanzen-Bereich "Absetzbare Belege" auf
-- kategorie = NULL     -> normale Rechnung/Eingangsrechnung
alter table public.rechnungen add column if not exists kategorie text;
