"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#FBF8F2",
          color: "#14182A",
          fontFamily:
            "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 22px",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: 460,
            background: "#FFFFFF",
            border: "1px solid #EBE2D0",
            borderRadius: 14,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 18,
            boxShadow: "0 1px 0 rgba(20,24,42,0.04), 0 8px 24px rgba(20,24,42,0.04)",
          }}
        >
          <div
            style={{
              fontFamily:
                "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#5A627C",
            }}
          >
            Something tangled
          </div>

          <h1
            style={{
              fontFamily:
                "'Newsreader', 'Iowan Old Style', Georgia, serif",
              fontWeight: 500,
              fontSize: 30,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: "#14182A",
              margin: 0,
            }}
          >
            We hit{" "}
            <em style={{ fontStyle: "italic" }}>an unexpected knot.</em>
          </h1>

          <p
            style={{
              fontSize: 14,
              color: "#5A627C",
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 340,
            }}
          >
            Something on our end went sideways. Try again &mdash; and if it
            keeps happening, let us know.
          </p>

          {error.digest && (
            <div
              style={{
                fontFamily:
                  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
                fontSize: 11,
                color: "#5A627C",
                background: "#F2F4F7",
                border: "1px solid #EBE2D0",
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
            <button
              type="button"
              onClick={reset}
              style={{
                appearance: "none",
                border: "1px solid #14182A",
                background: "#14182A",
                color: "#FBF8F2",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 500,
                padding: "10px 18px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                appearance: "none",
                border: "1px solid #EBE2D0",
                background: "transparent",
                color: "#14182A",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 500,
                padding: "10px 18px",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
