"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icon";
import { LogoMeadow } from "@/components/logo-meadow";
import { createClient } from "@/lib/supabase/client";

// Only two modes on this page: standard sign-in and forgot-password.
// Account creation lives inside the Stripe Checkout → webhook flow,
// not here — a paying customer's account is provisioned server-side
// and they land here to sign in for the first time.
type Mode = "sign-in" | "forgot";

type Status =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "no-account"; email: string }
  | { kind: "error"; message: string }
  | { kind: "reset-sent"; email: string };

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInPageInner />
    </Suspense>
  );
}

function SignInPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/workspace";
  const initialMode = (searchParams.get("mode") as Mode) ?? "sign-in";
  const callbackError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>(
    initialMode === "forgot" ? "forgot" : "sign-in",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>(() =>
    callbackError ? { kind: "error", message: callbackError } : { kind: "idle" },
  );

  const switchMode = (next: Mode) => {
    setMode(next);
    setStatus({ kind: "idle" });
    setPassword("");
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    const supabase = createClient();

    if (mode === "sign-in") {
      if (!password) return;
      setStatus({ kind: "busy" });

      // Pre-flight: is this email a paid account? If not, tell the
      // user immediately rather than surfacing a generic "invalid
      // credentials" — password auth's error doesn't distinguish
      // "wrong password" from "unknown user".
      const { data: hasPaid, error: rpcError } = await supabase.rpc(
        "email_has_paid_account",
        { p_email: trimmed },
      );
      if (rpcError) {
        setStatus({ kind: "error", message: rpcError.message });
        return;
      }
      if (!hasPaid) {
        setStatus({ kind: "no-account", email: trimmed });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) {
        setStatus({ kind: "error", message: error.message });
        return;
      }
      router.push(next);
      router.refresh();
      return;
    }

    // mode === "forgot"
    setStatus({ kind: "busy" });
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/set-password`,
    });
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setStatus({ kind: "reset-sent", email: trimmed });
  };

  const busy = status.kind === "busy";

  const headline =
    mode === "forgot" ? (
      "Reset your password"
    ) : (
      <>
        Welcome back to{" "}
        <em style={{ fontStyle: "italic" }}>Seller Lab.</em>
      </>
    );
  const eyebrow = mode === "forgot" ? "Forgot password" : "Sign in";
  const submitLabel = mode === "forgot" ? "Send reset link" : "Sign in";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-body)",
        color: "var(--ink-900)",
      }}
    >
      <LogoMeadow mask="card" />

      <header
        style={{
          position: "relative",
          padding: "22px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BrandLockup href="/" size={28} fontSize={18} />
        <Link
          href="/"
          style={{
            fontSize: 13,
            color: "var(--ink-500)",
            textDecoration: "none",
          }}
        >
          ← Back to home
        </Link>
      </header>

      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 22px 60px",
        }}
      >
        <div
          className="s-card"
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 420,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 6,
            }}
          >
            <Image
              src="/assets/logo.svg"
              alt=""
              width={28}
              height={28}
              style={{ width: 28, height: 28, marginBottom: 4 }}
            />
            <div className="eyebrow">{eyebrow}</div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 500,
                fontSize: 30,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "var(--ink-900)",
                margin: 0,
              }}
            >
              {headline}
            </h1>
            {mode === "forgot" && (
              <p style={{ fontSize: 13, color: "var(--ink-500)", margin: "6px 0 0", lineHeight: 1.5, maxWidth: 320 }}>
                We&rsquo;ll email you a link to pick a new password.
              </p>
            )}
          </div>

          {status.kind === "no-account" ? (
            <NoAccountState
              email={status.email}
              onReset={() => switchMode("sign-in")}
            />
          ) : status.kind === "reset-sent" ? (
            <SentState
              title="Check your inbox"
              email={status.email}
              detail="Open the link to pick a new password."
              onReset={() => switchMode("sign-in")}
            />
          ) : (
            <form
              onSubmit={onSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <label
                htmlFor="email"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--ink-700)",
                }}
              >
                Email
              </label>
              <div className="field-icon-wrap">
                <span
                  style={{
                    position: "absolute",
                    left: 11,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--ink-500)",
                    display: "inline-flex",
                  }}
                >
                  <Icon name="mail" size={14} />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  inputMode="email"
                  placeholder="you@studio.com"
                  className="input input--with-icon"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>

              {mode !== "forgot" && (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginTop: 4,
                    }}
                  >
                    <label
                      htmlFor="password"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--ink-700)",
                      }}
                    >
                      Password
                    </label>
                    {mode === "sign-in" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          fontSize: 11.5,
                          color: "var(--ink-500)",
                          textDecoration: "underline",
                          textDecorationStyle: "dotted",
                          textUnderlineOffset: 3,
                          cursor: "pointer",
                        }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Your password"
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--ink-500)",
                        padding: 0,
                        borderRadius: 6,
                      }}
                    >
                      <EyeToggleIcon open={showPassword} />
                    </button>
                  </div>
                </>
              )}

              {status.kind === "error" && (
                <div className="alert alert--error" role="alert">
                  <div className="alert__title">
                    {mode === "forgot"
                      ? "Couldn't send reset link"
                      : "Couldn't sign in"}
                  </div>
                  <div style={{ fontSize: 13 }}>{status.message}</div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn--accent btn--lg"
                style={{ marginTop: 4, width: "100%" }}
                disabled={
                  busy ||
                  !email.trim() ||
                  (mode !== "forgot" && !password)
                }
              >
                {busy ? (
                  <>
                    <span className="spin" style={{ display: "inline-flex" }}>
                      <Icon name="sparkle" size={14} />
                    </span>
                    {mode === "forgot" ? "Sending…" : "Signing in…"}
                  </>
                ) : (
                  submitLabel
                )}
              </button>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 12.5,
                  color: "var(--ink-500)",
                  marginTop: 6,
                }}
              >
                {mode === "sign-in" && (
                  <>
                    New here?{" "}
                    <Link href="/#pricing" style={{ ...linkButtonStyle, textDecoration: "underline" }}>
                      Get PRO
                    </Link>
                  </>
                )}
                {mode === "forgot" && (
                  <button
                    type="button"
                    onClick={() => switchMode("sign-in")}
                    style={linkButtonStyle}
                  >
                    ← Back to sign in
                  </button>
                )}
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: "var(--ink-500)",
                  margin: "6px 0 0",
                  lineHeight: 1.5,
                }}
              >
                By continuing you agree to the{" "}
                <Link
                  href="/terms"
                  style={{ color: "var(--ink-700)" }}
                >
                  terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  style={{ color: "var(--ink-700)" }}
                >
                  privacy policy
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

// Eye icon that switches between "open" (password visible) and
// "closed with slash" (password hidden). Inline SVG so no new asset
// dependency.
function EyeToggleIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
      <circle cx="10" cy="10" r="2.5" />
      {!open && <line x1="3" y1="17" x2="17" y2="3" />}
    </svg>
  );
}

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: 12.5,
  color: "var(--ink-700)",
  textDecoration: "underline",
  textDecorationStyle: "dotted",
  textUnderlineOffset: 3,
  cursor: "pointer",
};

function SentState({
  title,
  email,
  detail,
  onReset,
}: {
  title: string;
  email: string;
  detail: string;
  onReset: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="alert alert--success" role="status">
        <div className="alert__title">{title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          Sent to{" "}
          <strong style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
            {email}
          </strong>
          . {detail}
        </div>
      </div>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={onReset}
        style={{ alignSelf: "flex-start" }}
      >
        ← Back to sign in
      </button>
    </div>
  );
}

function NoAccountState({ onReset }: { email: string; onReset: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="alert alert--warn" role="alert">
        <div className="alert__title">No PRO account on that email</div>
        <div style={{ fontSize: 13 }}>
          Seller Lab PRO is paid &mdash; sign in works once you&rsquo;ve
          checked out.
        </div>
      </div>
      <Link
        href="/#pricing"
        className="btn btn--pro btn--lg"
        style={{ width: "100%", justifyContent: "center" }}
      >
        Get PRO
      </Link>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={onReset}
        style={{ alignSelf: "flex-start" }}
      >
        Try a different email
      </button>
    </div>
  );
}
