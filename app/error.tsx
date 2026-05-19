"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { BrandLockup } from "@/components/brand";
import { LogoMeadow } from "@/components/logo-meadow";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
            maxWidth: 460,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 18,
          }}
        >
          <Image
            src="/assets/logo.svg"
            alt=""
            width={32}
            height={32}
            style={{ width: 32, height: 32, opacity: 0.85 }}
          />

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--ink-500)",
            }}
          >
            Something tangled
          </div>

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
            We hit{" "}
            <em style={{ fontStyle: "italic" }}>an unexpected knot.</em>
          </h1>

          <p
            style={{
              fontSize: 14,
              color: "var(--ink-500)",
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 340,
            }}
          >
            Something on our end went sideways. Try again — and if it keeps
            happening, let us know.
          </p>

          {error.digest && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-500)",
                background: "var(--slate-50)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              ref: {error.digest}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 6,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button type="button" onClick={reset} className="btn btn--lg">
              Try again
            </button>
            <Link href="/" className="btn btn--ghost btn--lg">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
