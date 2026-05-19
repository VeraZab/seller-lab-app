-- Rate limit email_has_paid_account.
--
-- The endpoint is intentionally email-enumerable (see migration 0002): we want
-- the sign-in page to tell a new user "you need to buy PRO" instead of sending
-- a magic-link email that wouldn't sign them in. The risk is that an attacker
-- with a candidate list of emails (LinkedIn scrape, breach combo list) uses
-- this endpoint as an oracle to filter "Seller Lab customers" from "anyone."
--
-- Mitigation: cap each IP at 10 calls per minute. A real user checks one email
-- at sign-in; 10/min leaves typo retries comfortable while making mass
-- enumeration impractical (50k candidates would need ~83 hours from one IP).

create table if not exists public.rate_limit_email_check (
  ip text not null,
  called_at timestamptz not null default now()
);

create index if not exists rate_limit_email_check_ip_called_at_idx
  on public.rate_limit_email_check (ip, called_at desc);

-- Lock the table down. The SECURITY DEFINER function below bypasses RLS, so
-- enabling RLS with zero policies means anon/authenticated cannot read or
-- write directly -- only the function can.
alter table public.rate_limit_email_check enable row level security;

-- Spike log: persistent record of every IP that hit the rate limit, bucketed
-- by minute so one bot can't spam the table. Query this to find abuse:
--   select ip, sum(recent_count) from public.email_check_spike
--   where bucket_minute > now() - interval '24 hours'
--   group by ip order by sum desc;
create table if not exists public.email_check_spike (
  ip text not null,
  bucket_minute timestamptz not null,
  recent_count int not null,
  primary key (ip, bucket_minute)
);

create index if not exists email_check_spike_bucket_minute_idx
  on public.email_check_spike (bucket_minute desc);

alter table public.email_check_spike enable row level security;

create or replace function public.email_has_paid_account(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_ip text;
  v_count int;
begin
  -- PostgREST exposes request headers as a JSON GUC. Cloudflare sits in front
  -- of Supabase by default, so cf-connecting-ip is the canonical client IP;
  -- x-forwarded-for is the fallback. Take the first hop if there are commas.
  v_ip := split_part(
    coalesce(
      current_setting('request.headers', true)::json->>'cf-connecting-ip',
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      'unknown'
    ),
    ',',
    1
  );

  select count(*) into v_count
  from public.rate_limit_email_check
  where ip = v_ip
    and called_at > now() - interval '1 minute';

  if v_count >= 10 then
    -- Record the spike for forensics. ON CONFLICT keeps the highest count
    -- seen in this minute, so a single bad IP shows up as one row per minute
    -- with the worst burst recorded, not thousands of duplicate rows.
    insert into public.email_check_spike (ip, bucket_minute, recent_count)
    values (v_ip, date_trunc('minute', now()), v_count)
    on conflict (ip, bucket_minute) do update
      set recent_count = greatest(email_check_spike.recent_count, excluded.recent_count);

    -- PT### codes are PostgREST's mechanism for setting the HTTP response
    -- status from a raised exception; PT429 -> 429 Too Many Requests.
    raise exception 'rate_limit_exceeded' using errcode = 'PT429';
  end if;

  insert into public.rate_limit_email_check (ip) values (v_ip);

  -- Opportunistic cleanup so the table stays tiny without pg_cron. ~1% of
  -- calls sweep rows older than the 1-minute window with plenty of buffer.
  if random() < 0.01 then
    delete from public.rate_limit_email_check
    where called_at < now() - interval '1 hour';
  end if;

  return exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.email = lower(p_email)
      and p.plan = 'paid'
  );
end;
$$;

revoke all on function public.email_has_paid_account(text) from public;
grant execute on function public.email_has_paid_account(text) to anon, authenticated;
