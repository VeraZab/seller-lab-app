-- Lowercase every user_keywords.word and merge case-collision pairs that
-- the new normalizeWord() (lowercase + space→hyphen) would otherwise hit
-- the unique constraint on. For each (user_id, lower(word)) group:
--   - keep one canonical row (earliest created_at)
--   - aggregate frequency to the MAX across the group
--   - pick category by priority: trend > sold > liked > spoonflower > user
--     (trend is sacred per the CSV import rule; otherwise prefer the
--     strongest market signal)
--   - pick the first non-null kind
--   - delete the losing rows
-- Then lowercase any remaining non-colliding rows.

do $$
declare
  rec record;
  winner_id uuid;
begin
  for rec in
    select
      user_id,
      lower(word) as lw,
      max(frequency) as max_freq,
      (array_agg(category order by
        case category
          when 'trend' then 1
          when 'sold' then 2
          when 'liked' then 3
          when 'spoonflower' then 4
          when 'user' then 5
          else 6
        end nulls last
      ))[1] as best_cat,
      (array_agg(kind) filter (where kind is not null))[1] as best_kind
    from public.user_keywords
    group by user_id, lower(word)
    having count(*) > 1
  loop
    select id into winner_id
      from public.user_keywords
      where user_id = rec.user_id and lower(word) = rec.lw
      order by created_at asc
      limit 1;

    update public.user_keywords
      set
        word = rec.lw,
        frequency = rec.max_freq,
        category = rec.best_cat,
        kind = rec.best_kind
      where id = winner_id;

    delete from public.user_keywords
      where user_id = rec.user_id
        and lower(word) = rec.lw
        and id <> winner_id;
  end loop;
end$$;

update public.user_keywords
  set word = lower(word)
  where word <> lower(word);
