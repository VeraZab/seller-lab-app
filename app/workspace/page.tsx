import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceClient from "./workspace-client";
import {
  signOut,
  removeKeyword,
  updateKeyword,
  recategorizeKeyword,
  addKeywords,
} from "./actions";

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

  const { data: keywordRows } = await supabase
    .from("user_keywords")
    .select("word, category, frequency")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = keywordRows ?? [];
  const buckets = groupByCharCount(rows);
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
    />
  );
}

type RawRow = {
  word: string;
  category: string | null;
  frequency: number | null;
};

function groupByCharCount(rows: RawRow[]) {
  const map = new Map<number, RawRow[]>();
  for (const r of rows) {
    const n = r.word.length;
    const list = map.get(n) ?? [];
    list.push(r);
    map.set(n, list);
  }
  return Array.from(map, ([charCount, words]) => ({
    charCount,
    words: words.map((w) => ({
      word: w.word,
      category: w.category,
      frequency: w.frequency ?? 1,
    })),
  })).sort((a, b) => a.charCount - b.charCount);
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
