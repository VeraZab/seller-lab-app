-- Third pass cleanup — these words slipped into user libraries (likely
-- via the extension's pull-from-page scrape of Spoonflower listing tags)
-- and are too generic / off-target to drive search. Same intent as the
-- earlier purge migrations.

delete from public.user_keywords
where lower(word) in (
  'and', 'new', 'tea', 'gift', 'hand', 'home', 'peel', 'room', 'vine',
  'wall', 'wrap', 'apron', 'blind', 'cover', 'decor', 'drawn', 'duvet',
  'earth', 'guest', 'roman', 'stick', 'style', 'table', 'throw', 'towel',
  'tones', 'accent', 'creamy', 'dining', 'fabric', 'golden', 'napkin',
  'living', 'pillow', 'powder', 'runner', 'shabby', 'shower', 'window',
  'bedding', 'curtain', 'drapery', 'cushion', 'hostess', 'pattern',
  'valance', 'climbing', 'covering', 'inspired', 'neutrals', 'trailing',
  'aesthetic', 'removable', 'treatment', 'wallpaper', 'tablecloth',
  'housewarming'
);
