import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomersClient from "./customers-client";
import { computeCustomers, type SalesRow } from "../analytics/stats";

export type CustomerHistoryRow = {
  id: string;
  sold_at: string;
  type: string;
  qty: number;
  size: string | null;
  design_title: string | null;
  design_id: number | null;
  substrate: string | null;
  amount: number;
};

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/customers");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.plan !== "paid") redirect("/");

  const { data: raw } = await supabase
    .from("sales_events")
    .select(
      "id, sold_at, type, qty, size, design_title, design_id, substrate, customer, amount, balance",
    )
    .eq("user_id", user.id)
    .order("sold_at", { ascending: false });
  const rows = (raw ?? []) as SalesRow[];

  // Aggregate summary (same shape the analytics page uses).
  const customers = computeCustomers(rows);

  // Per-customer purchase history. Key = the same bucket key
  // computeCustomers uses (guest handles collapse to "__guest__" so any
  // buyer Spoonflower didn't attribute lands in one Guest lane).
  const historyByKey = new Map<string, CustomerHistoryRow[]>();
  const guestHandles = new Set([
    "guest",
    "guest_user",
    "anonymous",
  ]);
  for (const r of rows) {
    if (!r.customer) continue;
    const isGuest = guestHandles.has(r.customer.toLowerCase());
    const key = isGuest ? "__guest__" : r.customer;
    const list = historyByKey.get(key) ?? [];
    list.push({
      id: r.id,
      sold_at: r.sold_at,
      type: r.type,
      qty: r.qty,
      size: r.size,
      design_title: r.design_title,
      design_id: r.design_id,
      substrate: r.substrate,
      amount: r.amount,
    });
    historyByKey.set(key, list);
  }
  const historyByCustomer: Record<string, CustomerHistoryRow[]> = {};
  historyByKey.forEach((v, k) => (historyByCustomer[k] = v));

  // Guest share of ALL sale-event count — so the header stat "X% guest"
  // works even when there are no repeat guest customers to bucket.
  const totalSaleEvents = rows.filter((r) => r.type === "sale").length;
  const guestSaleEvents = rows.filter(
    (r) =>
      r.type === "sale" &&
      r.customer &&
      guestHandles.has(r.customer.toLowerCase()),
  ).length;

  // Cached image status so the design thumbnails inside the detail
  // pane render from Storage where possible (matches analytics page).
  const uniqueIds = Array.from(
    new Set(rows.map((r) => r.design_id).filter((id): id is number => !!id)),
  );
  const { data: designCache } =
    uniqueIds.length > 0
      ? await supabase
          .from("spoonflower_designs")
          .select("design_id, image_cached_at")
          .in("design_id", uniqueIds)
      : { data: [] };
  const cachedIds = new Set(
    (
      (designCache ?? []) as {
        design_id: number;
        image_cached_at: string | null;
      }[]
    )
      .filter((d) => !!d.image_cached_at)
      .map((d) => d.design_id),
  );

  const supabasePublicBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const email = user.email ?? "";
  const displayName = displayNameFromEmail(email);
  const initial = (displayName[0] ?? "?").toUpperCase();

  return (
    <CustomersClient
      user={{
        email,
        displayName,
        initial,
        plan: profile?.plan === "paid" ? "paid" : "free",
      }}
      customers={customers}
      historyByCustomer={historyByCustomer}
      totalSaleEvents={totalSaleEvents}
      guestSaleEvents={guestSaleEvents}
      cachedDesignIds={Array.from(cachedIds)}
      storageUrlBase={`${supabasePublicBase}/storage/v1/object/public/design-images`}
    />
  );
}

function displayNameFromEmail(email: string): string {
  if (!email) return "Signed in";
  const local = email.split("@")[0] ?? email;
  return local.length > 18 ? `${local.slice(0, 17)}…` : local;
}
