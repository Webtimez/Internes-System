-- Datei-/Medien-Anhänge in Chats und Gruppen.
-- anhang: Datei als Data-URL (base64), anhang_name: Dateiname, anhang_typ: MIME-Typ.
alter table public.nachrichten
  add column if not exists anhang text,
  add column if not exists anhang_name text,
  add column if not exists anhang_typ text;
