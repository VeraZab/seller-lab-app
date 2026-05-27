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

  let { data: keywordRows } = await supabase
    .from("user_keywords")
    .select("word, category, frequency, kind")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // First-load backfill: if any rows are missing `kind` (e.g. after the
  // schema change or from extension writes that bypass addKeywords), run
  // one Gemini classify call inline. This makes the first view slightly
  // slower (~2-5s) but every subsequent load is instant.
  const hasUnclassified = (keywordRows ?? []).some(
    (r: { kind: string | null }) => !r.kind,
  );
  if (hasUnclassified) {
    await classifyMissingKindsForCurrentUser();
    const refetched = await supabase
      .from("user_keywords")
      .select("word, category, frequency, kind")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    keywordRows = refetched.data;
  }

  const rows = keywordRows ?? [];
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

function displayNameFromEmail(email: string): string {
  if (!email) return "Signed in";
  const local = email.split("@")[0] ?? email;
  return local.length > 18 ? `${local.slice(0, 17)}…` : local;
}
