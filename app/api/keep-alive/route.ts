import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Keep-alive ping for Supabase. Free-tier Supabase auto-pauses projects
// after ~7 days of inactivity, which would make the workspace unusable
// for any user who hasn't visited recently. A daily Vercel cron hits this
// route and runs a count query — enough activity to reset the timer.
//
// To inspect it tomorrow: Vercel dashboard → Project → Logs → filter for
// "KEEP-ALIVE". Each invocation logs one structured line you can grep.

export const dynamic = "force-dynamic";

const LOG_TAG = "KEEP-ALIVE";

function logEvent(payload: Record<string, unknown>): void {
  // Single tagged line per invocation. Grep / filter on "KEEP-ALIVE" in
  // Vercel's log viewer to see every cron run.
  const at = new Date().toISOString();
  console.log(`[${LOG_TAG}] ${at} ${JSON.stringify(payload)}`);
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;

  // CRON_SECRET MUST be configured server-side. Vercel cron sends
  // `Authorization: Bearer <CRON_SECRET>` automatically when the env var
  // is set in the project. If we don't have one to compare against, the
  // endpoint is unauthenticated — refuse to run instead of silently
  // accepting anyone.
  if (!expected) {
    logEvent({ status: "config_error", reason: "CRON_SECRET missing" });
    return NextResponse.json(
      { error: "Server not configured (CRON_SECRET missing)" },
      { status: 500 },
    );
  }
  if (auth !== `Bearer ${expected}`) {
    logEvent({
      status: "unauthorized",
      hasBearer: auth.startsWith("Bearer "),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || (!serviceKey && !anonKey)) {
    logEvent({ status: "config_error", reason: "supabase env missing" });
    return NextResponse.json(
      { error: "Server missing Supabase env" },
      { status: 500 },
    );
  }

  // Service-role bypasses RLS so the count reflects every user's rows,
  // not just whatever the anon role can see (= zero). Falls back to anon
  // if the service key isn't configured — the query still hits the DB
  // (which is all that's required for the inactivity timer), the count
  // just comes back as 0.
  const role = serviceKey ? "service_role" : "anon";
  const supabase = createClient(supabaseUrl, serviceKey ?? anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = Date.now();
  const { count, error } = await supabase
    .from("user_keywords")
    .select("id", { head: true, count: "exact" });

  const elapsedMs = Date.now() - startedAt;
  if (error) {
    logEvent({
      status: "query_failed",
      role,
      elapsedMs,
      error: error.message,
    });
    return NextResponse.json(
      { ok: false, error: error.message, elapsedMs },
      { status: 502 },
    );
  }

  logEvent({
    status: "ok",
    role,
    keywordCount: count ?? 0,
    elapsedMs,
  });

  return NextResponse.json({
    ok: true,
    keywordCount: count ?? 0,
    elapsedMs,
    at: new Date().toISOString(),
  });
}
