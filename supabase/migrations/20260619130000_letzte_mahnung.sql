-- E-Mail-Versand & automatisches Mahnwesen.
-- letzte_mahnung speichert das Datum der letzten Zahlungserinnerung,
-- damit nicht öfter als alle 7 Tage erinnert wird.
alter table public.rechnungen add column if not exists letzte_mahnung date;

-- Der tägliche Mahn-Job (pg_cron -> Edge Function daily-reminders) wird einmalig
-- über das Supabase-Dashboard/MCP eingerichtet und ist nicht Teil dieser Migration,
-- um doppelte Job-Anlage zu vermeiden.
