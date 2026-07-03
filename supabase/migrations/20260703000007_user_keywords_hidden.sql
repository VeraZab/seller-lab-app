-- Soft-delete flag for user_keywords. Auto-harvesting sold tokens
-- (workspace/page.tsx refreshSoldKeywords) would re-insert any word the
-- user removed if we hard-deleted the row, so we soft-delete instead —
-- the row stays with hidden=true, refreshSoldKeywords skips it, and if
-- the user re-adds the word explicitly via the AddKeywordsBar we
-- un-hide it.

alter table public.user_keywords
  add column if not exists hidden boolean not null default false;

create index if not exists user_keywords_user_hidden_idx
  on public.user_keywords (user_id, hidden);
