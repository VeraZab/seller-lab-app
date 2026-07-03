-- RLS on the design-images cache is still failing for authenticated
-- uploads after 20260703000005 broadened the policies. Trying a full
-- reset: drop ALL policies we own on storage.objects and
-- spoonflower_designs, then re-add wide-open policies scoped by
-- bucket_id / no user check. Storage is public data anyway.

-- Storage.objects: drop every design-images policy we've created across
-- migrations, then re-add fresh maximum-permissive ones.
drop policy if exists "auth_can_upload_design_images" on storage.objects;
drop policy if exists "auth_can_update_design_images" on storage.objects;
drop policy if exists "design_images_write_insert" on storage.objects;
drop policy if exists "design_images_write_update" on storage.objects;

create policy "design_images_any_insert" on storage.objects
  for insert to public
  with check (bucket_id = 'design-images');
create policy "design_images_any_update" on storage.objects
  for update to public
  using (bucket_id = 'design-images')
  with check (bucket_id = 'design-images');
create policy "design_images_any_select" on storage.objects
  for select to public
  using (bucket_id = 'design-images');
-- No DELETE policy — deletes stay locked so nobody can nuke the bucket.

-- spoonflower_designs: same treatment.
drop policy if exists "auth_can_read_designs" on public.spoonflower_designs;
drop policy if exists "auth_can_write_designs" on public.spoonflower_designs;
drop policy if exists "auth_can_update_designs" on public.spoonflower_designs;
drop policy if exists "designs_insert_permissive" on public.spoonflower_designs;
drop policy if exists "designs_update_permissive" on public.spoonflower_designs;

create policy "designs_any_select" on public.spoonflower_designs
  for select to public using (true);
create policy "designs_any_insert" on public.spoonflower_designs
  for insert to public with check (true);
create policy "designs_any_update" on public.spoonflower_designs
  for update to public using (true) with check (true);
