-- user_keywords — the signed-in user's saved vocabulary.
--
-- Pro feature: users save words from the bucket grid in the extension via the
-- star icon on each pill. Sourced from right-click saves later, but for now
-- the extension is the only writer.
--
-- UNIQUE(user_id, word) makes save-already-saved a no-op via ON CONFLICT, and
-- RLS limits visibility/writes to the row's owner.

create table if not exists public.user_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  word text not null,
  category text,
  source_url text,
  created_at timestamptz not null default now(),
  unique (user_id, word)
);

alter table public.user_keywords enable row level security;

drop policy if exists "users_own_keywords" on public.user_keywords;
create policy "users_own_keywords" on public.user_keywords
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists user_keywords_user_id_idx
  on public.user_keywords (user_id);
