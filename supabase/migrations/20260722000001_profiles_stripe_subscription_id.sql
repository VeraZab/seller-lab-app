-- Add stripe_subscription_id so the Stripe webhook can update a
-- profile when the subscription's status changes (active → paid,
-- canceled → free). The customer_id was already there; the
-- subscription is the entity whose lifecycle we actually track.

alter table public.profiles
  add column if not exists stripe_subscription_id text;

create index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id);

create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id);
