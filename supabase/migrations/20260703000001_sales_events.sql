-- sales_events — one row per line of a Spoonflower earnings CSV export.
--
-- Composite unique constraint (user_id, sold_at, design_id, customer,
-- amount, size) makes CSV re-uploads idempotent: an event you've already
-- seen is a no-op on `on conflict do nothing`. Two genuinely-separate
-- purchases (same design, same customer, same second, different size or
-- amount) still land as distinct rows.
--
-- `guest` shows up as a customer handle when Spoonflower doesn't record
-- a signed-in buyer. It's kept verbatim and grouped in the UI, not
-- normalized to NULL — we want the ability to count anonymous purchases
-- as a segment rather than losing them.

create table if not exists public.sales_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  sold_at timestamptz not null,
  -- Free-text but normalized on upload to a small enum-ish set:
  -- 'sale' | 'refund' | 'credit' | 'adjustment' | 'payout' | 'other'.
  type text not null,
  qty int not null default 1,
  size text,
  design_title text,
  design_id bigint,
  substrate text,
  customer text,
  -- Positive for income, negative for refunds/adjustments. Stored as
  -- numeric(12,2) so downstream sum() stays exact.
  amount numeric(12,2) not null,
  balance numeric(12,2),
  description text,
  created_at timestamptz not null default now(),
  unique (user_id, sold_at, design_id, customer, amount, size)
);

alter table public.sales_events enable row level security;

drop policy if exists "users_own_sales" on public.sales_events;
create policy "users_own_sales" on public.sales_events
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Access patterns:
--   1. Time-series charts: WHERE user_id=X ORDER BY sold_at
--   2. Top designs: WHERE user_id=X GROUP BY design_id
--   3. Customer leaderboard: WHERE user_id=X GROUP BY customer
create index if not exists sales_events_user_sold_at_idx
  on public.sales_events (user_id, sold_at desc);
create index if not exists sales_events_user_design_idx
  on public.sales_events (user_id, design_id);
create index if not exists sales_events_user_customer_idx
  on public.sales_events (user_id, customer);
