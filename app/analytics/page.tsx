import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AnalyticsClient from "./analytics-client";
import { uploadSales } from "./actions";
import {
  computeConversion,
  computeCustomers,
  collectHeatmapEvents,
  computeDaily,
  computeHeadline,
  computeMostRefunded,
  computeMyPurchases,
  computeProductCategoryBreakdown,
  computeSizeBreakdown,
  computeSubstrateBreakdown,
  computeTopDesigns,
  computeTopDesignsMonthly,
  computeTopKeywordsMonthly,
  computeYearly,
  type SalesRow,
} from "./stats";

export type DesignHistoryRow = {
  id: string;
  sold_at: string;
  type: string;
  qty: number;
  size: string | null;
  substrate: string | null;
  customer: string | null;
  amount: number;
};

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/analytics");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.plan !== "paid") redirect("/");

  // RLS scopes this to the current user automatically — no extra filter
  // needed, but we keep `eq("user_id", user.id)` for the query planner
  // and to make the intent obvious to future readers.
  const { data: raw } = await supabase
    .from("sales_events")
    .select(
      "id, sold_at, type, qty, size, design_title, design_id, substrate, customer, amount, balance",
    )
    .eq("user_id", user.id)
    .order("sold_at", { ascending: false });

  const rows = (raw ?? []) as SalesRow[];

  // Sale-range summary for the sync badge. Rows come sorted desc by
  // sold_at, so [0] is latest and [last] is earliest. Skip if empty.
  const earliestSaleAt = rows.length ? rows[rows.length - 1].sold_at : null;
  const latestSaleAt = rows.length ? rows[0].sold_at : null;
  const totalSaleEvents = rows.length;

  const email = user.email ?? "";
  const displayName = displayNameFromEmail(email);
  const initial = (displayName[0] ?? "?").toUpperCase();

  // (stats computed later, after tagsByDesign is loaded — the top-10
  // keywords chart needs per-design tag lists.)

  // Per-design transaction history — powers the design-detail modal on
  // the analytics page. We send a compact projection of every event so
  // the client can render the transaction list without another
  // roundtrip. For ~1000 rows this stays well under 200KB.
  const historyByDesign: Record<string, DesignHistoryRow[]> = {};
  for (const r of rows) {
    if (!r.design_id) continue;
    const key = String(r.design_id);
    const list = historyByDesign[key] ?? [];
    list.push({
      id: r.id,
      sold_at: r.sold_at,
      type: r.type,
      qty: r.qty,
      size: r.size,
      substrate: r.substrate,
      customer: r.customer,
      amount: r.amount,
    });
    historyByDesign[key] = list;
  }

  // Pull cached-image status for all design_ids the user has ever sold.
  // The client uses this to pick between the storage URL (fast, persistent)
  // and the Spoonflower CDN URL (fallback while caching is pending), and
  // to know which design_ids still need a cache request kicked off.
  const uniqueIds = Array.from(
    new Set(
      rows.map((r) => r.design_id).filter((id): id is number => !!id),
    ),
  );
  const { data: designCache } =
    uniqueIds.length > 0
      ? await supabase
          .from("spoonflower_designs")
          .select("design_id, image_cached_at, tags")
          .in("design_id", uniqueIds)
      : { data: [] };
  const cachedIds = new Set(
    ((designCache ?? []) as {
      design_id: number;
      image_cached_at: string | null;
    }[])
      .filter((d) => !!d.image_cached_at)
      .map((d) => d.design_id),
  );
  const tagsByDesign = new Map<number, string[]>();
  for (const d of (designCache ?? []) as {
    design_id: number;
    tags: string[] | null;
  }[]) {
    if (d.tags && d.tags.length > 0) tagsByDesign.set(d.design_id, d.tags);
  }
  // User's saved keyword library — drives two behaviors in the analytics
  // tokenizer:
  //   1. Multi-word phrases (words containing "-") are folded so tags
  //      like "block print" count as one merged token `block-print`.
  //   2. Hidden words (soft-deleted from the workspace) are stripped
  //      from attribution — e.g. "new" or "the" removed from the library
  //      also drop out of the Top-20 keywords chart.
  const { data: keywordRows } = await supabase
    .from("user_keywords")
    .select("word, hidden")
    .eq("user_id", user.id);
  const phrases: string[] = [];
  const hiddenWords = new Set<string>();
  for (const r of (keywordRows ?? []) as { word: string; hidden: boolean }[]) {
    const w = r.word.toLowerCase();
    if (r.hidden) hiddenWords.add(w);
    // Include ALL hyphenated words (even hidden) so hidden phrases still
    // fold their constituents — otherwise hiding "block-print" would leak
    // "block" and "print" back into the chart as separate tokens. The
    // folded phrase itself is then dropped via the hiddenWords filter.
    if (w.includes("-")) phrases.push(w);
  }
  const supabasePublicBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // Pre-compute KPI variants per year so the client can flip between
  // "All years" and any single year without a roundtrip. Small payload
  // (a few numbers × few years) so cheap to send.
  const yearsPresent = Array.from(
    new Set(
      rows
        .map((r) => {
          const d = new Date(r.sold_at);
          return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
        })
        .filter((y): y is number => y != null),
    ),
  ).sort((a, b) => a - b);
  const kpisByYear: Record<
    string,
    {
      headline: ReturnType<typeof computeHeadline>;
      myPurchases: ReturnType<typeof computeMyPurchases>;
      conversion: ReturnType<typeof computeConversion>;
    }
  > = {
    all: {
      headline: computeHeadline(rows),
      myPurchases: computeMyPurchases(rows),
      conversion: computeConversion(rows),
    },
  };
  for (const y of yearsPresent) {
    kpisByYear[String(y)] = {
      headline: computeHeadline(rows, y),
      myPurchases: computeMyPurchases(rows, y),
      conversion: computeConversion(rows, y),
    };
  }

  const stats = rows.length
    ? {
        headline: computeHeadline(rows),
        myPurchases: computeMyPurchases(rows),
        kpisByYear,
        availableYears: yearsPresent,
        daily: computeDaily(rows),
        topDesigns: computeTopDesigns(rows),
        mostRefunded: computeMostRefunded(rows),
        substrate: computeSubstrateBreakdown(rows),
        size: computeSizeBreakdown(rows),
        productCategory: computeProductCategoryBreakdown(rows),
        customers: computeCustomers(rows),
        conversion: computeConversion(rows),
        heatmapEvents: collectHeatmapEvents(rows),
        yearly: computeYearly(rows),
        topDesignsMonthly: computeTopDesignsMonthly(rows, 10),
        topKeywordsMonthly: computeTopKeywordsMonthly(
          rows,
          tagsByDesign,
          20,
          phrases,
          hiddenWords,
        ),
      }
    : null;

  return (
    <AnalyticsClient
      user={{
        email,
        displayName,
        initial,
        plan: profile?.plan === "paid" ? "paid" : "free",
      }}
      stats={stats}
      uploadSales={uploadSales}
      cachedDesignIds={Array.from(cachedIds)}
      uncachedDesignIds={uniqueIds.filter((id) => !cachedIds.has(id))}
      storageUrlBase={`${supabasePublicBase}/storage/v1/object/public/design-images`}
      historyByDesign={historyByDesign}
      syncSummary={{
        earliestSaleAt,
        latestSaleAt,
        totalSaleEvents,
      }}
    />
  );
}

function displayNameFromEmail(email: string): string {
  if (!email) return "Signed in";
  const local = email.split("@")[0] ?? email;
  return local.length > 18 ? `${local.slice(0, 17)}…` : local;
}
