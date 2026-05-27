-- "kind" — what the word is about (Style, Subject, Color, Technique, Layout,
-- Mood, Use). Lives alongside `category` (which tracks where the word came
-- from: Spoonflower scrape / Trend research / Liked / Sold / etc.).
-- Nullable so existing rows can be backfilled lazily by the auto-classifier;
-- the addKeywords action populates it on insert for new words.

alter table public.user_keywords
  add column if not exists kind text;

create index if not exists user_keywords_kind_idx
  on public.user_keywords (kind);
