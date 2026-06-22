-- Ablage-Ordner: Dateien in der Rechnungs-/Belege-Ablage einem Ordner zuordnen.
-- ordner = NULL -> "Ohne Ordner". Die Liste der Ordnernamen wird im Frontend in
-- settings.data.belegOrdner gepflegt (damit auch leere Ordner bestehen bleiben).
alter table public.belege add column if not exists ordner text;
