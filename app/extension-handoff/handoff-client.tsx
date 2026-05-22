"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icon";
import { LogoMeadow } from "@/components/logo-meadow";

type Tokens = { access_token: string; refresh_token: string };

type Status =
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "no-extension-id" }
  | { kind: "unreachable" };

export function HandoffClient({
  extensionId,
  email,
  tokens,
}: {
  extensionId: string;
  email: string;
  tokens: Tokens;
}) {
  const [status, setStatus] = useState<Status>({ kind: "sending" });

  useEffect(() => {
    if (!extensionId) {
      setStatus({ kind: "no-extension-id" });
      return;
    }
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      setStatus({ kind: "unreachable" });
      return;
    }

    try {
      chrome.runtime.sendMessage(
        extensionId,
        { type: "sl_session", tokens },
        (response) => {
          if (chrome?.runtime?.lastError) {
            setStatus({ kind: "unreachable" });
            return;
          }
          const r = response as { ok?: boolean } | undefined;
          if (r && r.ok === false) {
            setStatus({ kind: "unreachable" });
            return;
          }
          setStatus({ kind: "sent" });
        },
      );
    } catch {
      setStatus({ kind: "unreachable" });
    }
  }, [extensionId, tokens]);

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
          href="/workspace"
          style={{
            fontSize: 13,
            color: "var(--ink-500)",
            textDecoration: "none",
          }}
        >
          Go to workspace →
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
            maxWidth: 440,
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
            <div className="eyebrow">Extension sign-in</div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 500,
                fontSize: 28,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                color: "var(--ink-900)",
                margin: 0,
              }}
            >
              {status.kind === "sent" ? (
                <>
                  You&rsquo;re{" "}
                  <em style={{ fontStyle: "italic" }}>connected.</em>
                </>
              ) : (
                <>
                  Connecting{" "}
                  <em style={{ fontStyle: "italic" }}>Seller Lab.</em>
                </>
              )}
            </h1>
            <p
              style={{
                fontSize: 13.5,
                color: "var(--ink-500)",
                margin: "4px 0 0",
                lineHeight: 1.5,
                maxWidth: 340,
              }}
            >
              Signed in as{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                {email}
              </span>
            </p>
          </div>

          <StatusBlock status={status} />
        </div>
      </div>
    </main>
  );
}

function StatusBlock({ status }: { status: Status }) {
  if (status.kind === "sending") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "20px 0",
          color: "var(--ink-500)",
          fontSize: 13.5,
        }}
      >
        <span className="spin" style={{ display: "inline-flex" }}>
          <Icon name="sparkle" size={14} />
        </span>
        Handing off your session to the extension…
      </div>
    );
  }

  if (status.kind === "sent") {
    return (
      <div className="alert alert--success" role="status">
        <div className="alert__title">All set</div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          The extension has your session. You can close this tab and head back
          to Spoonflower.
        </div>
      </div>
    );
  }

  if (status.kind === "no-extension-id") {
    return (
      <div className="alert alert--warn" role="alert">
        <div className="alert__title">Extension ID isn&rsquo;t configured</div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          Set <code>NEXT_PUBLIC_EXTENSION_ID</code> in the environment and
          redeploy.
        </div>
      </div>
    );
  }

  // The extension opens this tab itself — landing here without the runtime
  // means the user navigated here manually. Send them on their way.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="alert alert--warn" role="alert">
        <div className="alert__title">Nothing to do here</div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          This page is used by the Seller Lab extension to pick up your
          session. There&rsquo;s nothing to do on it directly.
        </div>
      </div>
      <Link
        href="/workspace"
        className="btn btn--accent btn--lg"
        style={{ width: "100%", justifyContent: "center" }}
      >
        Go to workspace
      </Link>
    </div>
  );
}
