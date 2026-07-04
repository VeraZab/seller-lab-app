-- Fix duplicate rows in sales_events for events where the composite
-- unique key contains NULL columns.
--
-- Root cause: Postgres treats NULL as distinct in unique constraints by
-- default (i.e. two rows with NULL in the same column don't collide).
-- Our composite key is
--   (user_id, sold_at, design_id, customer, amount, size, balance)
-- and debit/adjustment/payout events almost always have
-- design_id=NULL AND customer=NULL. So each CSV re-upload happily
-- inserted them again — a user with 4 debit rows in their CSV ended up
-- with 12 in the DB after 3 uploads.
--
-- Fix: (1) prune the existing dupes, (2) rebuild the unique constraint
-- with NULLS NOT DISTINCT (Postgres 15+ semantics) so identical NULL
-- rows collide during upsert.
--
-- Regression guard: sales rows (where design_id and customer are
-- populated) were already deduping correctly and stay unaffected.

-- Step 1: delete duplicates, keeping the earliest inserted row per
-- cluster. GROUP BY treats NULLs as equal, so this correctly collapses
-- the debit/adjustment duplicates that slipped past the old constraint.
delete from public.sales_events se
where se.id not in (
  select min(id)
  from public.sales_events
  group by user_id, sold_at, design_id, customer, amount, size, balance
);

-- Step 2: drop the old NULLS DISTINCT constraint.
alter table public.sales_events
  drop constraint if exists sales_events_unique_event;

-- Step 3: recreate with NULLS NOT DISTINCT so NULL == NULL for dedup.
alter table public.sales_events
  add constraint sales_events_unique_event
  unique nulls not distinct
  (user_id, sold_at, design_id, customer, amount, size, balance);
