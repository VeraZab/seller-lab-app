-- system_stopwords — shared blocklist read by both the webapp's
-- /api/keywords/match route and the Chrome extension's normalizeTagBatch.
-- Replaces the previously duplicated hardcoded lists in
--   - seller-lab-app/app/api/keywords/match/route.ts (LOW_VALUE_TAGS)
--   - spoonflower-seller-workspace/src/sidepanel/utils/stopwords.ts (EXCLUDED_WORDS)
-- so the two surfaces can't drift.
--
-- RLS: everyone (anon + authenticated) can SELECT; writes happen only via
-- service role / Supabase dashboard. There is no per-user override here —
-- if/when that's wanted, a separate user_stopwords table can layer on top.

create table if not exists public.system_stopwords (
  word text primary key,
  created_at timestamptz not null default now()
);

alter table public.system_stopwords enable row level security;

drop policy if exists "anyone_can_read_system_stopwords" on public.system_stopwords;
create policy "anyone_can_read_system_stopwords" on public.system_stopwords
  for select
  using (true);

-- Seed with the union of the two existing hardcoded lists.
insert into public.system_stopwords (word) values
  ('a'), ('an'), ('and'), ('or'), ('the'), ('for'), ('with'), ('of'),
  ('to'), ('in'), ('on'), ('at'), ('by'), ('is'), ('it'),
  ('art'), ('design'), ('pattern'), ('patterns'), ('fabric'), ('fabrics'),
  ('wallpaper'), ('print'), ('prints'), ('color'), ('colors'), ('colour'),
  ('colours'), ('decor'), ('decoration'), ('style'), ('styled'),
  ('home'), ('house'), ('nice'), ('pretty'), ('beautiful'),
  ('peel-and-stick'), ('room'), ('project'), ('gift')
on conflict (word) do nothing;
