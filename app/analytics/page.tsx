import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AnalyticsClient from "./analytics-client";
import { uploadSales } from "./actions";
import {
  computeConversion,
  computeCustomers,
  computeDaily,
  computeDayHourHeatmap,
  computeHeadline,
  computeMostRefunded,
  computeProductCategoryBreakdown,
  computeSizeBreakdown,
  computeSubstrateBreakdown,
  computeTopDesigns,
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

  const email = user.email ?? "";
  const displayName = displayNameFromEmail(email);
  const initial = (displayName[0] ?? "?").toUpperCase();

  const stats = rows.length
    ? {
        headline: computeHeadline(rows),
        daily: computeDaily(rows),
        topDesigns: computeTopDesigns(rows),
        mostRefunded: computeMostRefunded(rows),
        substrate: computeSubstrateBreakdown(rows),
        size: computeSizeBreakdown(rows),
        productCategory: computeProductCategoryBreakdown(rows),
        customers: computeCustomers(rows),
        conversion: computeConversion(rows),
        heatmap: computeDayHourHeatmap(rows),
      }
    : null;

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
          .select("design_id, image_cached_at")
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
  const supabasePublicBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

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
    />
  );
}

function displayNameFromEmail(email: string): string {
  if (!email) return "Signed in";
  const local = email.split("@")[0] ?? email;
  return local.length > 18 ? `${local.slice(0, 17)}…` : local;
}
