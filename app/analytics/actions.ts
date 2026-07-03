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

export type UploadSalesResult = {
  received: number;
  inserted: number;
  duplicatesSkipped: number;
  invalid: number;
  errors: string[];
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
        // Must match the sales_events_unique_event constraint added in
        // migration 20260703000003. Balance is the natural row-level
        // uniqueness signal from the Spoonflower CSV — same customer
        // buying the same size at the same second at the same price
        // produces distinct rows because the running balance differs.
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
  };
}
