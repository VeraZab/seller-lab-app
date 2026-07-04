import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceClient from "./workspace-client";
import {
  signOut,
  removeKeyword,
  updateKeyword,
  recategorizeKeyword,
  addKeywords,
  importKeywordsFromCsv,
  classifyMissingKindsForCurrentUser,
  setKeywordKind,
} from "./actions";
import {
  UNCATEGORIZED_KIND,
  KIND_DISPLAY_ORDER,
} from "./kinds";

export default async function WorkspacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/workspace");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  // Workspace is a paid-only surface. Unpaid sessions get bounced to the
  // marketing page (no in-app upgrade flow yet).
  if (profile?.plan !== "paid") {
    redirect("/");
  }

  const initialFetch = await supabase
    .from("user_keywords")
    .select("word, category, frequency, kind")
    .eq("user_id", user.id)
    .eq("hidden", false)
    .order("created_at", { ascending: false });

  let rows = initialFetch.data ?? [];
  // Any rows with kind=null need the Gemini classifier. We used to run
  // it inline (blocking the render for 2-5s while Gemini responded).
  // Now we pass a flag to the client, which fires the action after mount
  // via a transition and refreshes the page when classification returns.
  // Result: page renders instantly with unclassified rows in the
  // Uncategorized bucket, then those pills move to their real buckets
  // moments later without a page reload.
  const hasUnclassified = rows.some(
    (r: { kind: string | null }) => !r.kind,
  );
  // Auto-harvest sold tokens into the keyword library. For every distinct
  // word that appears on a sold design's tags, we make sure it exists in
  // user_keywords with category='sold' and frequency=sale-count. The
  // existing Sold heatmap rendering (uses `frequency`) tints these pills
  // in shades of sage. Idempotent — sales_events dedup means re-uploads
  // can't inflate the counts.
  await refreshSoldKeywords(supabase, user.id, rows);

  // Re-fetch after upsert so the buckets rendered include any freshly
  // harvested sold tokens.
  const refreshed = await supabase
    .from("user_keywords")
    .select("word, category, frequency, kind")
    .eq("user_id", user.id)
    .eq("hidden", false)
    .order("created_at", { ascending: false });
  rows = refreshed.data ?? rows;

  const buckets = groupByKind(rows);
  const heatMaxByCategory = computeHeatMaxByCategory(rows);

  const plan = profile?.plan === "paid" ? "paid" : "free";
  const email = user.email ?? "";
  const displayName = displayNameFromEmail(email);
  const initial = (displayName[0] ?? "?").toUpperCase();

  return (
    <WorkspaceClient
      user={{ email, displayName, initial, plan }}
      buckets={buckets}
      heatMaxByCategory={heatMaxByCategory}
      hasUnclassified={hasUnclassified}
      classifyMissingKinds={classifyMissingKindsForCurrentUser}
      signOut={signOut}
      removeKeyword={removeKeyword}
      updateKeyword={updateKeyword}
      recategorizeKeyword={recategorizeKeyword}
      addKeywords={addKeywords}
      importKeywordsFromCsv={importKeywordsFromCsv}
      setKeywordKind={setKeywordKind}
    />
  );
}

type RawRow = {
  word: string;
  category: string | null;
  frequency: number | null;
  kind: string | null;
};

function groupByKind(rows: RawRow[]) {
  const map = new Map<string, RawRow[]>();
  for (const r of rows) {
    const key = r.kind || UNCATEGORIZED_KIND;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return Array.from(map, ([kind, words]) => ({
    kind,
    words: words.map((w) => ({
      word: w.word,
      category: w.category,
      frequency: w.frequency ?? 1,
    })),
  })).sort((a, b) => {
    const ra = KIND_DISPLAY_ORDER.indexOf(a.kind);
    const rb = KIND_DISPLAY_ORDER.indexOf(b.kind);
    const ar = ra === -1 ? KIND_DISPLAY_ORDER.length : ra;
    const br = rb === -1 ? KIND_DISPLAY_ORDER.length : rb;
    return ar - br;
  });
}

function computeHeatMaxByCategory(rows: RawRow[]): Record<string, number> {
  const max: Record<string, number> = {};
  for (const r of rows) {
    if (!r.category) continue;
    const key = r.category;
    const freq = r.frequency ?? 1;
    if (freq > (max[key] ?? 0)) max[key] = freq;
  }
  return max;
}

// Compute per-token sale counts across the user's sold designs, then
// upsert those into user_keywords so the Sold heatmap paints them
// automatically. Idempotent: sales_events dedup ensures re-uploads
// don't double-count. Words the user has already saved under a
// different category (Trend, User Saved, etc.) are left alone —
// respecting the user's manual classification.
async function refreshSoldKeywords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  existingRows: {
    word: string;
    category: string | null;
    frequency: number | null;
  }[],
): Promise<void> {
  // Pull sales with the design title so we can tokenize titles too — a
  // discoverable word in a title still helps sell the design even if
  // scraping hasn't found the Spoonflower tags yet.
  const { data: soldEvents } = await supabase
    .from("sales_events")
    .select("design_id, design_title")
    .eq("user_id", userId)
    .eq("type", "sale")
    .not("design_id", "is", null);

  const salesPerDesign = new Map<number, number>();
  const titleByDesign = new Map<number, string>();
  for (const s of (soldEvents ?? []) as {
    design_id: number;
    design_title: string | null;
  }[]) {
    salesPerDesign.set(
      s.design_id,
      (salesPerDesign.get(s.design_id) ?? 0) + 1,
    );
    if (s.design_title && !titleByDesign.has(s.design_id)) {
      titleByDesign.set(s.design_id, s.design_title);
    }
  }
  if (salesPerDesign.size === 0) return;

  const { data: designTags } = await supabase
    .from("spoonflower_designs")
    .select("design_id, tags")
    .in("design_id", Array.from(salesPerDesign.keys()));

  const tagsByDesign = new Map<number, string[]>();
  for (const d of (designTags ?? []) as {
    design_id: number;
    tags: string[] | null;
  }[]) {
    if (d.tags?.length) tagsByDesign.set(d.design_id, d.tags);
  }

  // Fetch existing words BEFORE tokenizing so we can extract user-defined
  // phrases (words with hyphens). Phrases drive multi-word matching in
  // the tokenizer — e.g. "block-print" makes the tag "block print" emit
  // as one token instead of two.
  const { data: allExisting } = await supabase
    .from("user_keywords")
    .select("word, category, frequency, hidden")
    .eq("user_id", userId);
  const existingByWord = new Map<
    string,
    { category: string | null; frequency: number | null; hidden: boolean }
  >();
  const phrases: string[] = [];
  for (const r of (allExisting ?? []) as {
    word: string;
    category: string | null;
    frequency: number | null;
    hidden: boolean;
  }[]) {
    existingByWord.set(r.word.toLowerCase(), r);
    // Include hidden phrases too — user marked them dead, but the phrase
    // still needs to fold constituents to avoid re-adding them as
    // separate sold pills. Just don't emit the phrase itself.
    if (r.word.includes("-")) phrases.push(r.word.toLowerCase());
  }
  const hiddenSet = new Set(
    (allExisting ?? [])
      .filter((r: { hidden: boolean }) => r.hidden)
      .map((r: { word: string }) => r.word.toLowerCase()),
  );

  const tokenCounts = new Map<string, number>();
  for (const [designId, saleCount] of salesPerDesign) {
    // Tokenize both tags AND the design title. SKU tokens (zab*) are
    // stripped. Multi-word user phrases (e.g. "block-print") collapse
    // matching runs so constituent words don't get double-counted.
    // A design with no scraped tags yet still contributes title tokens
    // so the Sold heatmap fills in immediately after CSV upload rather
    // than waiting on scrape completion.
    const tokens = extractTokensFromTitleAndTags(
      tagsByDesign.get(designId),
      titleByDesign.get(designId) ?? null,
      phrases,
    );
    if (tokens.size === 0) continue;
    for (const tok of tokens) {
      // Skip phrase emissions the user has hidden — they don't want the
      // merged pill either, so respect that.
      if (hiddenSet.has(tok)) continue;
      tokenCounts.set(tok, (tokenCounts.get(tok) ?? 0) + saleCount);
    }
  }
  if (tokenCounts.size === 0) return;

  const rowsToUpsert: {
    user_id: string;
    word: string;
    category: string;
    frequency: number;
  }[] = [];
  for (const [word, count] of tokenCounts) {
    const existing = existingByWord.get(word);
    if (existing?.hidden) {
      // User explicitly removed this word — leave it alone. If they
      // want it back they'll add it via the AddKeywordsBar, which
      // un-hides.
      continue;
    }
    if (!existing) {
      // New word — insert as Sold with the sale count as frequency.
      rowsToUpsert.push({
        user_id: userId,
        word,
        category: "sold",
        frequency: count,
      });
    } else if (existing.category === "sold" && existing.frequency !== count) {
      // Existing Sold row with drifted count — refresh.
      rowsToUpsert.push({
        user_id: userId,
        word,
        category: "sold",
        frequency: count,
      });
    }
  }

  // Log to dev terminal so we can see whether the pipeline is producing.
  // If tokenCounts is 0, scraping hasn't populated tags yet. If
  // tokenCounts > 0 but rowsToUpsert is 0, everything's already saved
  // under a non-sold category and we're leaving those alone (working
  // as intended). If rowsToUpsert > 0, this run is inserting fresh
  // sold heatmap rows.
  console.log(
    `[refreshSoldKeywords] sold designs=${salesPerDesign.size}, ` +
      `designs_with_tags=${(designTags ?? []).filter((d) => (d.tags ?? []).length > 0).length}, ` +
      `distinct_tokens=${tokenCounts.size}, ` +
      `upserts=${rowsToUpsert.length}`,
  );
  if (rowsToUpsert.length > 0) {
    const { error } = await supabase
      .from("user_keywords")
      .upsert(rowsToUpsert, { onConflict: "user_id,word" });
    if (error) {
      console.error("[refreshSoldKeywords] upsert failed", error);
    }
  }
}

// Extract discoverability tokens for a design, drawing from BOTH the
// Spoonflower tags AND the design title. SKU codes like `ZAB25024` are
// stripped since they're internal identifiers, not real keywords.
// `phrases` are user-defined hyphenated tokens (e.g. "block-print") —
// any tag/title span matching the phrase (hyphenated OR space-separated)
// is folded into one emitted phrase token and its constituent single
// tokens are NOT emitted. Keep in sync with extractSaleTokens() in
// app/analytics/stats.ts — same rule, different call site.
function extractTokensFromTitleAndTags(
  tags: string[] | undefined,
  title: string | null,
  phrases: string[] = [],
): Set<string> {
  const tokens = new Set<string>();
  const sources: string[] = [];
  if (tags?.length) sources.push(...tags);
  if (title) sources.push(title);
  const sortedPhrases = [...phrases].sort((a, b) => b.length - a.length);
  for (const phrase of sources) {
    let text = phrase.trim().toLowerCase();
    for (const p of sortedPhrases) {
      const hy = p.toLowerCase();
      const sp = hy.replace(/-/g, " ");
      const pattern = new RegExp(
        `\\b(?:${escapeRegExp(sp)}|${escapeRegExp(hy)})\\b`,
        "g",
      );
      text = text.replace(pattern, () => {
        tokens.add(hy);
        return " ";
      });
    }
    for (const t of text.split(/\s+/)) {
      const tok = t.trim();
      if (tok.length < 2) continue;
      if (/^zab[a-z0-9]*$/i.test(tok)) continue;
      tokens.add(tok);
    }
  }
  return tokens;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayNameFromEmail(email: string): string {
  if (!email) return "Signed in";
  const local = email.split("@")[0] ?? email;
  return local.length > 18 ? `${local.slice(0, 17)}…` : local;
}
