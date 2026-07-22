"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// A "variant set" groups color / scale variations of the same base
// design so analytics can fold them into one row/line. Purely
// per-user metadata.

export type VariantSet = {
  id: string;
  name: string;
  designIds: number[];
};

export type VariantData = {
  sets: VariantSet[];
  // Fast lookup: design_id → set_id (null for unset designs).
  setByDesignId: Record<number, string | null>;
};

export async function createVariantSet(
  name: string,
  designIds: number[],
): Promise<{ id?: string; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name required" };
  if (!designIds.length) return { error: "Pick at least one design" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: setRow, error: setErr } = await supabase
    .from("design_variant_sets")
    .insert({ user_id: user.id, name: trimmed })
    .select("id")
    .single();
  if (setErr || !setRow) {
    // Unique-constraint violation → user already has a set with this name.
    if (setErr?.code === "23505") return { error: "Name already used" };
    return { error: setErr?.message ?? "Insert failed" };
  }

  const memberships = designIds.map((design_id) => ({
    user_id: user.id,
    design_id,
    variant_set_id: setRow.id,
  }));
  const { error: memErr } = await supabase
    .from("user_design_variant")
    .upsert(memberships, { onConflict: "user_id,design_id" });
  if (memErr) return { error: memErr.message };

  revalidatePath("/analytics");
  return { id: setRow.id };
}

export async function renameVariantSet(
  id: string,
  name: string,
): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name required" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("design_variant_sets")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    if (error.code === "23505") return { error: "Name already used" };
    return { error: error.message };
  }
  revalidatePath("/analytics");
  return {};
}

export async function deleteVariantSet(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  // FK on user_design_variant is ON DELETE SET NULL, so membership rows
  // survive with variant_set_id=NULL — the designs become ungrouped.
  // .select("id") ensures the DELETE actually runs (Supabase REST has
  // been observed to no-op delete-without-select in some deployments).
  const { error } = await supabase
    .from("design_variant_sets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: error.message };
  revalidatePath("/analytics");
  return {};
}

// Set membership for a single design. Passing null unassigns it from
// any variant set.
export async function setDesignVariant(
  designId: number,
  variantSetId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("user_design_variant")
    .upsert(
      {
        user_id: user.id,
        design_id: designId,
        variant_set_id: variantSetId,
      },
      { onConflict: "user_id,design_id" },
    );
  if (error) return { error: error.message };
  revalidatePath("/analytics");
  return {};
}

// Delete every variant set the user has. Membership rows stay (their
// variant_set_id becomes NULL via ON DELETE SET NULL), so no
// per-design metadata is lost — the designs just become ungrouped.
export async function deleteAllVariantSets(): Promise<{
  count?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data, error } = await supabase
    .from("design_variant_sets")
    .delete()
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: error.message };
  revalidatePath("/analytics");
  return { count: data?.length ?? 0 };
}

// Auto-group designs by an in-title code (e.g. "ZAB25045" — three
// letters that identify a design family plus digits). Scans every
// design_title the user has ever sold for `\bPREFIX[A-Za-z0-9]+\b`
// (case-insensitive), buckets by matched code, and creates a variant
// set per code with ≥2 members. Each set is named after its code so
// naming is stable and never collides.
//
// `clearExisting` deletes every current variant set first so the user
// starts from a clean slate — matches the "ungroup everything, then
// regroup by prefix" workflow.
export async function autoGroupByPrefix(
  prefix: string,
  clearExisting: boolean,
): Promise<{
  setsCreated?: number;
  setsDeleted?: number;
  designsGrouped?: number;
  designsScanned?: number;
  distinctCodes?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const trimmed = prefix.trim();
  if (!trimmed) return { error: "Prefix required" };
  if (trimmed.length < 2) return { error: "Prefix must be at least 2 chars" };
  if (!/^[A-Za-z0-9-]+$/.test(trimmed))
    return {
      error: "Prefix can only contain letters, digits, and hyphens",
    };

  let setsDeleted = 0;
  if (clearExisting) {
    // Include .select("id") so we (a) get an explicit count back and
    // (b) force the DELETE to actually run — Supabase's REST client
    // has been observed to no-op a delete-without-select in some
    // deployments. Belt-and-suspenders.
    const { data: deleted, error: delErr } = await supabase
      .from("design_variant_sets")
      .delete()
      .eq("user_id", user.id)
      .select("id");
    if (delErr) return { error: delErr.message };
    setsDeleted = deleted?.length ?? 0;
  }

  // Pull every distinct (design_id, latest title) the user has sold.
  const { data: rows, error: rowsErr } = await supabase
    .from("sales_events")
    .select("design_id, design_title, sold_at")
    .eq("user_id", user.id)
    .not("design_id", "is", null);
  if (rowsErr) return { error: rowsErr.message };

  // Keep the most recent title per design_id — Spoonflower titles
  // sometimes drift over time and we want the latest.
  const latestByDesign = new Map<
    number,
    { title: string; when: string }
  >();
  for (const r of (rows ?? []) as {
    design_id: number;
    design_title: string | null;
    sold_at: string;
  }[]) {
    if (!r.design_title) continue;
    const prev = latestByDesign.get(r.design_id);
    if (!prev || r.sold_at > prev.when) {
      latestByDesign.set(r.design_id, {
        title: r.design_title,
        when: r.sold_at,
      });
    }
  }

  const pattern = new RegExp(
    `\\b${escapeRegExp(trimmed)}[A-Za-z0-9]+\\b`,
    "i",
  );
  const designsByCode = new Map<string, number[]>();
  for (const [designId, entry] of latestByDesign) {
    const match = entry.title.match(pattern);
    if (!match) continue;
    const code = match[0].toUpperCase();
    const list = designsByCode.get(code) ?? [];
    list.push(designId);
    designsByCode.set(code, list);
  }

  const groupsToCreate = Array.from(designsByCode.entries()).filter(
    ([, ids]) => ids.length >= 2,
  );

  let setsCreated = 0;
  let designsGrouped = 0;
  const errors: string[] = [];
  for (const [code, designIds] of groupsToCreate) {
    const { data: setRow, error: setErr } = await supabase
      .from("design_variant_sets")
      .insert({ user_id: user.id, name: code })
      .select("id")
      .single();
    if (setErr || !setRow) {
      // Name collision — either from a previous run (if clearExisting
      // was false) or a race. Skip and keep going.
      errors.push(`${code}: ${setErr?.message ?? "no row"}`);
      continue;
    }
    const memberships = designIds.map((design_id) => ({
      user_id: user.id,
      design_id,
      variant_set_id: setRow.id,
    }));
    const { error: memErr } = await supabase
      .from("user_design_variant")
      .upsert(memberships, { onConflict: "user_id,design_id" });
    if (memErr) {
      errors.push(`${code} members: ${memErr.message}`);
      continue;
    }
    setsCreated++;
    designsGrouped += designIds.length;
  }

  revalidatePath("/analytics");
  return {
    setsCreated,
    setsDeleted,
    designsGrouped,
    designsScanned: latestByDesign.size,
    distinctCodes: designsByCode.size,
    error: errors.length ? errors.slice(0, 3).join("; ") : undefined,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Bulk-edit a set's membership: replace its member list with the given
// designIds. Any previously-in-set designs not in the new list get
// nulled out. Used by the edit-set modal.
export async function setVariantMembership(
  variantSetId: string,
  designIds: number[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Null-out any existing members not in the new list.
  const { error: clearErr } = await supabase
    .from("user_design_variant")
    .update({ variant_set_id: null })
    .eq("user_id", user.id)
    .eq("variant_set_id", variantSetId)
    .not("design_id", "in", `(${designIds.join(",") || "0"})`);
  if (clearErr) return { error: clearErr.message };

  if (designIds.length > 0) {
    const memberships = designIds.map((design_id) => ({
      user_id: user.id,
      design_id,
      variant_set_id: variantSetId,
    }));
    const { error: memErr } = await supabase
      .from("user_design_variant")
      .upsert(memberships, { onConflict: "user_id,design_id" });
    if (memErr) return { error: memErr.message };
  }
  revalidatePath("/analytics");
  return {};
}
