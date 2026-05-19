-- Daily spike digest.
--
-- Reads public.email_check_spike (populated by migration 0003 whenever an IP
-- hits the rate limiter) and posts a summary to a webhook once a day. The
-- webhook URL is configured at runtime via a row in public.system_config so
-- this migration doesn't bake any secrets into git.
--
-- How you'll use it after this migration applies:
--   1. Create a Slack/Discord incoming webhook (or any HTTP endpoint that
--      accepts JSON) and copy the URL.
--   2. Run, in the Supabase SQL editor:
--        update public.system_config
--        set value = '<paste-webhook-url>'
--        where key = 'spike_digest_webhook';
--   3. That's it. The cron job runs daily at 16:00 UTC. If no offenders are
--      worth reporting, no message is sent (the function is a no-op then).
--      If the webhook URL is still null/empty, the function exits early --
--      the cron job is harmless while unconfigured.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Simple system config table for runtime settings that don't belong in git.
-- Locked with RLS + no policies: only SECURITY DEFINER functions and admins
-- can read/write. Inspect/update via the SQL editor as the postgres role.
create table if not exists public.system_config (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.system_config enable row level security;

insert into public.system_config (key, value)
values ('spike_digest_webhook', null)
on conflict (key) do nothing;

create or replace function public.send_spike_digest()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_webhook text;
  v_offenders jsonb;
  v_count int;
  v_total_blocks int;
begin
  select value into v_webhook
  from public.system_config
  where key = 'spike_digest_webhook';

  -- Not configured yet -> no-op. The cron job stays scheduled safely.
  if v_webhook is null or v_webhook = '' then
    return;
  end if;

  -- Aggregate the last 24h of spikes. Threshold of 30 means an IP showed up
  -- in at least ~3 distinct minutes of being rate-limited; well past anything
  -- a real user could trigger by accident.
  with offenders as (
    select ip,
           sum(recent_count)::int as total_blocked,
           count(*)::int as minutes_active,
           min(bucket_minute) as first_seen,
           max(bucket_minute) as last_seen
    from public.email_check_spike
    where bucket_minute > now() - interval '24 hours'
    group by ip
    having sum(recent_count) > 30
  )
  select
    coalesce(jsonb_agg(to_jsonb(o) order by o.total_blocked desc), '[]'::jsonb),
    count(*)::int,
    coalesce(sum(o.total_blocked)::int, 0)
  into v_offenders, v_count, v_total_blocks
  from offenders o;

  if v_count = 0 then
    return;
  end if;

  -- Generic JSON payload. Slack incoming webhooks read `text`; most other
  -- destinations just store the whole body. Adjust the shape later if you
  -- need richer Slack Blocks or a different destination.
  perform net.http_post(
    url := v_webhook,
    body := jsonb_build_object(
      'text', format(
        'Seller Lab spike digest (24h): %s IP(s) hit the email_has_paid_account rate limit; %s blocked attempts total.',
        v_count,
        v_total_blocks
      ),
      'offenders', v_offenders
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
end;
$$;

-- Idempotent: cron.schedule by job name will replace the existing entry on
-- re-run, so this migration is safe to apply more than once.
select cron.schedule(
  'spike_digest_daily',
  '0 16 * * *',
  $$select public.send_spike_digest();$$
);
