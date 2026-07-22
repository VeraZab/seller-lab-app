-- Variant sets group color / scale variations of the same base design so
-- the seller can view analytics either variant-by-variant or with the
-- variants folded into one row. Purely per-user metadata — the
-- underlying design still lives at Spoonflower.
--
-- Data model:
--   design_variant_sets — one row per named set (per-user).
--   user_design_variant — one row per (user, design_id) with an optional
--     variant_set_id. NULL = the design is not in any set.
--
-- Constraints:
--   - A design belongs to AT MOST one set per user (primary key on
--     user_id + design_id, variant_set_id nullable).
--   - Deleting a set nulls out its members' variant_set_id rather than
--     deleting the membership row, so if the set is recreated the
--     membership row can be reused. (Membership rows exist mostly to
--     record intent — currently just the set link, but future extensions
--     like custom design nicknames per user would live here too.)

create table if not exists public.design_variant_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.design_variant_sets enable row level security;

drop policy if exists "variant_sets_owner" on public.design_variant_sets;
create policy "variant_sets_owner" on public.design_variant_sets
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists design_variant_sets_user_idx
  on public.design_variant_sets (user_id);

create table if not exists public.user_design_variant (
  user_id uuid not null references auth.users on delete cascade,
  design_id bigint not null,
  variant_set_id uuid references public.design_variant_sets on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, design_id)
);

alter table public.user_design_variant enable row level security;

drop policy if exists "user_design_variant_owner" on public.user_design_variant;
create policy "user_design_variant_owner" on public.user_design_variant
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists user_design_variant_set_idx
  on public.user_design_variant (variant_set_id);
