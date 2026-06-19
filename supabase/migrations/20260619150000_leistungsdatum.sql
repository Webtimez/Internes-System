-- Leistungsdatum auf Rechnungen (Pflichtangabe) + Basis für Kleinunternehmer-Anzeige.
alter table public.rechnungen add column if not exists leistungsdatum date;
