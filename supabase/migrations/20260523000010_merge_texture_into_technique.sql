-- Merge the "Texture" kind into "Technique". The Texture/Technique
-- distinction (made-with vs feels-like) was finer than necessary for the
-- workspace's bucket grid — both signals fit comfortably under Technique.

update public.user_keywords
  set kind = 'Technique'
  where kind = 'Texture';
