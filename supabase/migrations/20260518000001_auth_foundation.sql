-- Build 1a — Auth foundation
--
-- Minimum schema to support magic-link sign-in:
--   1. profiles table (one row per user, joined to auth.users by id)
--   2. RLS so users can only see their own row
--   3. trigger so a profiles row is auto-created on signup
--
-- See docs/paid-product-plan.md for the broader schema (Build 1b adds the rest).

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users_see_own_profile" on public.profiles;
create policy "users_see_own_profile" on public.profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
