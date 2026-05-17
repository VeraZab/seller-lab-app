"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BrandLockup, QuatBullet } from "@/components/brand";

export default function MarketingPage() {
  return (
    <div
      style={{
        background: "var(--bg)",
        color: "var(--ink-900)",
        fontFamily: "var(--font-body)",
      }}
    >
      <Nav />
      <Hero />
      <ProductShot />
      <FeatureGrid />
      <Testimonial />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}

// ---------------- Nav ----------------

function Nav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(251, 248, 242, 0.85)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <BrandLockup />
        <div style={{ display: "flex", gap: 22, marginLeft: "auto" }}>
          <Link href="#features" style={navLinkStyle}>
            Features
          </Link>
          <Link href="#pricing" style={navLinkStyle}>
            Pricing
          </Link>
          <Link href="#faq" style={navLinkStyle}>
            FAQ
          </Link>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/sign-in" style={navLinkStyle}>
            Sign in
          </Link>
          <Link href="/workspace" className="btn">
            Open app
          </Link>
        </div>
      </div>
    </nav>
  );
}

const navLinkStyle = {
  color: "var(--ink-700)",
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
  transition: "color 160ms ease",
};

// ---------------- Hero ----------------

const HERO_FEATURELETS: Array<{ hed: React.ReactNode; sub?: string }> = [
  {
    hed: (
      <>
        <a
          href="https://youtu.be/bEongVYbuJs"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "inherit",
            textDecoration: "underline",
            textDecorationThickness: "1px",
            textUnderlineOffset: "3px",
          }}
        >
          Loved free extension
        </a>
        , enhanced
      </>
    ),
    sub: "PRO picks up where Free leaves off",
  },
  {
    hed: "Your data stays yours",
    sub: "we don't sell, share, or train on it",
  },
  {
    hed: "Cancel anytime",
    sub: "no questions asked, cancel right in your settings",
  },
];

function Hero() {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "calc(100dvh - 64px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <LogoMeadow />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 32px",
        }}
      >
      <div
        style={{
          position: "relative",
          maxWidth: 880,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 18 }}>
          For Spoonflower sellers, by a Spoonflower seller
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: "clamp(56px, 9vw, 84px)",
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
            margin: 0,
            color: "var(--ink-900)",
          }}
        >
          More art.&nbsp;
          <em style={{ fontStyle: "italic", color: "var(--slate-700)" }}>
            Less admin.
          </em>
        </h1>
        <p
          style={{
            fontSize: 19,
            lineHeight: 1.5,
            color: "var(--ink-500)",
            maxWidth: 640,
            margin: "24px auto 0",
          }}
        >
          The Spoonflower seller tools you wish you had, right in your
          browser bar: <br/> analytics, strategic design suggestions, enhanced keyword strategy and customer relationship memory. 
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 28,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link href="#features" className="btn btn--ghost btn--lg">
            See it in action
          </Link>
          <Link href="/sign-in" className="btn btn--accent btn--lg">
            Get Pro
          </Link>
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 12.5,
            color: "var(--ink-500)",
            letterSpacing: "0.02em",
          }}
        >
          $10 / month · not affiliated with Spoonflower Inc.
        </div>
      </div>
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1180,
          width: "100%",
          margin: "0 auto",
          padding: "32px 32px 64px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 28,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {HERO_FEATURELETS.map((it, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <QuatBullet size={14} />
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  fontSize: 15,
                  color: "var(--ink-900)",
                  lineHeight: 1.25,
                }}
              >
                {it.hed}
              </div>
              <span
                aria-hidden="true"
                style={{ width: 14, flexShrink: 0 }}
              />
            </div>
            {it.sub && (
              <div
                style={{
                  fontSize: 13.5,
                  color: "var(--ink-500)",
                  lineHeight: 1.5,
                }}
              >
                {it.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- Logo meadow (animated decorative background) ----------------

const QUAT_D =
  "M120.6,65.4Q120.6,66.8 120.6,68.2Q120.7,69.6 120.5,71.0Q120.4,72.4 120.0,73.7Q119.6,75.1 118.9,76.3Q118.3,77.6 117.4,78.8Q116.5,79.9 115.6,81.0Q114.6,82.1 113.6,83.1Q112.7,84.2 111.6,85.1Q110.5,86.0 109.1,86.7Q107.7,87.4 105.8,87.7Q104.0,87.9 101.6,87.7Q99.2,87.5 96.6,86.9Q93.9,86.2 91.4,85.3Q88.9,84.5 87.1,83.8Q85.2,83.2 84.2,83.2Q83.2,83.2 83.2,84.2Q83.2,85.2 83.8,87.1Q84.5,88.9 85.3,91.4Q86.2,93.9 86.9,96.6Q87.5,99.2 87.7,101.6Q87.9,104.0 87.7,105.8Q87.4,107.7 86.7,109.1Q86.0,110.5 85.1,111.6Q84.2,112.7 83.1,113.6Q82.1,114.6 81.0,115.6Q79.9,116.5 78.8,117.4Q77.6,118.3 76.3,118.9Q75.1,119.6 73.7,120.0Q72.4,120.4 71.0,120.5Q69.6,120.7 68.2,120.6Q66.8,120.6 65.4,120.6Q64.0,120.6 62.6,120.6Q61.2,120.6 59.8,120.6Q58.4,120.7 57.0,120.5Q55.6,120.4 54.3,120.0Q52.9,119.6 51.7,118.9Q50.4,118.3 49.2,117.4Q48.1,116.5 47.0,115.6Q45.9,114.6 44.9,113.6Q43.8,112.7 42.9,111.6Q42.0,110.5 41.3,109.1Q40.6,107.7 40.3,105.8Q40.1,104.0 40.3,101.6Q40.5,99.2 41.1,96.6Q41.8,93.9 42.7,91.4Q43.5,88.9 44.2,87.1Q44.8,85.2 44.8,84.2Q44.8,83.2 43.8,83.2Q42.8,83.2 40.9,83.8Q39.1,84.5 36.6,85.3Q34.1,86.2 31.4,86.9Q28.8,87.5 26.4,87.7Q24.0,87.9 22.2,87.7Q20.3,87.4 18.9,86.7Q17.5,86.0 16.4,85.1Q15.3,84.2 14.4,83.1Q13.4,82.1 12.4,81.0Q11.5,79.9 10.6,78.8Q9.7,77.6 9.1,76.3Q8.4,75.1 8.0,73.7Q7.6,72.4 7.5,71.0Q7.3,69.6 7.4,68.2Q7.4,66.8 7.4,65.4Q7.4,64.0 7.4,62.6Q7.4,61.2 7.4,59.8Q7.3,58.4 7.5,57.0Q7.6,55.6 8.0,54.3Q8.4,52.9 9.1,51.7Q9.7,50.4 10.6,49.2Q11.5,48.1 12.4,47.0Q13.4,45.9 14.4,44.9Q15.3,43.8 16.4,42.9Q17.5,42.0 18.9,41.3Q20.3,40.6 22.2,40.3Q24.0,40.1 26.4,40.3Q28.8,40.5 31.4,41.1Q34.1,41.8 36.6,42.7Q39.1,43.5 40.9,44.2Q42.8,44.8 43.8,44.8Q44.8,44.8 44.8,43.8Q44.8,42.8 44.2,40.9Q43.5,39.1 42.7,36.6Q41.8,34.1 41.1,31.4Q40.5,28.8 40.3,26.4Q40.1,24.0 40.3,22.2Q40.6,20.3 41.3,18.9Q42.0,17.5 42.9,16.4Q43.8,15.3 44.9,14.4Q45.9,13.4 47.0,12.4Q48.1,11.5 49.2,10.6Q50.4,9.7 51.7,9.1Q52.9,8.4 54.3,8.0Q55.6,7.6 57.0,7.5Q58.4,7.3 59.8,7.4Q61.2,7.4 62.6,7.4Q64.0,7.4 65.4,7.4Q66.8,7.4 68.2,7.4Q69.6,7.3 71.0,7.5Q72.4,7.6 73.7,8.0Q75.1,8.4 76.3,9.1Q77.6,9.7 78.8,10.6Q79.9,11.5 81.0,12.4Q82.1,13.4 83.1,14.4Q84.2,15.3 85.1,16.4Q86.0,17.5 86.7,18.9Q87.4,20.3 87.7,22.2Q87.9,24.0 87.7,26.4Q87.5,28.8 86.9,31.4Q86.2,34.1 85.3,36.6Q84.5,39.1 83.8,40.9Q83.2,42.8 83.2,43.8Q83.2,44.8 84.2,44.8Q85.2,44.8 87.1,44.2Q88.9,43.5 91.4,42.7Q93.9,41.8 96.6,41.1Q99.2,40.5 101.6,40.3Q104.0,40.1 105.8,40.3Q107.7,40.6 109.1,41.3Q110.5,42.0 111.6,42.9Q112.7,43.8 113.6,44.9Q114.6,45.9 115.6,47.0Q116.5,48.1 117.4,49.2Q118.3,50.4 118.9,51.7Q119.6,52.9 120.0,54.3Q120.4,55.6 120.5,57.0Q120.7,58.4 120.6,59.8Q120.6,61.2 120.6,62.6ZM107.9,64.4Q107.8,64.8 107.4,65.2Q107.1,65.5 106.5,65.9Q106.0,66.3 105.2,66.6Q104.5,66.9 103.6,67.2Q102.6,67.4 101.6,67.7Q100.5,67.9 99.3,68.1Q98.1,68.2 96.9,68.3Q95.6,68.4 94.3,68.5Q93.0,68.5 91.7,68.5Q90.4,68.4 89.1,68.3Q87.9,68.2 86.7,68.1Q85.5,67.9 84.4,67.7Q83.4,67.4 82.4,67.2Q81.5,66.9 80.8,66.6Q80.0,66.3 79.5,65.9Q78.9,65.5 78.6,65.2Q78.2,64.8 78.1,64.4Q78.0,64.0 78.1,63.6Q78.2,63.2 78.6,62.8Q78.9,62.5 79.5,62.1Q80.0,61.8 80.8,61.4Q81.5,61.1 82.4,60.8Q83.4,60.6 84.4,60.3Q85.5,60.1 86.7,59.9Q87.9,59.8 89.1,59.7Q90.4,59.6 91.7,59.5Q93.0,59.5 94.3,59.5Q95.6,59.6 96.9,59.7Q98.1,59.8 99.3,59.9Q100.5,60.1 101.6,60.3Q102.6,60.6 103.6,60.8Q104.5,61.1 105.2,61.4Q106.0,61.8 106.5,62.1Q107.1,62.5 107.4,62.8Q107.8,63.2 107.9,63.6ZM63.6,107.9Q63.2,107.8 62.8,107.4Q62.5,107.1 62.1,106.5Q61.8,106.0 61.4,105.2Q61.1,104.5 60.8,103.6Q60.6,102.6 60.3,101.6Q60.1,100.5 59.9,99.3Q59.8,98.1 59.7,96.9Q59.6,95.6 59.5,94.3Q59.5,93.0 59.5,91.7Q59.6,90.4 59.7,89.1Q59.8,87.9 59.9,86.7Q60.1,85.5 60.3,84.4Q60.6,83.4 60.8,82.4Q61.1,81.5 61.4,80.8Q61.8,80.0 62.1,79.5Q62.5,78.9 62.8,78.6Q63.2,78.2 63.6,78.1Q64.0,78.0 64.4,78.1Q64.8,78.2 65.2,78.6Q65.5,78.9 65.9,79.5Q66.3,80.0 66.6,80.8Q66.9,81.5 67.2,82.4Q67.4,83.4 67.7,84.4Q67.9,85.5 68.1,86.7Q68.2,87.9 68.3,89.1Q68.4,90.4 68.5,91.7Q68.5,93.0 68.5,94.3Q68.4,95.6 68.3,96.9Q68.2,98.1 68.1,99.3Q67.9,100.5 67.7,101.6Q67.4,102.6 67.2,103.6Q66.9,104.5 66.6,105.2Q66.3,106.0 65.9,106.5Q65.5,107.1 65.2,107.4Q64.8,107.8 64.4,107.9ZM20.1,63.6Q20.2,63.2 20.6,62.8Q20.9,62.5 21.5,62.1Q22.0,61.8 22.8,61.4Q23.5,61.1 24.4,60.8Q25.4,60.6 26.4,60.3Q27.5,60.1 28.7,59.9Q29.9,59.8 31.1,59.7Q32.4,59.6 33.7,59.5Q35.0,59.5 36.3,59.5Q37.6,59.6 38.9,59.7Q40.1,59.8 41.3,59.9Q42.5,60.1 43.6,60.3Q44.6,60.6 45.6,60.8Q46.5,61.1 47.2,61.4Q48.0,61.8 48.5,62.1Q49.1,62.5 49.4,62.8Q49.8,63.2 49.9,63.6Q50.0,64.0 49.9,64.4Q49.8,64.8 49.4,65.2Q49.1,65.5 48.5,65.9Q48.0,66.3 47.2,66.6Q46.5,66.9 45.6,67.2Q44.6,67.4 43.6,67.7Q42.5,67.9 41.3,68.1Q40.1,68.2 38.9,68.3Q37.6,68.4 36.3,68.5Q35.0,68.5 33.7,68.5Q32.4,68.4 31.1,68.3Q29.9,68.2 28.7,68.1Q27.5,67.9 26.4,67.7Q25.4,67.4 24.4,67.2Q23.5,66.9 22.8,66.6Q22.0,66.3 21.5,65.9Q20.9,65.5 20.6,65.2Q20.2,64.8 20.1,64.4ZM64.4,20.1Q64.8,20.2 65.2,20.6Q65.5,20.9 65.9,21.5Q66.3,22.0 66.6,22.8Q66.9,23.5 67.2,24.4Q67.4,25.4 67.7,26.4Q67.9,27.5 68.1,28.7Q68.2,29.9 68.3,31.1Q68.4,32.4 68.5,33.7Q68.5,35.0 68.5,36.3Q68.4,37.6 68.3,38.9Q68.2,40.1 68.1,41.3Q67.9,42.5 67.7,43.6Q67.4,44.6 67.2,45.6Q66.9,46.5 66.6,47.2Q66.3,48.0 65.9,48.5Q65.5,49.1 65.2,49.4Q64.8,49.8 64.4,49.9Q64.0,50.0 63.6,49.9Q63.2,49.8 62.8,49.4Q62.5,49.1 62.1,48.5Q61.8,48.0 61.4,47.2Q61.1,46.5 60.8,45.6Q60.6,44.6 60.3,43.6Q60.1,42.5 59.9,41.3Q59.8,40.1 59.7,38.9Q59.6,37.6 59.5,36.3Q59.5,35.0 59.5,33.7Q59.6,32.4 59.7,31.1Q59.8,29.9 59.9,28.7Q60.1,27.5 60.3,26.4Q60.6,25.4 60.8,24.4Q61.1,23.5 61.4,22.8Q61.7,22.0 62.1,21.5Q62.5,20.9 62.8,20.6Q63.2,20.2 63.6,20.1Z";

const MEADOW = (() => {
  const colors = ["blossom", "sage", "slate", "plum", "saffron"] as const;
  let s = 1337;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const COLS = 6;
  const ROWS = 4;
  const PAD = 3;
  const SPAN_W = 94;
  const SPAN_H = 72;
  const cellW = SPAN_W / COLS;
  const cellH = SPAN_H / ROWS;
  const SKIP = new Set([8, 15]);
  const cells: Array<{ col: number; row: number }> = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    if (!SKIP.has(i)) cells.push({ col: i % COLS, row: Math.floor(i / COLS) });
  }
  return cells.map((c, i) => ({
    top: PAD + c.row * cellH + r() * cellH * 0.85,
    left: PAD + c.col * cellW + r() * cellW * 0.85,
    size: Math.round(r() * 28 + 18),
    color: colors[i % 5],
    delay: r() * 18,
    duration: r() * 5 + 9,
    peak: Number((r() * 0.22 + 0.15).toFixed(3)),
    rotStart: Math.round(r() * 40 - 20),
    rotMid: Math.round(r() * 12 - 6),
    rotEnd: Math.round(r() * 40 - 20),
  }));
})();

function LogoMeadow() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
        maskImage:
          "radial-gradient(ellipse 52% 42% at center, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 28%, rgba(0,0,0,1) 78%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 52% 42% at center, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 28%, rgba(0,0,0,1) 78%)",
      }}
    >
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
      >
        <defs>
          <symbol id="quat" viewBox="0 0 128 128">
            <path fillRule="evenodd" d={QUAT_D} />
          </symbol>
        </defs>
      </svg>
      {MEADOW.map((f, i) => (
        <svg
          key={i}
          width={f.size}
          height={f.size}
          viewBox="0 0 128 128"
          className="meadow-bloom"
          style={
            {
              position: "absolute",
              top: `${f.top}%`,
              left: `${f.left}%`,
              color: `var(--${f.color}-500)`,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.duration}s`,
              "--bloom-peak": String(f.peak),
              "--rot-start": `${f.rotStart}deg`,
              "--rot-mid": `${f.rotMid}deg`,
              "--rot-end": `${f.rotEnd}deg`,
            } as React.CSSProperties
          }
        >
          <use href="#quat" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

// ---------------- Product shot (mock dashboard preview) ----------------

function ProductShot() {
  const rows = [
    {
      k: "cottagecore floral",
      v: 4200,
      s: 92,
      picked: true,
      kind: "liked",
    },
    {
      k: "vintage botanical",
      v: 3100,
      s: 88,
      picked: true,
      kind: "sales",
    },
    {
      k: "moody floral repeat",
      v: 2400,
      s: 86,
      picked: false,
      kind: "trend",
    },
    {
      k: "hand drawn botanical",
      v: 1900,
      s: 81,
      picked: true,
      kind: "system",
    },
    { k: "wildflower fabric", v: 1500, s: 77, picked: false, kind: "trend" },
    { k: "pressed flowers", v: 1300, s: 74, picked: true, kind: "starred" },
  ];
  return (
    <section
      style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 32px 96px" }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow:
            "0 30px 60px -30px rgba(20,24,42,0.20), 0 12px 20px -10px rgba(20,24,42,0.08)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 1fr 80px",
            alignItems: "center",
            padding: "10px 14px",
            background: "var(--parchment-50)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: "var(--brick-500)",
              }}
            />
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: "var(--saffron-500)",
              }}
            />
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: "var(--sage-500)",
              }}
            />
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--ink-500)",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "4px 10px",
              textAlign: "center",
              maxWidth: 260,
              margin: "0 auto",
            }}
          >
            sellerlab.app/workspace
          </div>
          <div />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 200px",
            minHeight: 380,
          }}
        >
          <div
            style={{
              background: "var(--parchment-100)",
              borderRight: "1px solid var(--border)",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 18,
              }}
            >
              <Image
                src="/assets/logo.svg"
                alt=""
                width={20}
                height={20}
                style={{ width: 20, height: 20 }}
              />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Seller&nbsp;Lab
              </span>
            </div>
            {["Research", "Buckets", "Listings", "History"].map((l, i) => (
              <div
                key={l}
                style={{
                  padding: "7px 10px",
                  fontSize: 12.5,
                  color: i === 0 ? "var(--ink-900)" : "var(--ink-500)",
                  borderRadius: 7,
                  marginBottom: 2,
                  background: i === 0 ? "#fff" : "transparent",
                  fontWeight: i === 0 ? 600 : 400,
                }}
              >
                {l}
              </div>
            ))}
          </div>
          <div style={{ padding: 20, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="eyebrow">
                Listing · cottagecore floral repeat
              </div>
              <span
                className="badge badge--success"
                style={{ fontSize: 10.5 }}
              >
                14 / 40 chars
              </span>
            </div>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 500,
                margin: "4px 0 12px",
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              42 keyword ideas, ranked
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {rows.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: r.picked ? "var(--saffron-50)" : "#fff",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      border:
                        "1.5px solid " +
                        (r.picked ? "var(--slate-700)" : "var(--slate-300)"),
                      background: r.picked ? "var(--slate-700)" : "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 9,
                    }}
                  >
                    {r.picked ? "✓" : ""}
                  </span>
                  <span
                    className={`chip chip--dot dot-${r.kind}`}
                    style={{ padding: "2px 8px", fontSize: 11 }}
                  >
                    {r.k}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--ink-500)",
                    }}
                  >
                    {r.v.toLocaleString()}
                  </span>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background:
                        r.s >= 85
                          ? "var(--sage-500)"
                          : "var(--saffron-500)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {r.s}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              background: "var(--parchment-100)",
              borderLeft: "1px solid var(--border)",
              padding: 16,
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Buckets
            </div>
            {[
              { name: "Floral / cottagecore", c: "var(--blossom-500)" },
              { name: "Most sold", c: "var(--sage-500)" },
              { name: "Spoonflower picks", c: "var(--slate-500)" },
              { name: "Trend ideas", c: "var(--plum-500)" },
              { name: "Starred", c: "var(--saffron-500)" },
            ].map((b) => (
              <div
                key={b.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  background: "#fff",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: b.c,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--ink-900)" }}>
                  {b.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Feature grid ----------------

function FeatureGrid() {
  const items = [
    {
      hed: "Keyword research that respects character limits",
      body: "See per-tag chars and total budget live as you research. No more pasting into a Notes app to count.",
    },
    {
      hed: "Color-coded tag taxonomy",
      body: "Liked, sold, scraped, and trending tags get their own color. You see at a glance which signal each keyword carries.",
    },
    {
      hed: "Buckets across listings",
      body: "Group tags into themes that match your real shop categories, not abstract scores.",
    },
    {
      hed: "Works inside Spoonflower",
      body: "The free Chrome extension stays. Pro adds the cross-listing dashboard you can't fit in a side panel.",
    },
  ];
  return (
    <section
      id="features"
      style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 32px" }}
    >
      <div className="eyebrow" style={{ marginBottom: 18 }}>
        What Pro adds
      </div>
      <h2 style={h2Style}>
        The tools you wished the extension had,
        <br />
        <em style={{ fontStyle: "italic", color: "var(--slate-700)" }}>
          collected into one workspace.
        </em>
      </h2>
      <div
        style={{
          marginTop: 40,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        {items.map((it, i) => (
          <div key={i} className="s-card" style={{ padding: "22px 24px" }}>
            <QuatBullet size={14} />
            <h3
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 18,
                fontWeight: 600,
                margin: "10px 0 6px",
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
              }}
            >
              {it.hed}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--ink-500)",
                lineHeight: 1.55,
              }}
            >
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

const h2Style = {
  fontFamily: "var(--font-display)",
  fontWeight: 500,
  fontSize: "clamp(36px, 5.5vw, 52px)",
  lineHeight: 1.04,
  letterSpacing: "-0.02em",
  margin: 0,
  color: "var(--ink-900)",
};

// ---------------- Testimonial ----------------

function Testimonial() {
  return (
    <section
      style={{
        background: "var(--parchment-100)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        padding: "88px 32px",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <QuatBullet size={20} />
        <blockquote
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: 34,
            lineHeight: 1.22,
            letterSpacing: "-0.015em",
            margin: 0,
            color: "var(--ink-900)",
          }}
        >
          &ldquo;I used to keep tags in three spreadsheets. Now I just paste
          the listing URL and the right keywords float to the top — colored
          by whether they actually{" "}
          <em style={{ fontStyle: "italic" }}>sell</em> in my shop.&rdquo;
        </blockquote>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 10,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              background: "var(--slate-500)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            M
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: "var(--ink-900)",
              }}
            >
              Maren Olsen
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-500)" }}>
              Independent fabric designer · 240 listings
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Pricing ----------------

function Pricing() {
  return (
    <section
      id="pricing"
      style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 32px" }}
    >
      <div
        className="eyebrow"
        style={{ textAlign: "center", marginBottom: 16 }}
      >
        Simple plans
      </div>
      <h2 style={{ ...h2Style, textAlign: "center", marginBottom: 36 }}>
        Free is plenty.{" "}
        <em style={{ fontStyle: "italic", color: "var(--slate-700)" }}>
          Pro pays itself back.
        </em>
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          maxWidth: 820,
          margin: "0 auto",
        }}
      >
        <div
          className="s-card"
          style={{
            padding: 28,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div className="eyebrow">Free · Chrome extension</div>
          <div style={planPriceStyle}>$0</div>
          <div style={planMetaStyle}>forever</div>
          <ul style={planListStyle}>
            <li>
              <QuatBullet size={10} /> SEO keyword finder inline on
              Spoonflower
            </li>
            <li>
              <QuatBullet size={10} /> Word buckets by character count
            </li>
            <li>
              <QuatBullet size={10} /> Per-tag and total character limits
            </li>
            <li>
              <QuatBullet size={10} /> Quick copy to clipboard
            </li>
          </ul>
          <a href="#" className="btn btn--ghost" style={{ width: "100%" }}>
            Install extension
          </a>
        </div>
        <div
          className="s-card"
          style={{
            padding: 28,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            background: "var(--ink-900)",
            color: "var(--parchment-50)",
            borderColor: "var(--ink-900)",
            boxShadow: "0 20px 40px -16px rgba(20,24,42,0.30)",
          }}
        >
          <span
            className="badge badge--pro"
            style={{ position: "absolute", top: 16, right: 16 }}
          >
            PRO
          </span>
          <div className="eyebrow" style={{ color: "var(--saffron-300)" }}>
            Pro · Web workspace
          </div>
          <div style={{ ...planPriceStyle, color: "var(--parchment-50)" }}>
            $10
            <span style={{ fontSize: 16, color: "var(--ink-300)" }}>
              &nbsp;/&nbsp;mo
            </span>
          </div>
          <div style={{ ...planMetaStyle, color: "var(--ink-300)" }}>
            or $100 / year (save 17%)
          </div>
          <ul style={{ ...planListStyle, color: "var(--parchment-100)" }}>
            <li>
              <QuatBullet size={10} /> Everything in Free, plus:
            </li>
            <li>
              <QuatBullet size={10} /> Cross-listing keyword dashboard
            </li>
            <li>
              <QuatBullet size={10} /> Color-coded tag taxonomy
            </li>
            <li>
              <QuatBullet size={10} /> 100 AI keyword matches per month
            </li>
            <li>
              <QuatBullet size={10} /> Bucket history across listings
            </li>
            <li>
              <QuatBullet size={10} /> Priority email support
            </li>
          </ul>
          <Link
            href="/sign-in"
            className="btn btn--accent"
            style={{ width: "100%" }}
          >
            Get Pro
          </Link>
        </div>
      </div>
    </section>
  );
}

const planPriceStyle = {
  fontFamily: "var(--font-display)",
  fontWeight: 500,
  fontSize: 48,
  lineHeight: 1,
  letterSpacing: "-0.02em",
  color: "var(--ink-900)",
  marginTop: 8,
};

const planMetaStyle = {
  fontSize: 12.5,
  color: "var(--ink-500)",
  marginBottom: 18,
};

const planListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginBottom: 22,
  fontSize: 13.5,
  lineHeight: 1.45,
  color: "var(--ink-700)",
};

// ---------------- FAQ ----------------

function FAQ() {
  const items = [
    {
      q: "Is this affiliated with Spoonflower?",
      a: "No. Seller Lab and Seller Lab Pro are independent tools built by zabzablab for the Spoonflower seller community. We are not partnered with or endorsed by Spoonflower Inc.",
    },
    {
      q: "Does my data leave the browser?",
      a: "The free Chrome extension is fully local. Pro stores your buckets and keyword sets in your account so they sync across devices. AI keyword matching sends the design image you upload to Google's Gemini API. Your shop data is never sold and never used to train models.",
    },
    {
      q: "What if I cancel?",
      a: "Your CSV exports are yours forever. Your buckets stay viewable for 30 days so you can reactivate without losing work.",
    },
    {
      q: "Can my team share an account?",
      a: "A team tier is on the roadmap. For now, Pro is a single-seller workspace.",
    },
  ];
  const [open, setOpen] = useState<number>(0);
  return (
    <section
      id="faq"
      style={{ maxWidth: 820, margin: "0 auto", padding: "96px 32px" }}
    >
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Asked &amp; answered
      </div>
      <h2 style={h2Style}>Questions, plainly.</h2>
      <div
        style={{
          marginTop: 32,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "#fff",
              overflow: "hidden",
            }}
          >
            <button
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 22px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: 16,
                fontWeight: 600,
                color: "var(--ink-900)",
                textAlign: "left",
              }}
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              <span>{it.q}</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--ink-500)",
                  fontSize: 18,
                }}
              >
                {open === i ? "−" : "+"}
              </span>
            </button>
            {open === i && (
              <div
                style={{
                  padding: "0 22px 20px",
                  fontSize: 14.5,
                  color: "var(--ink-500)",
                  lineHeight: 1.55,
                }}
              >
                {it.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- Footer ----------------

function Footer() {
  return (
    <footer
      style={{
        background: "var(--ink-900)",
        color: "var(--parchment-100)",
        padding: "64px 32px 32px",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 48,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <Image
              src="/assets/logo.svg"
              alt=""
              width={24}
              height={24}
              style={{ width: 24, height: 24 }}
            />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-300)",
                lineHeight: 1,
              }}
            >
              Seller Lab
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                fontSize: 9.5,
                letterSpacing: "0.16em",
                color: "var(--saffron-300)",
                background: "rgba(224, 164, 88, 0.18)",
                padding: "3px 5px",
                borderRadius: 3,
                lineHeight: 1,
              }}
            >
              PRO
            </span>
          </Link>
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-300)",
              maxWidth: 320,
              lineHeight: 1.55,
            }}
          >
            A focused workshop tool for Spoonflower sellers, by an indie
            maker. Not affiliated with Spoonflower Inc.
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
          }}
        >
          <div>
            <div style={footerLabelStyle}>Product</div>
            <a style={footerLinkStyle}>Chrome extension</a>
            <a style={footerLinkStyle}>Pro workspace</a>
            <a style={footerLinkStyle}>Changelog</a>
            <a style={footerLinkStyle}>Roadmap</a>
          </div>
          <div>
            <div style={footerLabelStyle}>Studio</div>
            <a style={footerLinkStyle}>zabzablab</a>
            <a style={footerLinkStyle} href="mailto:zabzablab@gmail.com">
              Contact
            </a>
            <a style={footerLinkStyle}>Privacy</a>
            <a style={footerLinkStyle}>Terms</a>
          </div>
        </div>
      </div>
      <div
        style={{
          maxWidth: 1180,
          margin: "40px auto 0",
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 10,
          fontSize: 12.5,
          color: "var(--ink-300)",
        }}
      >
        <span>© 2026 zabzablab</span>
        <span>·</span>
        <span>Made with care in cottage country.</span>
      </div>
    </footer>
  );
}

const footerLabelStyle = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "var(--ink-300)",
  marginBottom: 14,
};

const footerLinkStyle = {
  display: "block",
  fontSize: 14,
  color: "var(--parchment-100)",
  textDecoration: "none",
  marginBottom: 8,
  cursor: "pointer",
};
