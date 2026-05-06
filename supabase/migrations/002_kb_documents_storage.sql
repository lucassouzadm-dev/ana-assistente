-- Bucket para documentos da base de conhecimento
insert into storage.buckets (id, name, public)
values ('kb-documents', 'kb-documents', false)
on conflict (id) do nothing;

-- Acesso a usuários autenticados
create policy "auth_read_kb_docs"
  on storage.objects for select
  using (bucket_id = 'kb-documents' and auth.role() = 'authenticated');

create policy "auth_upload_kb_docs"
  on storage.objects for insert
  with check (bucket_id = 'kb-documents' and auth.role() = 'authenticated');

create policy "auth_delete_kb_docs"
  on storage.objects for delete
  using (bucket_id = 'kb-documents' and auth.role() = 'authenticated');
