-- Pre-flight check for the sign-in page.
--
-- We want the marketing/sign-in UX to be: enter email -> if you don't have a
-- paid account, tell you immediately ("sorry, buy PRO") instead of sending a
-- magic-link email that wouldn't sign you in anyway.
--
-- supabase-js can't query auth.users directly from the anon role. This function
-- runs as SECURITY DEFINER (privileged) but only returns a boolean -- it
-- doesn't leak any other data about the user. Callable by anon so the /sign-in
-- page can use it before signInWithOtp.
--
-- Note: this is *intentionally* email-enumerable. The whole point is to tell
-- new users they need to pay. Rate-limit at the application layer if abuse
-- becomes a problem.

create or replace function public.email_has_paid_account(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.email = lower(p_email)
      and p.plan = 'paid'
  );
$$;

-- Lock down the function so only intended callers can use it.
revoke all on function public.email_has_paid_account(text) from public;
grant execute on function public.email_has_paid_account(text) to anon, authenticated;
