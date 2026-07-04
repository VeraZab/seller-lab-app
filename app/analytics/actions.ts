"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ParsedSaleRow = {
  sold_at: string;
  type: string;
  qty: number;
  size: string | null;
  design_title: string | null;
  design_id: number | null;
  substrate: string | null;
  customer: string | null;
  amount: number;
  balance: number | null;
  description: string | null;
};

// A conflict is an incoming CSV row whose identity (sold_at + design_id +
// customer) matches an existing DB row, but where a value that identifies
// the sale itself has changed (amount, size, or qty). Almost certainly a
// Spoonflower-side correction of a past export. We surface these to the
// user rather than acting on them — nothing is auto-updated.
export type SaleConflict = {
  sold_at: string;
  design_id: number | null;
  design_title: string | null;
  customer: string | null;
  existing: { amount: number; size: string | null; qty: number };
  incoming: { amount: number; size: string | null; qty: number };
};

export type UploadSalesResult = {
  received: number;
  inserted: number;
  duplicatesSkipped: number;
  invalid: number;
  errors: string[];
  conflicts: SaleConflict[];
};

// Insert a parsed batch of Spoonflower earnings CSV rows into sales_events.
// Idempotent: the composite unique constraint on
// (user_id, sold_at, design_id, customer, amount, size) drops any row we
// already have. Re-uploading last month's CSV in full is safe — only new
// events land.
export async function uploadSales(
  rows: ParsedSaleRow[],
): Promise<UploadSalesResult> {
  const empty: UploadSalesResult = {
    received: 0,
    inserted: 0,
    duplicatesSkipped: 0,
    invalid: 0,
    errors: [],
    conflicts: [],
  };
  if (!rows.length) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...empty, errors: ["Not signed in"] };

  const toInsert = rows
    .filter(
      (r): r is ParsedSaleRow =>
        !!r.sold_at &&
        Number.isFinite(r.amount) &&
        !!r.type,
    )
    .map((r) => ({
      user_id: user.id,
      sold_at: r.sold_at,
      type: r.type,
      qty: r.qty || 1,
      size: r.size,
      design_title: r.design_title,
      design_id: r.design_id,
      substrate: r.substrate,
      customer: r.customer,
      amount: r.amount,
      balance: r.balance,
      description: r.description,
    }));

  const invalid = rows.length - toInsert.length;
  if (!toInsert.length) {
    return { ...empty, received: rows.length, invalid };
  }

  // Conflict detection: does any incoming row have the same identity
  // (sold_at + design_id + customer) as an existing row but different
  // amount/size/qty? Almost certainly a Spoonflower-side correction of
  // a past sale. We warn, we don't act — the composite unique key
  // includes balance so the corrected row won't collide on upsert; both
  // rows would coexist. User has to decide whether to keep the old or
  // manually reconcile.
  const conflicts = await detectConflicts(supabase, user.id, toInsert);

  // We need per-row insertion counts to know how many were duplicates.
  // Postgrest returns the number of rows written when we ask for a
  // representation back. Batching in chunks so a single failed row can't
  // sink the whole upload.
  const CHUNK = 500;
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("sales_events")
      .upsert(chunk, {
        // Must match the sales_events_unique_event constraint (created
        // in migration 20260703000003, rebuilt with NULLS NOT DISTINCT
        // in migration 20260704000001). Balance is the natural
        // row-level uniqueness signal from the Spoonflower CSV — same
        // customer buying the same size at the same second at the same
        // price produces distinct rows because the running balance
        // differs. NULLS NOT DISTINCT is critical for debit/adjustment
        // rows where design_id and customer are NULL — without it, PG
        // treats each NULL as unique and re-uploads duplicate them.
        onConflict:
          "user_id,sold_at,design_id,customer,amount,size,balance",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      errors.push(error.message);
      continue;
    }
    inserted += data?.length ?? 0;
  }
  const duplicatesSkipped = toInsert.length - inserted;
  revalidatePath("/analytics");
  return {
    received: rows.length,
    inserted,
    duplicatesSkipped,
    invalid,
    errors,
    conflicts,
  };
}

type InsertRow = {
  user_id: string;
  sold_at: string;
  type: string;
  qty: number;
  size: string | null;
  design_title: string | null;
  design_id: number | null;
  substrate: string | null;
  customer: string | null;
  amount: number;
  balance: number | null;
  description: string | null;
};

// Identity key for a sale: what customer bought what design when. We
// match on this triple, then compare amount/size/qty. Ambiguous cases
// (multiple existing rows or multiple incoming rows sharing an identity)
// are skipped — those already differ in some way, so there's nothing
// clear to warn about.
function identityKey(
  sold_at: string,
  design_id: number | null,
  customer: string | null,
): string {
  return `${sold_at}||${design_id ?? ""}||${customer ?? ""}`;
}

async function detectConflicts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  incoming: InsertRow[],
): Promise<SaleConflict[]> {
  // Bucket incoming rows by identity. If two incoming rows share an
  // identity they're already a genuine plurality (different amount or
  // balance) — skip both since we can't decide which one is "the"
  // corrected version.
  const incomingByKey = new Map<string, InsertRow[]>();
  for (const r of incoming) {
    const k = identityKey(r.sold_at, r.design_id, r.customer);
    const list = incomingByKey.get(k) ?? [];
    list.push(r);
    incomingByKey.set(k, list);
  }
  const singleIncoming = new Map<string, InsertRow>();
  for (const [k, list] of incomingByKey) {
    if (list.length === 1) singleIncoming.set(k, list[0]);
  }
  if (singleIncoming.size === 0) return [];

  // Query existing rows matching any of the incoming sold_at values.
  // We could try to be more precise with a big OR filter but Postgres
  // handles this fine and the extra rows get filtered client-side.
  const soldAts = Array.from(new Set(incoming.map((r) => r.sold_at)));
  const { data: existing } = await supabase
    .from("sales_events")
    .select("sold_at, design_id, customer, amount, size, qty")
    .eq("user_id", userId)
    .in("sold_at", soldAts);

  const existingByKey = new Map<
    string,
    { amount: number; size: string | null; qty: number }[]
  >();
  for (const e of (existing ?? []) as {
    sold_at: string;
    design_id: number | null;
    customer: string | null;
    amount: number;
    size: string | null;
    qty: number;
  }[]) {
    const k = identityKey(e.sold_at, e.design_id, e.customer);
    const list = existingByKey.get(k) ?? [];
    list.push({ amount: e.amount, size: e.size, qty: e.qty });
    existingByKey.set(k, list);
  }

  const conflicts: SaleConflict[] = [];
  for (const [k, inc] of singleIncoming) {
    const existingList = existingByKey.get(k);
    if (!existingList || existingList.length !== 1) continue;
    const ex = existingList[0];
    const amountChanged = Math.abs(ex.amount - inc.amount) > 0.005;
    const sizeChanged = (ex.size ?? "") !== (inc.size ?? "");
    const qtyChanged = ex.qty !== (inc.qty || 1);
    if (!amountChanged && !sizeChanged && !qtyChanged) continue;
    conflicts.push({
      sold_at: inc.sold_at,
      design_id: inc.design_id,
      design_title: inc.design_title,
      customer: inc.customer,
      existing: { amount: ex.amount, size: ex.size, qty: ex.qty },
      incoming: {
        amount: inc.amount,
        size: inc.size,
        qty: inc.qty || 1,
      },
    });
  }
  return conflicts;
}
