-- Second pass at purging low-value tags from user_keywords.
-- "and" should have been gone after migration 20260523000001 but is
-- re-appearing in match responses — either re-added or the earlier
-- migration didn't catch a casing variant. "old" / "new" / similar
-- one-word adjectives are too generic to drive search; add them to the
-- cleanup set and to LOW_VALUE_TAGS in route.ts.

delete from public.user_keywords
where lower(word) in (
  'and',
  'old',
  'new',
  'big',
  'small',
  'great',
  'good',
  'bad',
  'best',
  'top',
  'low',
  'high',
  'love',
  'fun'
);
