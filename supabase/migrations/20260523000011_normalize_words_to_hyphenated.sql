-- Normalize existing user_keywords.word values so multi-word keywords use
-- hyphens instead of spaces. Mirrors the application-side normalizeWord()
-- helper (trim + collapse any whitespace to a single hyphen).
--
-- Collision-safe two-step:
--   1. Delete space-containing rows when a hyphenated equivalent already
--      exists for the same user — the existing hyphenated row wins so we
--      don't blow up the unique(user_id, word) constraint on update.
--   2. Update remaining spaced rows in place. No collisions left after
--      step 1, so the UPDATE is safe.

-- Step 1: drop space-form duplicates where the canonical form already exists.
delete from public.user_keywords sp
where sp.word ~ '\s'
  and exists (
    select 1 from public.user_keywords h
    where h.user_id = sp.user_id
      and h.word = regexp_replace(trim(sp.word), '\s+', '-', 'g')
      and h.id <> sp.id
  );

-- Step 2: rewrite the rest.
update public.user_keywords
  set word = regexp_replace(trim(word), '\s+', '-', 'g')
  where word ~ '\s';
