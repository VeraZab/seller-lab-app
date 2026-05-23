-- Backfill all existing user_keywords with category 'Spoonflower'.
--
-- Pre-extension-categorization, anything saved was effectively scraped from
-- a Spoonflower listing, so tag every existing row that way so the
-- Keyword Library renders with the correct (slate) chip color.
-- Future inserts from the extension should set category explicitly.

update public.user_keywords
  set category = 'Spoonflower';
