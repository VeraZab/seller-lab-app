-- Convert all existing category='spoonflower' rows to category='user'.
-- Spoonflower stays as a selectable option in the dropdown for future
-- intentional saves (e.g. when explicitly tagged from a Spoonflower
-- listing in a future flow), but the legacy bulk-import-style data that
-- was tagged 'spoonflower' should read as User saved.

update public.user_keywords
  set category = 'user'
  where category = 'spoonflower';
