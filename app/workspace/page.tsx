import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceClient from "./workspace-client";
import { signOut } from "./actions";

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

  const plan = profile?.plan === "paid" ? "paid" : "free";
  const email = user.email ?? "";
  const displayName = displayNameFromEmail(email);
  const initial = (displayName[0] ?? "?").toUpperCase();

  return (
    <WorkspaceClient
      user={{ email, displayName, initial, plan }}
      signOut={signOut}
    />
  );
}

function displayNameFromEmail(email: string): string {
  if (!email) return "Signed in";
  const local = email.split("@")[0] ?? email;
  return local.length > 18 ? `${local.slice(0, 17)}…` : local;
}
