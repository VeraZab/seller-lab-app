import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Scrape-and-cache route for a single Spoonflower design. Called from the
// analytics client, one design at a time, throttled ~1/sec so we don't
// look like a bot to Spoonflower.
//
// What it does per design:
//   1. Fetch the public listing page HTML at spoonflower.com/en/fabric/{id}
//   2. Extract the primary image URL (the d-i-42 variant on
//      img.spoonflower.com — that's the clean design tile, not a
//      lifestyle mockup)
//   3. Extract all tag phrases from `aria-label="Shop for X"` attributes
//   4. Download the image bytes
//   5. Upload to the design-images Storage bucket
//   6. Save tags + source URL + timestamps to spoonflower_designs
//
// Auth: caller must send a valid Supabase JWT as Bearer. RLS policies on
// storage.objects and spoonflower_designs (migration 20260703000002)
// allow authenticated users to write, so no service_role key is required.

export const dynamic = "force-dynamic";

const BUCKET = "design-images";
const MIN_INTERVAL_MS = 1000;

// Module-scope guard so a single warm serverless instance doesn't fire
// two Spoonflower fetches within MIN_INTERVAL_MS even if two clients race.
let lastFetchAt = 0;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let body: { designId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const designId = Number(body.designId);
  if (!Number.isInteger(designId) || designId <= 0) {
    return NextResponse.json({ error: "designId required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "Server missing Supabase env" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Already cached? Return early. We deliberately check `image_cached_at`
  // as the signal — the row may exist with tags scraped but no image yet,
  // or with a failed scrape marker.
  const { data: existing } = await supabase
    .from("spoonflower_designs")
    .select("image_cached_at, tags")
    .eq("design_id", designId)
    .maybeSingle();
  if (existing?.image_cached_at) {
    return NextResponse.json({ ok: true, cached: true, alreadyCached: true });
  }

  // Rate-limit outgoing Spoonflower fetches at the process level.
  const now = Date.now();
  const wait = Math.max(0, lastFetchAt + MIN_INTERVAL_MS - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();

  const listingUrl = `https://www.spoonflower.com/en/fabric/${designId}`;
  const htmlRes = await tryFetch(listingUrl, {
    Accept: "text/html,*/*;q=0.8",
  });
  if (!htmlRes.ok) {
    return await markFailure(supabase, designId, htmlRes.status);
  }
  const html = htmlRes.body;

  const imageUrl = extractPrimaryImageUrl(html, designId);
  const tags = extractTags(html);
  if (!imageUrl) {
    console.warn("[cache-design-image] no image URL found in HTML", designId);
    return await markFailure(supabase, designId, 0);
  }

  const imgRes = await tryFetch(imageUrl, { Accept: "image/*,*/*;q=0.8" });
  if (!imgRes.ok || !imgRes.bytes) {
    console.warn(
      "[cache-design-image] image download failed",
      designId,
      imgRes.status,
    );
    return await markFailure(supabase, designId, imgRes.status);
  }

  const path = `${designId}.png`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, imgRes.bytes, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "31536000",
    });
  if (uploadErr) {
    console.error(
      "[cache-design-image] storage upload failed",
      designId,
      {
        message: uploadErr.message,
        name: uploadErr.name,
        // Some Supabase errors have status/code fields with more detail
        ...JSON.parse(JSON.stringify(uploadErr)),
      },
    );
    return NextResponse.json(
      { ok: false, step: "storage.upload", error: uploadErr.message },
      { status: 500 },
    );
  }

  const nowIso = new Date().toISOString();
  const { error: designsErr } = await supabase
    .from("spoonflower_designs")
    .upsert(
      {
        design_id: designId,
        image_cached_at: nowIso,
        image_source_url: imageUrl,
        scraped_at: nowIso,
        tags,
        updated_at: nowIso,
      },
      { onConflict: "design_id" },
    );
  if (designsErr) {
    console.error(
      "[cache-design-image] designs upsert failed",
      designId,
      designsErr,
    );
    return NextResponse.json(
      {
        ok: false,
        step: "designs.upsert",
        error: designsErr.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    cached: true,
    tagCount: tags.length,
    imageUrl,
  });
}

// Fetch wrapper that returns a normalized result and never throws.
async function tryFetch(
  url: string,
  extraHeaders: Record<string, string>,
): Promise<{
  ok: boolean;
  status: number;
  body: string;
  bytes?: Uint8Array;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...extraHeaders,
      },
    });
    if (!res.ok) return { ok: false, status: res.status, body: "" };
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.startsWith("image/")) {
      const ab = await res.arrayBuffer();
      return {
        ok: true,
        status: 200,
        body: "",
        bytes: new Uint8Array(ab),
      };
    }
    const body = await res.text();
    return { ok: true, status: 200, body };
  } catch (e) {
    console.error("[cache-design-image] fetch threw", url, e);
    return { ok: false, status: 0, body: "" };
  }
}

// Extract the primary design image URL from the listing HTML. Prefers the
// `d-i-42` variant which is the clean flat design tile. Falls back to any
// img.spoonflower.com/c/{designId}/... URL if the preferred one isn't
// present. Returns null if nothing matches.
function extractPrimaryImageUrl(
  html: string,
  designId: number,
): string | null {
  const escapedId = String(designId);
  // Stop at whitespace, quotes, commas, question marks, angle brackets
  // — all of these delimit the URL inside the HTML (`srcset="url1 640w,
  // url2 ..."` was tripping the previous regex, which then failed to
  // match anything usable).
  const anyImgRe = new RegExp(
    `https://img\\.spoonflower\\.com/c/${escapedId}/[^\\s"'<>?,]+\\.(?:png|jpg|jpeg)`,
    "g",
  );
  const matches = html.match(anyImgRe) ?? [];
  const unique = Array.from(new Set(matches));
  const preferred = unique.find((u) => u.includes("/d-i-42/"));
  return preferred ?? unique[0] ?? null;
}

// Pull tag phrases from `aria-label="Shop for X"` attributes on the
// listing page. Each phrase is stored verbatim — tokenization happens at
// query time so we don't couple storage to any specific split rule.
function extractTags(html: string): string[] {
  const re = /aria-label="Shop for ([^"]+)"/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const phrase = m[1].trim();
    if (!phrase) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

// Record a failed scrape attempt so we don't loop retrying every page
// load. Existing tags stay if we're only re-scraping to refresh the
// image; on a first-time failure the row lands with everything null
// except updated_at + scraped_at.
//
// The client is typed as `any` because supabase-js's generated types
// don't cross function boundaries well here and this helper only cares
// that `.from().upsert()` exists.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markFailure(supabase: any, designId: number, status: number) {
  const nowIso = new Date().toISOString();
  await supabase.from("spoonflower_designs").upsert(
    {
      design_id: designId,
      scraped_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "design_id" },
  );
  return NextResponse.json(
    { ok: false, status },
    { status: status >= 400 ? status : 502 },
  );
}
