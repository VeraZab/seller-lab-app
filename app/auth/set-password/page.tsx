"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icon";
import { LogoMeadow } from "@/components/logo-meadow";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "no-session" }
  | { kind: "error"; message: string }
  | { kind: "done" };

// Landing page after clicking a password-reset email link. The auth
// callback route exchanged the recovery code for a full session before
// redirecting here, so we just need to prompt for the new password and
// call updateUser.
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setStatus({ kind: "no-session" });
        return;
      }
      setStatus({ kind: "idle" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setStatus({ kind: "error", message: "Pick a password at least 6 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ kind: "error", message: "Passwords don't match." });
      return;
    }
    setStatus({ kind: "busy" });
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setStatus({ kind: "done" });
    // Short pause so the "done" state is visible, then send to workspace.
    setTimeout(() => {
      router.push("/workspace");
      router.refresh();
    }, 800);
  };

  const busy = status.kind === "busy";

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
            <div className="eyebrow">Set password</div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 500,
                fontSize: 28,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "var(--ink-900)",
                margin: 0,
              }}
            >
              Pick a new password
            </h1>
          </div>

          {status.kind === "checking" && (
            <div style={{ textAlign: "center", color: "var(--ink-500)", fontSize: 13 }}>
              Verifying reset link…
            </div>
          )}

          {status.kind === "no-session" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="alert alert--warn" role="alert">
                <div className="alert__title">This link isn&rsquo;t active</div>
                <div style={{ fontSize: 13 }}>
                  Password-reset links expire after a while. Ask for a new one.
                </div>
              </div>
              <Link
                href="/sign-in?mode=forgot"
                className="btn btn--accent btn--sm"
                style={{ justifyContent: "center" }}
              >
                Send a new reset email
              </Link>
            </div>
          )}

          {status.kind === "done" && (
            <div className="alert alert--success" role="status">
              <div className="alert__title">Password saved</div>
              <div style={{ fontSize: 13 }}>Taking you to your workspace…</div>
            </div>
          )}

          {(status.kind === "idle" || status.kind === "busy" || status.kind === "error") && (
            <form
              onSubmit={onSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="new-password"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--ink-700)",
                  }}
                >
                  New password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    autoFocus
                    minLength={6}
                    placeholder="6+ characters"
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
                    style={eyeButtonStyle}
                  >
                    <EyeToggleIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="confirm-password"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--ink-700)",
                  }}
                >
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  minLength={6}
                  placeholder="Type it again"
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                />
              </div>

              {status.kind === "error" && (
                <div className="alert alert--error" role="alert">
                  <div className="alert__title">Couldn&rsquo;t save password</div>
                  <div style={{ fontSize: 13 }}>{status.message}</div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn--accent btn--lg"
                style={{ marginTop: 4, width: "100%" }}
                disabled={busy || !password || password !== confirmPassword}
              >
                {busy ? (
                  <>
                    <span className="spin" style={{ display: "inline-flex" }}>
                      <Icon name="sparkle" size={14} />
                    </span>
                    Saving…
                  </>
                ) : (
                  "Save password"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

const eyeButtonStyle: React.CSSProperties = {
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
};

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
