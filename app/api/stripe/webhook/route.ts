import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

// Stripe webhook — this is where a paying customer's account is
// actually created. Flow:
//   1. checkout.session.completed fires when the subscription payment
//      succeeds.
//   2. We read customer_email from the session.
//   3. We create (or reuse) an auth.users row via the admin API, mark
//      email_confirmed_at, and upsert their profiles row with
//      plan='paid' + Stripe IDs.
//   4. We generate a recovery link so the customer picks their
//      password on our /auth/set-password page.
//   5. We ask Supabase to email that link (uses the Auth email
//      template — default is fine, or customize in the dashboard).
//
// Also handles subscription cancellation/deletion → flips profile.plan
// back to 'free' so the workspace redirect gate kicks in.
//
// Env vars required:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET       — from Stripe dashboard → Webhooks → your endpoint
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   — service role, NOT the anon key
//   NEXT_PUBLIC_APP_URL         — where the set-password link redirects to

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error("[stripe/webhook] signature verification failed", e);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionChange(
          event.data.object as Stripe.Subscription,
        );
        break;
      }
      default:
        // Don't log every event type; only the ones we handle. Everything
        // else is a silent 200 — Stripe just needs an ack.
        break;
    }
  } catch (e) {
    console.error(`[stripe/webhook] ${event.type} handler failed`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email =
    session.customer_details?.email ??
    session.customer_email ??
    (typeof session.customer === "string" || !session.customer
      ? null
      : "email" in session.customer
        ? (session.customer.email as string | null)
        : null);
  if (!email) {
    throw new Error("Checkout session has no customer email");
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  const supabase = adminSupabase();

  // Look up or create the auth.users row. `getUserByEmail` doesn't
  // exist directly — we list with a filter. For a small user base
  // this is fine; for larger use `list` with pagination + email filter.
  const { data: existingList, error: listErr } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (listErr) throw listErr;
  const existing = existingList.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    // Create with email_confirm so they don't have to click a
    // confirmation email — they'll instead click the recovery link
    // to set their password.
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          stripe_customer_id: stripeCustomerId ?? undefined,
        },
      });
    if (createErr || !created.user) {
      throw createErr ?? new Error("Failed to create auth user");
    }
    userId = created.user.id;
  }

  // Upsert the profiles row with plan='paid' and Stripe IDs. Assumes
  // the profiles table has (id, plan, stripe_customer_id,
  // stripe_subscription_id). Add columns via a migration if missing.
  const { error: profileErr } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        plan: "paid",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
      },
      { onConflict: "id" },
    );
  if (profileErr) throw profileErr;

  // Only new users get a set-password email. Returning customers with
  // a password already keep it.
  if (!existing) {
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/set-password`;
    const { error: linkErr } =
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
    if (linkErr) {
      // Not fatal — user can always click "Forgot password" on
      // sign-in. Log for visibility.
      console.error("[stripe/webhook] generateLink failed", linkErr);
    }
    // generateLink returns the link but does NOT send an email by
    // itself in every configuration. Trigger the templated email:
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    );
    if (resetErr) {
      console.error("[stripe/webhook] resetPasswordForEmail failed", resetErr);
    }
  }
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const supabase = adminSupabase();
  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Look up the profiles row by stripe_customer_id.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (!profile) return; // Nothing to update — user might have been deleted.

  // Active + trialing keep the account paid. Anything else → free.
  const paidStatuses = new Set<Stripe.Subscription.Status>([
    "active",
    "trialing",
    "past_due", // grace-period — keep access; Stripe will retry.
  ]);
  const plan = paidStatuses.has(sub.status) ? "paid" : "free";

  await supabase
    .from("profiles")
    .update({
      plan,
      stripe_subscription_id: sub.id,
    })
    .eq("id", profile.id);
}

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client not configured (need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
