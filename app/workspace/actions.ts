"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY, normalizeCategory } from "./categories";
import { buildClassifyPrompt, normalizeKind } from "./kinds";
import { normalizeWord } from "./words";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function addKeywords(
  entries: {
    word: string;
    category: string | null;
    kind?: string | null;
  }[],
) {
  if (!entries.length) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const seen = new Set<string>();
  const cleaned = entries
    .map((e) => ({
      user_id: user.id,
      word: normalizeWord(e.word),
      category: e.category?.trim() || null,
      // Normalize the explicit kind override now so we don't classify
      // entries the caller already labeled. Empty string → null = "Auto".
      kindOverride:
        typeof e.kind === "string" && e.kind.trim()
          ? normalizeKind(e.kind.trim())
          : null,
    }))
    .filter((e) => {
      if (!e.word) return false;
      if (seen.has(e.word)) return false;
      seen.add(e.word);
      return true;
    });

  if (!cleaned.length) return;

  // Only words without an explicit kind go to the AI classifier. If the
  // user picked a kind in the dropdown it wins outright — saves a Gemini
  // call and respects user intent.
  const toClassify = cleaned
    .filter((r) => !r.kindOverride)
    .map((r) => r.word);
  const kindMap = toClassify.length
    ? await classifyKinds(toClassify)
    : {};

  const rows = cleaned.map((r) => ({
    user_id: r.user_id,
    word: r.word,
    category: r.category,
    kind: r.kindOverride ?? kindMap[r.word.toLowerCase()] ?? null,
  }));

  await supabase
    .from("user_keywords")
    .upsert(rows, {
      onConflict: "user_id,word",
      ignoreDuplicates: true,
    });
  revalidatePath("/workspace");
}

export type CsvImportResult = {
  // Rows accepted from the CSV (after normalize/dedupe/validate).
  received: number;
  // Rows actually written to the DB (inserted or category/kind updated).
  written: number;
  // Rows whose word already lived in the user's library with category=trend;
  // skipped per the import rule "trend stays trend, never overwritten".
  keptTrend: number;
};

// Bulk CSV import with conflict rules that differ from the typed Add bar:
//   - existing row with category='trend' → skip (trend is sacred)
//   - any other existing row → overwrite category AND kind from the CSV
//   - new word → insert
// Caller is expected to have already normalized words, validated category
// against CATEGORY, validated kind against KINDS, and deduped — but we
// re-apply normalization defensively because server actions are a public
// boundary.
export async function importKeywordsFromCsv(
  entries: { word: string; category: string; kind: string }[],
): Promise<CsvImportResult> {
  const empty = { received: 0, written: 0, keptTrend: 0 };
  if (!entries.length) return empty;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  // Normalize + validate + dedupe (first-occurrence wins, matching addKeywords).
  const seen = new Set<string>();
  const cleaned: { word: string; category: string; kind: string }[] = [];
  for (const e of entries) {
    const word = normalizeWord(e.word);
    if (!word || seen.has(word)) continue;
    const category = normalizeCategory(e.category ?? "");
    if (!category) continue;
    const kind = normalizeKind(e.kind ?? "");
    if (!kind) continue;
    seen.add(word);
    cleaned.push({ word, category, kind });
  }
  if (!cleaned.length) return empty;

  // Find which incoming words already exist + with what category, so we
  // can carve out trend rows before the upsert.
  const words = cleaned.map((e) => e.word);
  const { data: existing } = await supabase
    .from("user_keywords")
    .select("word, category")
    .eq("user_id", user.id)
    .in("word", words);

  const trendWords = new Set<string>();
  for (const r of (existing ?? []) as { word: string; category: string | null }[]) {
    if (r.category === CATEGORY.TREND) trendWords.add(r.word);
  }

  const toUpsert = cleaned
    .filter((e) => !trendWords.has(e.word))
    .map((e) => ({
      user_id: user.id,
      word: e.word,
      category: e.category,
      kind: e.kind,
    }));

  if (toUpsert.length) {
    // ignoreDuplicates: false so existing rows have category + kind
    // overwritten by the CSV (per the import rule). Frequency stays at its
    // current value because we don't list it in the upsert columns — but
    // for inserted rows it defaults to 1 from the schema.
    await supabase
      .from("user_keywords")
      .upsert(toUpsert, {
        onConflict: "user_id,word",
        ignoreDuplicates: false,
      });
  }

  revalidatePath("/workspace");
  return {
    received: cleaned.length,
    written: toUpsert.length,
    keptTrend: trendWords.size,
  };
}

// Backfill `kind` for the current user's unclassified rows. Called from
// the workspace page on load when any rows are missing a kind, so a fresh
// library or a newly-added column gets populated on first view.
export async function classifyMissingKindsForCurrentUser(): Promise<{
  classified: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { classified: 0 };

  const { data: rows } = await supabase
    .from("user_keywords")
    .select("word")
    .eq("user_id", user.id)
    .is("kind", null);

  const words = (rows ?? []).map((r: { word: string }) => r.word);
  if (!words.length) return { classified: 0 };

  const kindMap = await classifyKinds(words);
  let classified = 0;
  // Per-row update is O(N) round-trips; for libraries up to a few hundred
  // rows this is the simplest correct approach. Bulk via RPC/values join
  // is the upgrade path when this gets slow.
  for (const w of words) {
    const k = kindMap[w.toLowerCase()];
    if (!k) continue;
    await supabase
      .from("user_keywords")
      .update({ kind: k })
      .eq("user_id", user.id)
      .eq("word", w);
    classified++;
  }
  if (classified > 0) revalidatePath("/workspace");
  return { classified };
}

// Calls Gemini once with a batch of words and returns a lowercased-word →
// canonical-kind mapping. Empty object on any failure — callers should
// treat missing keys as "unclassified, leave null".
async function classifyKinds(words: string[]): Promise<Record<string, string>> {
  if (!words.length) return {};
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[classifyKinds] GEMINI_API_KEY not set");
    return {};
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildClassifyPrompt(words) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });
  } catch (e) {
    console.error("[classifyKinds] fetch failed", e);
    return {};
  }
  if (!res.ok) {
    console.error("[classifyKinds] non-2xx", res.status, await res.text());
    return {};
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("[classifyKinds] non-JSON text", text);
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    const norm = normalizeKind(v);
    if (norm) out[k.toLowerCase()] = norm;
  }
  return out;
}

export async function removeKeyword(word: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("user_keywords")
    .delete()
    .eq("user_id", user.id)
    .eq("word", word);
  revalidatePath("/workspace");
}

export async function setKeywordKind(word: string, kind: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("user_keywords")
    .update({ kind })
    .eq("user_id", user.id)
    .eq("word", word);
  revalidatePath("/workspace");
}

export async function recategorizeKeyword(
  word: string,
  category: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("user_keywords")
    .update({ category })
    .eq("user_id", user.id)
    .eq("word", word);
  revalidatePath("/workspace");
}

export async function updateKeyword(oldWord: string, newWord: string) {
  const trimmed = normalizeWord(newWord);
  if (!trimmed || trimmed === oldWord) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("user_keywords")
    .update({ word: trimmed })
    .eq("user_id", user.id)
    .eq("word", oldWord);
  if (error) {
    // Most likely a unique-constraint conflict (new word already saved).
    // Drop the old row so the user keeps the existing one.
    if (error.code === "23505") {
      await supabase
        .from("user_keywords")
        .delete()
        .eq("user_id", user.id)
        .eq("word", oldWord);
    }
  }
  revalidatePath("/workspace");
}
