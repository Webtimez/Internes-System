-- Wiederkehrende Rechnung optional automatisch per E-Mail an den Kunden senden.
-- generate-invoices erzeugt bei auto_email=true zusaetzlich ein PDF und versendet
-- es per SMTP an die im CRM hinterlegte Kunden-E-Mail.
alter table public.abos
  add column if not exists auto_email   boolean not null default false,
  add column if not exists email_betreff text,
  add column if not exists email_text    text,
  add column if not exists email_cc      text;
