-- Rechnungs-Ablage unterteilen in 'gestellt' (Ausgang, von uns gestellt)
-- und 'bekommen' (Eingang, von Dienstleistern/Lieferanten erhalten).
-- Nur relevant für art='Rechnung'. NULL wird in der Ansicht wie 'bekommen' behandelt.
alter table public.belege add column if not exists richtung text;
