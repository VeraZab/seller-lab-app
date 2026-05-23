"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function addKeywords(
  entries: { word: string; category: string | null }[],
) {
  if (!entries.length) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const seen = new Set<string>();
  const rows = entries
    .map((e) => ({
      user_id: user.id,
      word: e.word.trim(),
      category: e.category?.trim() || null,
    }))
    .filter((e) => {
      if (!e.word) return false;
      if (seen.has(e.word)) return false;
      seen.add(e.word);
      return true;
    });

  if (!rows.length) return;

  await supabase
    .from("user_keywords")
    .upsert(rows, { onConflict: "user_id,word", ignoreDuplicates: true });
  revalidatePath("/workspace");
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
  const trimmed = newWord.trim();
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
