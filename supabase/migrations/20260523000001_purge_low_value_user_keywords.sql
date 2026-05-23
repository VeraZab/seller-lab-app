-- Strip low-value generic tags from user_keywords.
--
-- These are the same words the /api/keywords/match endpoint's
-- isLowValueTag() function filters out of AI suggestions — but if any made
-- it into the library (e.g. the "X" remove button didn't propagate, or
-- they were added before the filter existed) they'd still come back as
-- library hits, leaking generic terms into the match response.
--
-- Same set kept in sync with isLowValueTag in
-- app/api/keywords/match/route.ts.

delete from public.user_keywords
where lower(word) in (
  'a', 'an', 'and', 'or', 'the', 'for', 'with', 'of', 'to',
  'in', 'on', 'at', 'by', 'is', 'it',
  'art', 'design', 'pattern', 'patterns',
  'fabric', 'fabrics', 'wallpaper',
  'print', 'prints',
  'color', 'colors', 'colour', 'colours',
  'decor', 'decoration',
  'style', 'styled',
  'home', 'house',
  'nice', 'pretty', 'beautiful'
);
