# Paid Product Plan — Phase 1

Planning document for the first paid release: Spoonflower Seller Lab + companion website.

---

## Overview

- **Free extension** (current 1.0.2 functionality) stays as-is — no account required, acquisition channel.
- **Paid features** live behind sign-in and payment. Some surface in the extension (gated UI), some live on the website (configuration + analytics).
- **Pricing model**: single-tier subscription, paid from day 1, "land cheap, raise on traction" — $10/mo with 100 AI calls. Two-tier (Pro at $25/mo) deferred until usage data justifies the split. Grandfathering schema baked in from day 1 via per-subscription Stripe Prices.
- **Initial scale target**: ~20 paying users. Model sustainable to 1000+ without architectural rework.

---

## Architecture

- **Extension** = primary surface. All feature UI lives here: keyword library, AI matching, sales import, analytics, buyers, etc.
- **Website** = minimal — landing/pricing, magic-link auth callback, Stripe return URL, privacy/ToS. ~5 pages total. Exists because magic-link redirects, Stripe `success_url`, and legal pages all need real URLs (can't be `chrome-extension://`). Webapp UI versions of analytics/library/buyers deferred to Phase 2 if/when demand surfaces.
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions).
- **AI**: Google Gemini 2.5 Pro (vision-capable).
- **Payments**: Stripe (Checkout + Customer Portal + Webhooks).
- **Hosting**: Vercel for the website (free tier covers low traffic).

### Tech stack at a glance

| Layer | Choice |
|---|---|
| Extension | Existing React + Vite + MV3 (no change to free path) |
| Database | Supabase Postgres with RLS |
| Auth | Supabase Auth (magic link) |
| File storage | Supabase Storage (private bucket per user) |
| AI proxy | Supabase Edge Function (Deno) calling Gemini |
| Website | Next.js or Vite + React on Vercel |
| Payments | Stripe (subscription product, single Price; per-subscription Price object so future tiering grandfathers existing users) |
| Domain | TBD (drives magic-link `redirectTo` and `externally_connectable` matches) |

---

## Free vs Paid Scope

### Free (unchanged from 1.0.2)

- 13-slot tag editor with drag/drop
- Word soup + character buckets
- Pull existing tags from Spoonflower design pages
- Inline word editing, multi-word paste handling
- Manual word entry
- No account required

### Paid features (Phase 1)

**Library & tag work:**
1. **Right-click "Save to keywords"** — context menu on any site saves selection text directly to backend keyword library. Menu shows "(Pro)" disabled for free users.
2. **Custom keyword library** (managed in extension): user's persistent vocabulary, sourced from right-click saves + manual entry. CRUD UI lives in a Library tab/section in the extension side panel.
3. **Pre-populated starter library** (~100 seeded keywords from Spoonflower's taxonomy, immutable).
4. **AI image-match** — user uploads an image in extension; Gemini vision matches to keywords from their library; results populate buckets.
5. **Generative AI** (optional path) — same image without library context, AI suggests new keywords. Shared cap with image-match.
6. **Color-coded buckets** — hierarchy: sales > likes > library > seeded > AI.
7. **Sales-driven tag pull** — populates buckets with tags from sold designs (hot orange).
8. **Likes-driven tag pull** — populates buckets with tags from liked designs (yellow).

**Sales / catalog:**
9. **Sales CSV import** — user uploads sales CSV (with `design_id` column) via file picker. Available on **both** extension and webapp. Rows stored as `sales_events`.
10. **Sales enrichment (extension-side, Path B)** — when extension is open, it fetches each unique design's Spoonflower page via background `fetch()` using the user's session cookies. *No tab navigation, no flicker.* Scrapes title, description, tags, thumbnail, designer, substrates, color palette. Stores enriched data in `sold_designs` + thumbnail in Storage. Webapp uploads are eventually consistent — enriched on next extension session.
11. **Image storage for sold + liked designs only** — not for AI image-match uploads (those stay pass-through).

**Analytics / buyers:**
12. **Activity pull (likes/follows)** — extension-only: scrapes Spoonflower userhome news feed for activity events. Stored as `activity_events`.
13. **Analytics tab in extension** — port of existing `ActivityTab.tsx` (~895 lines, currently commented out), wired to backend. Shows recent sales + activity overview, scoped to a focused/in-context view.
14. **Buyers tab in extension** — port of existing `BuyersTab.tsx` (~654 lines), wired to backend. Lists buyers with sales/likes counts; manual contact info form (email, phone, notes) per buyer; "View on Spoonflower" link out for research. **No backend or extension scraping of buyer profiles** — manual notes only.
15. **Timeseries chart in Analytics tab** — top 10 designs' sales over time (auto-bucketed daily/weekly/monthly), Recharts line chart with hover tooltips, click-legend-to-toggle.
16. **Competition winners marking** — `won_competitions text[]` on `enriched_designs`, with UI in Analytics/Buyers tabs to add/remove competition names per design.

**Constraints:**
17. **All Spoonflower data refreshes are user-initiated** — no automated background scraping.
18. **Free users see no permission prompts** — paid permissions requested only at sign-in via `optional_permissions`.
19. **All feature UI lives in the extension.** Webapp is intentionally minimal (5 pages). Webapp UI for Library / Analytics / Buyers is deferred to Phase 2 pending real demand.

### Out of Phase 1 (future phases)

- Catalog save UX after "Done" press
- Auto-refresh of sales/likes
- AI-generated 13-slot tag plans (vs flat keyword matches)
- "Use image from current Spoonflower page" one-click flow
- **Webapp UI for Library management** — full CRUD on a wider canvas; useful when users have 500+ keywords
- **Webapp UI for Analytics** — full historical view with filters, time ranges, exports; mobile access
- **Webapp UI for Buyers** — searchable/sortable list, bulk export, mobile access
- **Catalogue tab return** — full browse-and-pick for designs beyond top-10 enrichment
- **Pro tier** ($25/mo) — when usage data justifies tiering

---

## Pricing Model

**Single tier at $10/mo, 100 AI calls/mo cap.**

100 calls × ~$0.009/call = ~$0.85/user/mo worst-case API cost — well under the $2/user budget. Realistic usage (~40 unique designs/mo) means most users won't hit the cap; it functions as a sanity guard against runaway abuse, not as an upsell mechanic.

**Two-tier deferred** — tiering only makes sense when the cap is actually constraining real users and there's a feature worth charging more for. With 100-call generosity, the upgrade pressure is too weak to justify the implementation complexity now. Revisit when usage data justifies the split.

**Annual prepay option**: $100/yr (≈ 2 months free), boosts LTV.

**Grandfathering baked in from day 1**: store price *per subscription* in Stripe (every Subscription points to its own Price object). When prices rise later, existing users keep their original price. Frame as "early adopter pricing — yours is locked in as long as you stay subscribed."

**Hitting cap**: extension shows "You've used your 100 AI matches this month. Resets [date]." For now no upgrade CTA (no Pro tier exists yet); add one when Pro lands.

---

## Color Hierarchy (word source ranking)

Word state moves from `string[]` to `Map<word, Set<source>>`. When a word has multiple sources, **highest tier wins** for visual rendering. Colors map to the design system's tag taxonomy (`design-system/components.css`).

| Tier | Token | Hex | Source | Design system class |
|---|---|---|---|---|
| 1 | `--sage-500` | `#8AAE92` | Sales | `chip--sales` / `dot-sales` |
| 2 | `--blossom-500` | `#D77FA0` | Likes | `chip--liked` / `dot-liked` |
| 3 | `--saffron-500` | `#E0A458` | Starred (user-saved + observed via right-click "Save to keywords") | `chip--starred` / `dot-starred` |
| 4 | `--slate-500` | `#798BA6` | Seeded (Spoonflower starters) + scraped from live Spoonflower pages | `chip--system` / `dot-system` |
| 5 | `--plum-500` | `#8B6FA8` | Trend research (user-driven keyword exploration) | `chip--trend` / `dot-trend` |
| — | (default, no color) | — | AI-generated suggestions | `chip` (neutral) |

AI suggestions render as the default neutral chip — no taxonomy color. They become categorized (and colored) only once the user saves them into a bucket or stars them.

---

## Schema with RLS Policies

All user-private tables: end users see only their own rows (`user_id = auth.uid()`). Admin (service role key) bypasses RLS for support and analytics. `system_keywords` is the only shared table — read-only for everyone, write via service role only.

### `profiles` — one row per user, plan + Stripe linkage

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',  -- 'free' | 'paid'
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_profile" ON profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

### `system_keywords` — shared, read-only starter library

```sql
CREATE TABLE system_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  category text NOT NULL,  -- 'substrate' | 'product_type' | 'style' | 'theme' | 'subject'
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_starters" ON system_keywords
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies → users can't write
-- Updates happen via service role from your admin tooling
```

### `user_keywords` — user's custom additions

```sql
CREATE TABLE user_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  word text NOT NULL,
  category text,
  source_url text,                -- e.g., where right-click-saved from
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, word)
);

ALTER TABLE user_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_keywords" ON user_keywords
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### `ai_calls` — audit log + usage tracking

```sql
CREATE TABLE ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type text NOT NULL,             -- 'image_match' | 'generative'
  cost_estimate_cents int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_ai_calls" ON ai_calls
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX ai_calls_user_month_idx
  ON ai_calls (user_id, date_trunc('month', created_at));
```

### `ai_usage_monthly` — derived view for cap checks

```sql
CREATE VIEW ai_usage_monthly AS
SELECT
  user_id,
  to_char(date_trunc('month', created_at), 'YYYY-MM') AS year_month,
  count(*) AS call_count
FROM ai_calls
GROUP BY user_id, date_trunc('month', created_at);

-- View inherits RLS from underlying ai_calls — no separate policy needed
```

### `enriched_designs` — designs we've scraped via Path B (replaces separate `sold_designs` and `liked_designs`)

A design is enriched whether it got there because of sales, likes, or future opt-in expansion. Whether it ranks as "top sold" or "top liked" is a query-time aggregation against `sales_events` and `activity_events`, not a column on this table.

**Phase 1 enrichment scope: top 10 by sales count + top 10 by like count, deduped.** Most users land at 12-18 enriched designs after overlap. Beyond the initial top-10 sets, users **explicitly request** more via a "Load 10 more" button (separate buttons for sales-rank and likes-rank). Each click expands by 10 and queues more enrichment. Full catalogue browse-and-pick remains a Phase 2 Catalogue tab feature.

```sql
CREATE TABLE enriched_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  spoonflower_id text NOT NULL,
  spoonflower_url text,                       -- from CSV (or constructed from id)
  title text,                                 -- scraped via Path B
  description text,                           -- scraped
  tags text[],                                -- scraped
  designer_name text,                         -- scraped (typically the seller)
  substrates_available text[],                -- scraped
  product_types_available text[],             -- scraped
  color_palette text[],                       -- scraped if visible
  image_path text,                            -- thumbnail in Supabase Storage
  created_on_spoonflower_at timestamptz,      -- scraped
  enrichment_status text NOT NULL DEFAULT 'pending', -- 'pending' | 'enriched' | 'failed'
  enrichment_reason text[],                   -- ['top_sales', 'top_likes', 'manual'] — informational
  last_enriched_at timestamptz,
  won_competitions text[] DEFAULT '{}',       -- user-marked: Spoonflower competition wins (e.g., ['Mid-Century Modern Challenge', 'Geometric Florals'])
  raw_metadata jsonb,                         -- catch-all for fields not yet typed
  UNIQUE(user_id, spoonflower_id)
);

CREATE INDEX enriched_designs_pending_idx
  ON enriched_designs (user_id, enrichment_status)
  WHERE enrichment_status = 'pending';

ALTER TABLE enriched_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_enriched_designs" ON enriched_designs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

The partial index on `(user_id, enrichment_status) WHERE enrichment_status = 'pending'` makes "find designs to enrich" cheap — it's the hot-path query every time the side panel opens.

### Top-N selection query (run after CSV import or activity pull)

```sql
-- Find designs to enqueue for enrichment: top N by sales + top N by likes, union/dedupe
-- Default N=10 (Phase 1). User-triggered "Load 10 more" expands N by 10 each click.
WITH top_sales AS (
  SELECT spoonflower_design_id AS sf_id
  FROM sales_events
  WHERE user_id = auth.uid()
  GROUP BY spoonflower_design_id
  ORDER BY count(*) DESC
  LIMIT 10  -- bumps to 20, 30, ... on each "Load 10 more" click
),
top_likes AS (
  SELECT target_id AS sf_id
  FROM activity_events
  WHERE user_id = auth.uid() AND type = 'like' AND target_type = 'design'
  GROUP BY target_id
  ORDER BY count(*) DESC
  LIMIT 10  -- bumps independently of sales-rank limit
)
INSERT INTO enriched_designs (user_id, spoonflower_id, enrichment_reason)
SELECT auth.uid(), sf_id,
       array_remove(ARRAY[
         CASE WHEN sf_id IN (SELECT sf_id FROM top_sales) THEN 'top_sales' END,
         CASE WHEN sf_id IN (SELECT sf_id FROM top_likes) THEN 'top_likes' END
       ], NULL)
FROM (SELECT sf_id FROM top_sales UNION SELECT sf_id FROM top_likes) u
ON CONFLICT (user_id, spoonflower_id) DO UPDATE
  SET enrichment_reason = enriched_designs.enrichment_reason || EXCLUDED.enrichment_reason;
```

Idempotent — re-running just refreshes the `enrichment_reason` array without duplicating rows. The extension then picks up `enrichment_status='pending'` rows and runs Path B fetches against them.

### `sales_events` — per-sale rows from CSV imports

```sql
CREATE TABLE sales_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source_id text NOT NULL,                    -- unique CSV row id (transaction id, etc.)
  spoonflower_design_id text NOT NULL,        -- joins to sold_designs.spoonflower_id
  sale_date timestamptz NOT NULL,
  amount_cents int,
  product_type text,
  substrate text,
  buyer_username text,
  raw jsonb,                                  -- full original CSV row
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_id)                  -- idempotent re-imports
);

ALTER TABLE sales_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sales_events" ON sales_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX sales_events_user_design_idx ON sales_events (user_id, spoonflower_design_id);
CREATE INDEX sales_events_user_buyer_idx ON sales_events (user_id, buyer_username);
```

### `activity_events` — per-event rows from userhome scraping

```sql
CREATE TABLE activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type text NOT NULL,                         -- 'like' | 'follow' | 'comment' | ...
  target_id text NOT NULL,                    -- design ID, user ID, etc.
  target_type text NOT NULL,                  -- 'design' | 'user' | ...
  occurred_at timestamptz NOT NULL,
  buyer_username text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, type, target_id, occurred_at)
);

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_activity_events" ON activity_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX activity_events_user_type_idx ON activity_events (user_id, type);
CREATE INDEX activity_events_user_buyer_idx ON activity_events (user_id, buyer_username);
```

### `buyers` — per-buyer record with manual contact notes

**Manual contact notes only** — no backend or extension scraping of buyer profiles. Display fields (`display_name`, `profile_image_url`) auto-populate from `activity_events` data the first time a buyer appears; never re-fetched from Spoonflower's profile page. Sales/likes counts come from joining `sales_events` and `activity_events` at query time.

```sql
CREATE TABLE buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  spoonflower_username text NOT NULL,
  display_name text,                          -- from activity feed if available
  profile_image_url text,                     -- from activity feed
  contact_email text,                         -- user-entered
  contact_phone text,                         -- user-entered
  notes text,                                 -- user-entered free-form
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, spoonflower_username)
);

ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_buyers" ON buyers
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### `liked_designs` — *removed*

Collapsed into `enriched_designs` above. A design that's liked enough to enrich gets a row in `enriched_designs` with `'top_likes'` in its `enrichment_reason` array. Per-event like data lives in `activity_events`; rankings come from query-time aggregation.

### Storage bucket — `designs` (private, per-user folders)

Files stored at path `{user_id}/{spoonflower_id}.jpg`. Bucket policy enforces folder-level access:

```sql
-- Create the bucket (via Supabase dashboard or migration)
INSERT INTO storage.buckets (id, name, public)
VALUES ('designs', 'designs', false);

-- RLS on storage.objects
CREATE POLICY "users_own_design_files" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'designs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'designs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

User A can never list, fetch, or write to user B's paths, even if they know the exact path.

### Auto-create `profiles` row on signup

```sql
-- On new auth.users insert, create matching profiles row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Verifying RLS works (run before launch)

As user A:

```sql
-- Should succeed:
INSERT INTO user_keywords (user_id, word) VALUES (auth.uid(), 'foo');

-- Should fail (WITH CHECK blocks foreign user_id):
INSERT INTO user_keywords (user_id, word) VALUES ('user-b-uuid', 'spoof');
```

As user B:

```sql
-- Should return zero rows (user A's 'foo' is invisible):
SELECT * FROM user_keywords;
```

The Supabase dashboard → Authentication → Policies tab shows a red banner for any table with RLS *disabled* — check it after every schema change.

---

## Permission Model

**Free users see no permission prompt on update.** Achieved via Chrome's `optional_permissions` field.

```ts
// manifest.config.ts
{
  permissions: ["sidePanel", "activeTab", "scripting"],         // unchanged from 1.0.2
  optional_permissions: ["contextMenus", "notifications", "storage"],
  externally_connectable: { matches: ["https://yoursite.com/*"] },  // not a permission
  host_permissions: ["https://spoonflower.com/*", "https://*.spoonflower.com/*"]  // unchanged
}
```

**Request only on sign-in**, only if not already granted:

```ts
const required = ["contextMenus", "notifications", "storage"];
const hasAll = await chrome.permissions.contains({ permissions: required });
if (!hasAll) {
  const granted = await chrome.permissions.request({ permissions: required });
  if (!granted) showNotice("Some Pro features need permissions to work.");
}
```

**Once granted, permissions persist forever** — survive browser restarts, extension updates, OS restarts. Only revoked if user manually revokes via `chrome://extensions` or extension is uninstalled.

---

## Spoonflower Interaction Policy

All Spoonflower scraping happens **client-side from the user's browser session** (Path B), never from the backend. This isolates risk to individual users and avoids centralized blocks that would take down the service.

### Rate-limiting rules (non-optional in implementation)

Every page fetch against Spoonflower must respect:

1. **1-2 second delay between fetches** — caps throughput at ~30-60 designs/minute. Looks like human browsing speed.
2. **Per-session enrichment ceiling** — at most 30 designs enriched per side-panel-open. Remaining designs queue for next session, spreading load over days/weeks naturally.
3. **429 backoff** — on HTTP 429 ("Too Many Requests"), pause 15+ minutes before retrying. Don't retry aggressively.
4. **Idempotent skip** — if a design is already enriched (`enrichment_status='enriched'`), skip it. Re-imports never re-fetch.
5. **Natural User-Agent** — use the browser's default UA. Don't spoof or set a custom one.
6. **Honor `robots.txt`** — fetch and respect Spoonflower's directives. Pages disallowed for crawling are not enriched.

### User-facing transparency

Privacy policy / ToS includes a clear line:

> "The extension fetches your design pages on Spoonflower to populate analytics. This uses the same browser traffic your manual visits would generate. We rate-limit to behave like normal browsing, but if Spoonflower ever blocks your account, please contact us."

### Risks mitigated vs. accepted

| Risk | Mitigation |
|---|---|
| Spoonflower flagging the user's account | Rate limits 1-3, natural UA |
| Service-wide block (one IP affects all users) | Path B (per-user IP) instead of Path A (centralized) |
| Repeated re-fetching wasting bandwidth + risk | Idempotent skip (rule 4) |
| Aggregate load on Spoonflower's servers | Top-10 enrichment scope (bounds fetches per user to ~10-20 lifetime; "Load 10 more" requires explicit user action) |
| ToS dispute escalation | Transparency in user-facing policy |

### Cumulative load picture

A typical first-time enrichment is **10-20 fetches over 20-40 seconds**. Across 100 active paying users in a week, total Spoonflower load is ~1,500 fetches spread across 100 residential IPs over 7 days — well below any reasonable abuse threshold. The combination of (Path B + rate limits + top-10 scope + idempotent skip + per-session ceiling) is designed to be *politely below noise* from Spoonflower's perspective.

### Accepted risks (not fully eliminable)

- A user who's already aggressively browsing Spoonflower hitting limits faster on top of enrichment
- Spoonflower changing anti-bot patterns and flagging the extension's traffic despite mitigations
- A determined adversary trying to misuse the extension at scale (would still get rate-limited, but might force one user's account into a hard block)

These are accepted. Path B is a reasonable engineering trade-off, not a zero-risk choice.

---

## Cost Analysis

### Gemini API per call (2.5 Pro vision)

- Image (~1500 input tokens) + system prompt (~200) + library context (~1000) + per-call (~100) + output (~500)
- **Uncached: ~$0.009/call. Cached: ~$0.007/call.**
- Gemini context caching (75% discount on cached input tokens, 1hr default TTL) cuts ~20-30% on the cacheable portion (image is uncacheable and dominates input).
- Pricing tier: ≤200k context window. Stays well within for this use case.

### Per user per month ($10/mo, 100 calls)

| Item | Cost |
|---|---|
| Stripe fee | -$0.59 |
| Gemini API (100 × ~$0.009) | -$0.85 |
| Supabase | $0 on Free tier / -$2.50 amortized at 10 users on Pro |
| Domain amortized | -$0.13 |
| Storage growth | -$0.10-0.30 (bounded) |
| **Net per user (Free tier)** | **~$8.45/mo on $10 revenue (85%)** |
| **Net per user (Pro at 10 users)** | **~$5.95/mo on $10 revenue (60%)** |

### Single-tier model at scale ($10/mo, 100 calls)

| Users | Tier | MRR | API | Stripe | Supabase | Total Costs | Net | Margin |
|---|---|---|---|---|---|---|---|---|
| 10 | Free | $100 | $8.50 | $5.90 | $0 | ~$15 | **~$85** | **85%** |
| 30 | Pro | $300 | $25.50 | $17.70 | $25 | ~$69 | ~$231 | 77% |
| 100 | Pro | $1,000 | $85 | $59 | $25 | ~$170 | ~$830 | 83% |
| 1,000 | Pro | $10,000 | $850 | $590 | $25 | ~$1,470 | ~$8,530 | 85% |

API stays ~8.5% of revenue across all scales. Margin recovers once Supabase Pro flat-fee amortizes (~30 users) and stabilizes at ~83-85%.

### Storage growth

- Sold + liked designs only stored: ~9.2MB/user (~200 images × 46KB)
- AI uploads: pass-through, not stored
- Stays under 100GB Supabase Pro cap until ~5,000-10,000 users
- Cloudflare R2 migration trigger: ~5,000 users (when bandwidth and storage costs become meaningful)

---

## Supabase Tier Strategy

**Start on Free tier** at launch. Save the $25/mo while validating with first users.

**Free tier limits vs realistic launch usage** (10 users):

| Limit | Free tier | Usage at 10 users |
|---|---|---|
| File storage | 1 GB | ~92 MB |
| Database | 500 MB | KBs |
| Egress | 10 GB/mo | ~1 GB |
| MAU | 50,000 | 10 |
| Active projects | 2 | 1 prod (+ optional 1 dev) |

Two orders of magnitude headroom on every dimension at launch scale.

### The auto-pause workaround: daily keep-alive ping

Free projects pause after 7 days of zero activity. Mitigation: a daily cron-triggered ping that hits a Supabase REST endpoint, keeping the project warm.

**Implementation: GitHub Actions cron** (free, ~10 min to set up):

```yaml
# .github/workflows/keepalive.yml
name: Keep Supabase Alive
on:
  schedule:
    - cron: '0 12 * * *'   # noon UTC daily
  workflow_dispatch:        # manual trigger for testing
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -f -X GET "${{ secrets.SUPABASE_URL }}/rest/v1/profiles?limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}"
```

Cost: ~30 KB egress/month (negligible). Reliability: high — daily gives 7× safety margin against any single failure.

**Important**: ping must hit the database (e.g., a `SELECT` against any table), not just the auth health endpoint. Auth-only pings may not count as activity for the database side.

### Pro upgrade trigger: ~5 paying users

Upgrade from Free → Pro when **any** of these is true:

1. **5+ paying users** — at $50+ MRR, the $25 Pro cost is ≤ 50% of revenue and the operational risk of Free becomes harder to justify. Pro upgrade is instant: settings → billing → Upgrade. Same project URL, API keys, schema. Quotas update within minutes.
2. Approaching Free tier limits (storage > 800MB, egress > 8GB/mo)
3. Keep-alive ping starts failing repeatedly
4. You want Pro-only features: daily backups, point-in-time recovery, branching

Until the trigger fires: Free tier saves ~$25/mo × 6-12 months = $150-300, real money for a side project at validation phase.

---

## Pre-Build Setup & Operational Gotchas

Everything to have in place before (or during) Phase 1 development. Checkboxes track what's done.

### Accounts and services

- [x] **Domain registered** — `sellerlab.app`
- [x] **Supabase account**
- [x] **Supabase project created** (account ≠ project — see config steps below)
- [x] **Vercel account** + GitHub repo connected (needed by Build 2)
- [ ] **Stripe account** — test mode is enough until Build 5. Live-mode prerequisites: verified business info, EIN/SSN, bank account
- [ ] **Gemini API key** (Google AI Studio) with billing enabled + monthly spend limit set (~$25/mo during dev, ~$100/mo live)
- [ ] **GitHub Actions enabled** on the repo (Build 21 — keep-alive cron)
- [ ] *(Optional)* Resend or Postmark for transactional email — skip for v1, switch later if Supabase built-in email deliverability becomes an issue

### Supabase project initial configuration (~10 min, do before Build 1)

- [ ] Create project named `sellerlab` (or similar), region: US East (or closest to your users)
- [ ] Save the database password in a password manager (you won't see it again)
- [ ] Note the project URL + anon key from Settings → API
- [ ] **Auth → URL Configuration**:
  - [ ] Site URL: `https://sellerlab.app`
  - [ ] Redirect URLs (add both): `http://localhost:3000/**` AND `https://sellerlab.app/**`
- [ ] **Auth → Settings**:
  - [ ] Refresh token expiry: 60 days (default is shorter)
  - [ ] Email auth enabled, magic link mode
- [ ] **Auth → Email templates**: customize subject + body for the magic link email

Magic links fail silently with "Invalid redirect URL" if the redirect URLs aren't whitelisted ahead of time. Most common pre-build mistake.

### Top gotchas to internalize before writing code

These bite indie devs building Supabase + Stripe + Extension stacks. Commit to muscle memory:

1. **RLS on every user-scoped table, immediately on creation.** Write `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` in the *same migration* as the `CREATE TABLE`. Never defer it. The Supabase dashboard shows a red banner for tables with RLS off — never ignore.

2. **Secrets only via environment variables.** `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret, Gemini API key, Stripe webhook secret — never in client-side code (extension JS, webapp public JS).
   - Local: `.env.local` (verify it's in `.gitignore`)
   - Vercel: Project Settings → Environment Variables
   - Supabase Edge Functions: `supabase secrets set GEMINI_API_KEY=...`

3. **Stripe webhook signature verification.** Every webhook handler must call:
   ```ts
   const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
   ```
   Without this, anyone can forge "paid" events. Single most common Stripe security mistake.

4. **Magic link `redirectTo` must match a whitelisted URL exactly.** Covered in setup above. Symptom of forgetting: magic-link email arrives but the click errors. Hard to debug because the cause is in the dashboard, not the code.

5. **`.app` requires HTTPS** (HSTS preload). Vercel handles this automatically with Let's Encrypt. If you ever experiment with other hosts, set up TLS *before* pointing DNS — browsers refuse to load `.app` over HTTP.

6. **Schema changes via migrations, not dashboard.** Use `supabase migration new ...` from the start:
   ```bash
   supabase migration new add_user_keywords
   # edit the generated file
   supabase db push
   ```
   Pays for itself the first time you need to reset a dev environment or onboard a collaborator.

7. **Keep-alive cron set up before first paying user.** GitHub Actions YAML (Build 21). Easy to forget until project pauses on day 8 of inactivity. Schedule for early development to avoid the surprise.

8. **Stable extension key in `manifest.config.ts`.** Use the `key` field so the dev unpacked extension ID matches the eventually-published ID. Otherwise `externally_connectable.matches` on the webapp and `chrome.runtime.sendMessage(EXT_ID, ...)` calls break at Web Store publish time.

9. **Privacy policy and ToS need real content.** Stripe and Chrome Web Store both require these as accessible URLs with actual content addressing:
   - What data you collect
   - How you use it (including: "we send images to Google for AI matching via Gemini")
   - Third-party processors (Supabase, Stripe, Google)
   - Data deletion process
   - Contact info for privacy questions
   
   TermsFeed or GetTerms generate decent boilerplate (~30 min to fill in for Build 2).

10. **Set spending limits immediately.** Google Cloud console (where Gemini billing is managed): monthly budget alerts + hard cap. Stripe Dashboard: email alerts for unusual activity. Without these, a runaway loop in your code (or a malicious actor) could burn hundreds of dollars before you notice.

### Things that feel like gotchas but aren't

- MV3 service workers get evicted and re-spawned constantly — normal. Don't rely on module-level state surviving across events.
- `chrome.storage.local` is async — feels weird coming from `localStorage`, but you adapt fast.
- Supabase RLS errors return as 401/403/empty result depending on operation. "It's just returning empty" usually means RLS is blocking, not that there's no data.

### Recommended build order

After Supabase config is done. Build 1 and Build 2 are sliced for faster iteration — get the auth path working end-to-end before filling in the rest of the schema and webapp pages.

1. **Build 1a — Auth foundation** (~2-4h): Supabase CLI setup, `profiles` table + RLS + auto-create-on-signup trigger, magic-link auth config. Minimum schema to support sign-in.
2. **Build 21** (keep-alive cron) — 30 min, do early so the dev project doesn't pause during gaps
3. **Build 2a — Temporary webapp sign-in** (~2-3h): `/sign-in` page (magic link request) + `/auth/callback` route + `/dashboard` stub to verify session. Temporary scaffolding for testing auth before the extension auth UI lands.
4. **Build 3** (extension auth UI) — unblocks paid-feature gating. Once landed, the temp `/sign-in` page from 2a is replaced by the extension's sign-in form (which calls `signInWithOtp` and uses the webapp `/auth/callback` for the redirect handoff).
5. **Build 1b — Rest of schema** (~6-8h): all other tables (`user_keywords`, `system_keywords`, `ai_calls`, `enriched_designs`, `sales_events`, `activity_events`, `buyers`) + RLS + storage bucket + custom `chrome.storage` adapter for the extension.
6. **Build 2b — Real webapp pages** (~5-9h): landing/pricing, Stripe return, privacy + ToS pages.
7. **Build 5** (Stripe) — can defer until you actually need to test paid flows.
8. **Builds 4, 6, 7, 8** — order flexible; work on what's most fun.
9. **Builds 9-14** (Spoonflower-touching) — leave for last, once auth + Stripe foundation is solid and you can be a "paid user" in your own dev environment.

---

## Implementation Sequencing

| # | Build | Hours |
|---|---|---|
| 1 | Supabase project, schema + RLS, Auth (magic link), custom `chrome.storage` adapter. **Typically sliced**: 1a = auth foundation (`profiles` + RLS + trigger + auth config, ~2-4h), 1b = rest of schema + storage bucket + chrome.storage adapter (~6-8h) | 8-12h |
| 2 | Tiny webapp on Vercel: landing/pricing, `/auth/callback` (handles magic-link redirect, exchanges code for session, hands off to extension), Stripe return, privacy + ToS pages. **Typically sliced**: 2a = temporary `/sign-in` + `/auth/callback` + `/dashboard` stub for testing pre-extension (~2-3h), 2b = real landing/pricing + Stripe return + privacy + ToS (~5-9h) | 8-12h |
| 3 | Extension auth UI (magic link request, token receipt via `externally_connectable`, signed-in/out state) | 6-10h |
| 4 | Right-click "Save to keywords" (contextMenus, background script, direct backend save) | 3-5h |
| 5 | Stripe single-tier setup, Checkout, webhook updating `profiles.plan` (per-subscription Price object so future tiering grandfathers cleanly) | 6-10h |
| 6 | Library UI in extension (CRUD on `user_keywords`, system_keywords browse, search/filter) | 6-10h |
| 7 | Starter library curation (~100 keywords from Spoonflower taxonomy) + seeding logic | 3-7h |
| 8 | AI image-match Edge Function + extension upload UI + results UI + bucket population | 20-30h |
| 9 | Sales CSV upload (file picker in extension) + parse/validate + `sales_events` ingest | 4-6h |
| 10 | Sales enrichment (Path B): top-10 selection query, per-design fetch with rate limiting, HTML parse, thumbnail download → Storage, `enriched_designs` upsert, progress UI | 12-18h |
| 11 | Activity pull (extension scrapes userhome news feed) → `activity_events` | 6-10h |
| 12 | Extension Analytics tab (port `ActivityTab.tsx`, wire to backend, drop matching code) | 6-10h |
| 13 | Extension Buyers tab (port `BuyersTab.tsx`, manual contact form, "View on Spoonflower" link out) | 8-12h |
| 14 | "Load 10 more" expansion buttons (separate for sales-rank + likes-rank, queue more enrichment) | 4-7h |
| 15 | Color-coded bucket refactor (`string[]` → `Map<word, Set<source>>`, chip color tier logic) | 6-10h |
| 16 | Sales/likes-driven tag pull (read enriched data, populate buckets with appropriate color tier) | 4-6h |
| 17 | Timeseries line chart in Analytics tab (Recharts, top-10 designs, auto-bucket, hover, legend toggle) | 8-12h |
| 18 | Competition winners — `won_competitions text[]` + UI in Analytics/Buyers tabs | 2-4h |
| 19 | Usage tracking + private alert at 200 calls/mo (ai_calls + view) + usage hint in UI | 4-6h |
| 20 | Generative AI button (separate flow, shared call cap) | 4-6h |
| 21 | GitHub Actions keep-alive cron (daily ping to keep Supabase Free awake) | 0.5-1h |
| 22 | Real-browser end-to-end testing across whole flow | 8-12h |

**Total: ~136-216 hours = ~17-27 days of focused work.**

The total grew vs. the earlier estimate because we added concrete builds (timeseries chart, competition wins, "Load 10 more", sales enrichment specifics) that were previously folded into vague "Sales/Likes scraper" buckets. Webapp scope shrunk by ~25-40h though, so the net is roughly stable.

---

## Risks

1. **Gemini price changes** — Gemini 2.5 Pro pricing has been stable, but a 2× price increase would halve the margin on calls. Watch. Mitigation: code is structured so model is a single config — swap to Gemini 2.5 Flash (~4× cheaper) or another provider if needed.
2. **Spoonflower DOM changes** — pull-from-page, sales scraping, likes scraping all depend on Spoonflower's HTML. Budget ~5h/quarter for maintenance.
3. **Power user abuse** — mitigated by tier caps. Monitor `ai_calls` for spikes; alert on outliers.
4. **Storage growth** — bounded by user behavior, not AI usage. R2 migration available if/when needed.
5. **Permission re-prompts** — fully avoided via `optional_permissions` pattern. No risk to free users.
6. **Acquisition cost** — not a technical risk. At $10/user, validate organic/word-of-mouth before paid acquisition.

---

## Open Decisions

1. **Domain name** — locks magic-link redirect URL, `externally_connectable`, OAuth setup later. Pick early.
2. **Empty library UX** — friendly hint when matches are sparse: "Add more keywords at [yoursite] to improve matches."
3. **Rate limit UX copy** — "You've used your 100 AI matches this month. Resets [date]." Confirm tone (apologetic vs. matter-of-fact).
4. **Color hex values** — verify suggested colors against existing MUI theme.
5. **Pro tier shape (when introduced later)** — three options on the table for when usage data justifies a second tier:
   - More calls only (clean but feels thin)
   - More calls + extras (e.g., generative AI gated to Pro)
   - More calls + higher caps everywhere (library size, history retention)

### Decided

- **Pricing**: $10/mo single tier, 100 AI calls/mo cap.
- **Supabase tier**: Free tier at launch + daily keep-alive ping. Upgrade to Pro at ~5 paying users.
- **Hard cap behavior**: cap with wait-for-reset (no upgrade option until Pro tier exists).
- **Match image storage**: pass-through only, not stored.
- **Generative AI cap**: shared with image-match (one combined call counter).
- **Sales/likes refresh cadence**: user-demanded only, no automation.
- **Permission model**: `optional_permissions` requested at sign-in only.
- **Sales import**: CSV upload with `design_id` column (in extension). User uploads what Spoonflower exports them — no scraping required.
- **Sales enrichment**: Path B (extension-side fetch with user's session cookies, no tab navigation). Rate-limited per Spoonflower Interaction Policy.
- **Enrichment scope**: top 10 by sales count + top 10 by likes count, deduped (~12-18 enriched designs typical). Beyond initial top-10, users explicitly request via "Load 10 more" buttons.
- **Buyer profile data**: manual contact notes only — no backend or extension scraping of buyer profiles.
- **Webapp scope**: minimal (5 pages: landing/pricing, auth callback, Stripe return, privacy, ToS). All feature UI lives in extension.
- **Analytics chart**: timeseries line chart in extension only (Recharts). Webapp version deferred.
- **Competition wins**: stored as `won_competitions text[]` on `enriched_designs`, user-marked.

---

## Notes from Conversation

- User scale: ~10 unique designs/week × 4 = ~40 unique designs/mo realistic usage. 100-call cap is 2.5× that — comfortable headroom.
- 100 starter keywords curated manually from Spoonflower's substrate, product type, style, theme, and subject categories.
- Library lives in extension (revised from "website only" once webapp scope was minimized).
- Spoonflower seller's catalog typically ~100 sold designs (lifetime, not monthly). Top-10 enrichment is bounded by this.
- Image storage cost is essentially flat — 46KB per image, ~10-20 images per user (top-10 sales + top-10 likes after dedup).
- $2/user/mo is the willing-to-spend AI budget (informed the 100-call cap decision).
- Pro upgrade is one-click via Supabase billing settings — no migration risk, instant quota lift.
- Daily keep-alive ping (vs. minimum 5-day cadence) chosen for simplicity and 7× safety margin.
- **Top-10 enrichment scope is high-signal-by-design**: tags from your top sellers are concentrated winners; aggregating across all sales would dilute the signal with noise from one-off purchases.
- **Top-10 is also a Spoonflower-server politeness measure**: bounds total fetches per user to ~10-20 lifetime, so aggregate load across 100 users is ~1,500 fetches/week spread over 100 residential IPs — invisibly small.
- **Sales-driven tag pull → right-click save → AI library context** creates a compounding loop: users promote their own winning tags into the AI's vocabulary over time.
- Existing `docs/activity-sales-matching.md` becomes obsolete once new flow lands (sales CSV will have design_id natively, no need to match to activity feed).
- Webapp UI for Library / Analytics / Buyers deferred to Phase 2 — only build when real demand surfaces from paying users.
