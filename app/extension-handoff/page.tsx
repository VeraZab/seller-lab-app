import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HandoffClient } from "./handoff-client";

// Depends on cookies and pushes session tokens to the extension — never cache.
export const dynamic = "force-dynamic";

export default async function ExtensionHandoffPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/extension-handoff");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect("/sign-in?next=/extension-handoff");
  }

  return (
    <HandoffClient
      extensionId={process.env.NEXT_PUBLIC_EXTENSION_ID ?? ""}
      email={user.email ?? ""}
      tokens={{
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }}
    />
  );
}
