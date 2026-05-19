"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { QuatBullet } from "@/components/brand";
import { LogoMeadow } from "@/components/logo-meadow";

export default function MarketingPage() {
  return (
    <>
      <Hero />
      <ProductShot />
      <FeatureGrid />
      <Testimonial />
      <Pricing />
      <FAQ />
    </>
  );
}

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
      <LogoMeadow mask="hero" />
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
          browser bar:
          <br />
          Know your bestsellers. Track the keywords that convert. Build your
          own keyword library with the language your buyers actually use. <br/>See
          who bought what, and when.
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

