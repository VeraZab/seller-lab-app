-- Extend spoonflower_designs so the scrape pass can save the tag phrases
-- and the source image URL alongside the image_cached_at flag.
--
--   tags — array of raw tag phrases as they appear on the listing page,
--          e.g. ["abstract colorful", "accent-wall playroom"]. Stored
--          verbatim; tokenization (space-split, hyphens-together) happens
--          at query time so we don't need to re-scrape when the rule
--          changes.
--   image_source_url — the actual img.spoonflower.com URL we found in
--                      the HTML, kept for debugging and eventual re-fetch.
--   scraped_at — last time we hit the listing page for this design.
--                Distinct from image_cached_at so we can rescrape tags
--                without re-uploading the image (or vice versa).

alter table public.spoonflower_designs
  add column if not exists tags text[],
  add column if not exists image_source_url text,
  add column if not exists scraped_at timestamptz;

create index if not exists spoonflower_designs_tags_gin
  on public.spoonflower_designs using gin (tags);
