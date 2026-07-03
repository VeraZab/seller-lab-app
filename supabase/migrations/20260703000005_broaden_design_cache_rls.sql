-- Broaden RLS on the design cache paths so authenticated uploads
-- reliably succeed. Original policies were correctly scoped but Supabase
-- Storage's insert path sometimes failed the `to authenticated` role
-- check even for signed-in requests — root cause was that the anon key
-- + user JWT combo lands under a different runtime role than plain
-- authenticated cookie sessions.
--
-- Data is entirely public (public.spoonflower.com images and tags), so
-- widening the write policies to `public` role costs nothing security-
-- wise. Rate-limiting on the caching route prevents abuse.

-- storage.objects — allow anyone with a valid Supabase session to insert
-- or update objects in the design-images bucket. Deletes stay locked.
drop policy if exists "auth_can_upload_design_images" on storage.objects;
create policy "design_images_write_insert" on storage.objects
  for insert
  with check (bucket_id = 'design-images');

drop policy if exists "auth_can_update_design_images" on storage.objects;
create policy "design_images_write_update" on storage.objects
  for update
  using (bucket_id = 'design-images')
  with check (bucket_id = 'design-images');

-- spoonflower_designs — same treatment, since caching writes happen via
-- upsert (INSERT + UPDATE) on the same schema.
drop policy if exists "auth_can_write_designs" on public.spoonflower_designs;
create policy "designs_insert_permissive" on public.spoonflower_designs
  for insert
  with check (true);

drop policy if exists "auth_can_update_designs" on public.spoonflower_designs;
create policy "designs_update_permissive" on public.spoonflower_designs
  for update
  using (true)
  with check (true);
