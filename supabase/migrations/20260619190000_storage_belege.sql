-- Dateien (Belege/Dokumente) in Supabase Storage statt base64 in der DB.
-- Neue Uploads landen im privaten Bucket 'belege'; in belege.data steht dann der Storage-Pfad
-- (alte base64-Einträge beginnen mit 'data:' und funktionieren weiter).
insert into storage.buckets (id, name, public) values ('belege','belege', false)
on conflict (id) do nothing;

create policy "belege_auth_select" on storage.objects for select to authenticated using (bucket_id = 'belege');
create policy "belege_auth_insert" on storage.objects for insert to authenticated with check (bucket_id = 'belege');
create policy "belege_auth_delete" on storage.objects for delete to authenticated using (bucket_id = 'belege');
