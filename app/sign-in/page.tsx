"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icon";
import { LogoMeadow } from "@/components/logo-meadow";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "no-account"; email: string }
  | { kind: "error"; message: string };

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInPageInner />
    </Suspense>
  );
}

function SignInPageInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/workspace";
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(() =>
    callbackError ? { kind: "error", message: callbackError } : { kind: "idle" },
  );

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setStatus({ kind: "sending" });
    const supabase = createClient();

    // Pre-flight: is this email a paid account? If not, don't send any email —
    // tell the user immediately. Supabase's shouldCreateUser:false flag
    // silently no-ops on unknown emails (anti-enumeration), so we can't rely
    // on the OTP response to detect this.
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

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });

    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setStatus({ kind: "sent", email: trimmed });
  };

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
            <div className="eyebrow">Sign in</div>
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
              Welcome back to{" "}
              <em style={{ fontStyle: "italic" }}>Seller Lab.</em>
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--ink-500)",
                margin: "4px 0 0",
                lineHeight: 1.5,
                maxWidth: 320,
              }}
            >
              We&rsquo;ll email you a magic link &mdash; no password to
              remember.
            </p>
          </div>

          {status.kind === "sent" ? (
            <SentState
              email={status.email}
              next={next}
              onReset={() => setStatus({ kind: "idle" })}
            />
          ) : status.kind === "no-account" ? (
            <NoAccountState
              email={status.email}
              onReset={() => setStatus({ kind: "idle" })}
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
                  disabled={status.kind === "sending"}
                />
              </div>

              {status.kind === "error" && (
                <div className="alert alert--error" role="alert">
                  <div className="alert__title">Couldn&rsquo;t send link</div>
                  <div style={{ fontSize: 13 }}>{status.message}</div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn--accent btn--lg"
                style={{ marginTop: 4, width: "100%" }}
                disabled={status.kind === "sending"}
              >
                {status.kind === "sending" ? (
                  <>
                    <span className="spin" style={{ display: "inline-flex" }}>
                      <Icon name="sparkle" size={14} />
                    </span>
                    Sending…
                  </>
                ) : (
                  "Send magic link"
                )}
              </button>

              <p
                style={{
                  fontSize: 12,
                  color: "var(--ink-500)",
                  margin: "6px 0 0",
                  lineHeight: 1.5,
                }}
              >
                By signing in you agree to the{" "}
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

function SentState({
  email,
  next,
  onReset,
}: {
  email: string;
  next: string;
  onReset: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const onVerifyCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 6) return;

    setVerifying(true);
    setCodeError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) {
      setCodeError(error.message);
      setVerifying(false);
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="alert alert--success" role="status">
        <div className="alert__title">Check your inbox</div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          We sent a link to{" "}
          <strong style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
            {email}
          </strong>
          . Open it in this browser to finish signing in.
        </div>
      </div>

      {!showCode ? (
        <button
          type="button"
          onClick={() => setShowCode(true)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 12.5,
            color: "var(--ink-500)",
            cursor: "pointer",
            textAlign: "left",
            textDecoration: "underline",
            textDecorationStyle: "dotted",
            textUnderlineOffset: 3,
            alignSelf: "flex-start",
          }}
        >
          Or have the 6-digit code? Enter it here.
        </button>
      ) : (
        <form
          onSubmit={onVerifyCode}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
          }}
        >
          <label
            htmlFor="otp-code"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--ink-700)",
              marginTop: 6,
            }}
          >
            6-digit code from the email
          </label>
          <input
            id="otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            maxLength={6}
            className="input"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            disabled={verifying}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 18,
              letterSpacing: "0.4em",
              textAlign: "center",
              paddingLeft: 12,
            }}
          />
          {codeError && (
            <div className="help help--error">{codeError}</div>
          )}
          <button
            type="submit"
            className="btn btn--accent btn--sm"
            disabled={verifying || code.length < 6}
            style={{ marginTop: 4 }}
          >
            {verifying ? (
              <>
                <span className="spin" style={{ display: "inline-flex" }}>
                  <Icon name="sparkle" size={12} />
                </span>
                Verifying...
              </>
            ) : (
              "Verify and sign in"
            )}
          </button>
        </form>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={onReset}
        style={{ alignSelf: "flex-start" }}
      >
        Use a different email
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
