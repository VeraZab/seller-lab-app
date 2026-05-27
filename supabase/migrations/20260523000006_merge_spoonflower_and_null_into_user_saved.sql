-- Collapse the "Spoonflower" category and null categories into the new
-- "User saved" category. Rationale: both ultimately mean "the user has
-- this in their library, no specific market signal attached." The
-- previous distinction between "Spoonflower" (scraped) and Uncategorized
-- (manually added with no category) wasn't load-bearing.
--
-- Sold / Liked / Trend rows are unchanged.

update public.user_keywords
  set category = 'User saved'
  where category = 'Spoonflower'
     or category is null;
