-- Normalize user_keywords.category to lowercase single-word slugs as the
-- canonical DB convention. The UI maps these slugs to display labels via
-- the CategoryDef.label field (e.g. "user" → "User saved").
--
-- Mapping:
--   Sold / sales        → sold
--   Liked / likes       → liked
--   Trend               → trend
--   Spoonflower / system / library → spoonflower
--   User saved / user / uncategorized / NULL → user
--   anything else (defensive) → user

update public.user_keywords
  set category = case
    when lower(category) in ('sold', 'sales') then 'sold'
    when lower(category) in ('liked', 'likes') then 'liked'
    when lower(category) = 'trend' then 'trend'
    when lower(category) in ('spoonflower', 'system', 'library') then 'spoonflower'
    when lower(category) in ('user saved', 'user', 'uncategorized') then 'user'
    when category is null then 'user'
    else 'user'
  end
  where category is null
     or category not in ('sold', 'liked', 'trend', 'spoonflower', 'user');
