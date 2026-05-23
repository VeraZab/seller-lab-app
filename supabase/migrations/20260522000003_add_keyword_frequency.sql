-- Frequency signal for the Sales and Liked heatmap categories.
--
-- The extension scrapes Spoonflower listings and records how many times a
-- word appears as a tag on a most-sold or most-liked listing. Higher
-- frequency = darker chip shade in the Keyword Library heatmap.
-- For Trend / Spoonflower / Uncategorized this column is unused (defaults
-- to 1).

alter table public.user_keywords
  add column if not exists frequency int not null default 1;
