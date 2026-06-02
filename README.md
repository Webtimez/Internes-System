# Webtimez · Internes System (Web-App)

Interne Verwaltungs-App: CRM, Finanzen (Forderungen & Verbindlichkeiten), Anbieter,
Personal, Kalender und To-Do. Frontend in `index.html`, Backend über Supabase (PostgreSQL).

## Struktur
- `index.html` — die App (Frontend)
- `supabase/migrations/` — Datenbank-Schema (wird von der Supabase-GitHub-Integration angewendet)
- `supabase/config.toml` — Projektkonfiguration (project_id eintragen)

## Backend / Supabase
Die App spricht Supabase über den öffentlichen `publishable`/`anon`-Key an (darf im Frontend stehen).
Der geheime `service_role`-Key gehört **niemals** ins Repo oder Frontend.

## Datenschutz
Dieses Repo enthält **nur den App-Code** – keine vertraulichen internen Dokumente
(Personalakten, Rechnungs-PDFs etc.). Die liegen außerhalb des Repos.
