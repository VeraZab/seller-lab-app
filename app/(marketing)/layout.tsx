import Image from "next/image";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";

const navLinkStyle = {
  color: "var(--ink-700)",
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
  transition: "color 160ms ease",
};

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

async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = !!user;

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
          {isSignedIn ? (
            <Link href="/workspace" className="btn">
              Open app
            </Link>
          ) : (
            <>
              <Link href="/#pricing" className="btn btn--pro">
                Get PRO
              </Link>
              <Link href="/sign-in" className="btn">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

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
            A workflow tool for Spoonflower sellers, by zabzablab. Not
            affiliated with Spoonflower Inc.
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
            <a
              style={footerLinkStyle}
              href="https://chromewebstore.google.com/detail/bdphillbkbnikcjmjonkmodmlddbhegb?utm_source=item-share-cb"
              target="_blank"
              rel="noopener noreferrer"
            >
              Chrome extension
            </a>
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
      </div>
    </footer>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg)",
        color: "var(--ink-900)",
        fontFamily: "var(--font-body)",
      }}
    >
      <Nav />
      {children}
      <Footer />
    </div>
  );
}
