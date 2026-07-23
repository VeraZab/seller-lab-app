import Stripe from "stripe";

// Singleton Stripe client. The current app only uses Stripe for
// webhook signature verification — the "Get Pro" button links straight
// to a hosted Stripe Payment Link, so we don't call the Stripe API
// server-side. Signature verification doesn't hit the network, so a
// dummy key is fine if STRIPE_SECRET_KEY isn't set.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY ?? "sk_dummy_for_signature_verification_only";
  cached = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return cached;
}
