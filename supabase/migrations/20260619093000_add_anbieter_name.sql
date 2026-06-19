-- Erlaubt bei Zugängen einen frei eingetippten Anbieter-Namen,
-- wenn der Anbieter (noch) nicht in der Anbieter-Liste steht.
-- anbieter_id gesetzt  -> Anbieter aus der Liste
-- anbieter_name gesetzt -> frei eingetippter Name (anbieter_id ist dann NULL)
alter table public.zugaenge add column if not exists anbieter_name text;
