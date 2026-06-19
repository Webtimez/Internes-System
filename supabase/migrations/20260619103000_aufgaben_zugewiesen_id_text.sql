-- Aufgaben können jetzt mehreren Personen zugewiesen werden.
-- zugewiesen_id speichert dafür mehrere Profil-IDs kommagetrennt -> Typ text statt uuid.
alter table public.aufgaben alter column zugewiesen_id type text using zugewiesen_id::text;
