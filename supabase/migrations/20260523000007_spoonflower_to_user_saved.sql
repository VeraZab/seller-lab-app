-- Move any rows currently categorized as "Spoonflower" to "User saved".
-- Idempotent — the earlier merge migration (20260523000006) covered the
-- main batch; this catches anything written since (e.g. by the extension
-- before its category mapping caught up).

update public.user_keywords
  set category = 'User saved'
  where category = 'Spoonflower';
