-- Fix over-aggressive dedup on sales_events. The previous constraint
-- (user_id, sold_at, design_id, customer, amount, size) collapsed
-- legitimately-separate sales that happened to share every one of those
-- fields (e.g. 9 wallpaper roll orders from guest at $7.40 each on the
-- same day). Adding `balance` to the key makes each row unique — Spoonflower's
-- CSV balance column changes with every event, so two different sales
-- can never share the same balance — while still deduping re-uploads of
-- the same CSV (where balances match).
--
-- Recovery: users whose real sales were collapsed will see the missing
-- rows appear the next time they re-upload their CSV. The upsert with
-- ignoreDuplicates:true means the already-inserted row stays as-is and
-- the previously-collapsed rows land as new inserts.

-- Find and drop the existing 6-column unique constraint by shape, so
-- we're not depending on the auto-generated name being identical
-- across environments.
do $$
declare
  c_name text;
begin
  select con.conname into c_name
  from pg_constraint con
  join pg_class cls on cls.oid = con.conrelid
  where cls.relname = 'sales_events'
    and con.contype = 'u'
    and (
      select array_agg(a.attname::text order by k.ord)
      from unnest(con.conkey) with ordinality k(attnum, ord)
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
    ) = array['user_id','sold_at','design_id','customer','amount','size']::text[];
  if c_name is not null then
    execute format('alter table public.sales_events drop constraint %I', c_name);
  end if;
end $$;

alter table public.sales_events
  add constraint sales_events_unique_event
  unique (user_id, sold_at, design_id, customer, amount, size, balance);
