-- spoonflower_designs — cache of per-design metadata pulled from
-- Spoonflower. Currently just holds "have we saved the design's image to
-- Storage yet." Phase 2 will extend with scraped tags for the keyword-
-- performance analytics.
--
-- Rows are NOT scoped to a user. A given design_id is public information
-- (the listing page is public, the image URL is public). Two sellers who
-- both happened to buy the same design share the cached row.

create table if not exists public.spoonflower_designs (
  design_id bigint primary key,
  latest_title text,
  image_cached_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.spoonflower_designs enable row level security;

-- Any signed-in user can read (design metadata is public). Writes are
-- server-only via the service_role — the caching route runs on the
-- server and uses the elevated role.
drop policy if exists "auth_can_read_designs" on public.spoonflower_designs;
create policy "auth_can_read_designs" on public.spoonflower_designs
  for select to authenticated
  using (true);

-- Design-images bucket. Public read so <img src> works without an auth
-- roundtrip. Signed-in users can upload — the objects here are cached
-- public thumbnails scraped from Spoonflower's own public CDN, not
-- private data, so any authenticated user contributing to the shared
-- cache is safe.
insert into storage.buckets (id, name, public)
  values ('design-images', 'design-images', true)
  on conflict (id) do update set public = excluded.public;

-- Storage RLS: allow any signed-in user to insert or update objects in
-- the design-images bucket. Anonymous users can still read (bucket is
-- public) but can't write. Delete stays locked (no policy = deny) so
-- users can't wipe each other's cached thumbnails.
drop policy if exists "auth_can_upload_design_images" on storage.objects;
create policy "auth_can_upload_design_images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'design-images');

drop policy if exists "auth_can_update_design_images" on storage.objects;
create policy "auth_can_update_design_images" on storage.objects
  for update to authenticated
  using (bucket_id = 'design-images')
  with check (bucket_id = 'design-images');

-- spoonflower_designs write policy: authenticated users can insert /
-- update rows so the caching route can mark image_cached_at without a
-- service role. Rows are shared across users (no user_id column), which
-- matches how the caching pattern works — first user to save a design
-- benefits everyone.
drop policy if exists "auth_can_write_designs" on public.spoonflower_designs;
create policy "auth_can_write_designs" on public.spoonflower_designs
  for insert to authenticated
  with check (true);

drop policy if exists "auth_can_update_designs" on public.spoonflower_designs;
create policy "auth_can_update_designs" on public.spoonflower_designs
  for update to authenticated
  using (true)
  with check (true);
