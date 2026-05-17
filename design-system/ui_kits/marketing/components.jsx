/* eslint-disable */
// Spoonflower Seller Lab Pro — Marketing site components.

const { useState } = React;

// ---------------- Shared bits ----------------

function LogoMark({ size = 30 }) {
  return <img src="../../assets/logo.svg" alt="" style={{ width: size, height: size, display: 'block' }} />;
}

function BrandLockup({ size = 28, fontSize = 18 }) {
  return (
    <a href="#" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <LogoMark size={size} />
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize, color: 'var(--ink-900)', letterSpacing: '-0.01em', lineHeight: 1 }}>
        Seller&nbsp;Lab
      </span>
      <span style={mktStyles.proBadge}>PRO</span>
    </a>
  );
}

function QuatBullet({ size = 12, color = 'var(--slate-500)' }) {
  return <img src="../../assets/logo.svg" alt="" style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }} />;
}

// ---------------- Nav ----------------

function Nav() {
  return (
    <nav style={mktStyles.nav}>
      <div style={mktStyles.navInner}>
        <BrandLockup />
        <div style={mktStyles.navLinks}>
          <a href="#features" style={mktStyles.navLink}>Features</a>
          <a href="#pricing" style={mktStyles.navLink}>Pricing</a>
          <a href="#faq" style={mktStyles.navLink}>FAQ</a>
          <a href="#changelog" style={mktStyles.navLink}>Changelog</a>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="#" style={mktStyles.navLink}>Sign in</a>
          <a href="#" className="btn">Open app</a>
        </div>
      </div>
    </nav>
  );
}

// ---------------- Hero ----------------

function Hero() {
  return (
    <section style={mktStyles.hero}>
      <div style={mktStyles.heroShimmer} />
      <div style={mktStyles.heroInner}>
        <div className="eyebrow" style={{ marginBottom: 18 }}>For Spoonflower sellers · not affiliated with Spoonflower Inc.</div>
        <h1 style={mktStyles.heroHed}>
          Your shop,&nbsp;<em style={{ fontStyle: 'italic', color: 'var(--slate-700)' }}>sharper.</em>
        </h1>
        <p style={mktStyles.heroLead}>
          Find better SEO keywords for your Spoonflower listings, organize them by theme, and rewrite tags without ever leaving your workshop. The paid companion to the free Chrome extension.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
          <a href="#" className="btn btn--accent btn--lg">Start free trial</a>
          <a href="#" className="btn btn--ghost btn--lg">See it in action</a>
        </div>
        <div style={mktStyles.heroFinePrint}>
          14-day trial · no card required · cancel anytime
        </div>
      </div>
    </section>
  );
}

// ---------------- Featurelet row ----------------

function Featurelets() {
  const items = [
    { hed: '40 keyword ideas', sub: 'per listing, ranked by score, in under 30 seconds.' },
    { hed: 'Organized by bucket', sub: 'themed groups that track your shop\u2019s real categories.' },
    { hed: 'Right inside Spoonflower', sub: 'or in a focused web workspace — your call.' },
  ];
  return (
    <section style={mktStyles.featureletWrap}>
      {items.map(it => (
        <div key={it.hed} style={mktStyles.featurelet}>
          <QuatBullet size={14} />
          <div>
            <div style={mktStyles.featureletHed}>{it.hed}</div>
            <div style={mktStyles.featureletSub}>{it.sub}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------------- Product shot (annotated dashboard mock) ----------------

function ProductShot() {
  return (
    <section style={mktStyles.productWrap}>
      <div style={mktStyles.productShot}>
        <div style={mktStyles.productHeader}>
          <div style={mktStyles.windowDots}>
            <span style={{ background: 'var(--brick-500)' }} />
            <span style={{ background: 'var(--saffron-500)' }} />
            <span style={{ background: 'var(--sage-500)' }} />
          </div>
          <div style={mktStyles.urlBar}>app.sellerlab.pro/research</div>
          <div />
        </div>
        <div style={mktStyles.productBody}>
          <div style={mktStyles.productSidebar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <LogoMark size={20} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>Seller&nbsp;Lab</span>
            </div>
            {['Research', 'Buckets', 'Listings', 'History'].map((l, i) => (
              <div key={l} style={{ ...mktStyles.productNavItem, ...(i === 0 ? mktStyles.productNavActive : {}) }}>{l}</div>
            ))}
          </div>
          <div style={mktStyles.productMain}>
            <div style={mktStyles.productHedRow}>
              <div className="eyebrow">Listing · cottagecore floral repeat</div>
              <span className="badge badge--success" style={{ fontSize: 10.5 }}>14 / 40 chars</span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, margin: '4px 0 12px', color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>
              42 keyword ideas, ranked
            </h3>
            <div style={mktStyles.productKwTable}>
              {[
                { k: 'cottagecore floral', v: 4200, s: 92, picked: true, kind: 'liked' },
                { k: 'vintage botanical',  v: 3100, s: 88, picked: true, kind: 'sales' },
                { k: 'moody floral repeat',v: 2400, s: 86, picked: false, kind: 'trend' },
                { k: 'hand drawn botanical',v: 1900, s: 81, picked: true, kind: 'system' },
                { k: 'wildflower fabric',  v: 1500, s: 77, picked: false, kind: 'trend' },
              ].map((r,i) => (
                <div key={i} style={{ ...mktStyles.productKwRow, ...(r.picked ? { background: 'var(--saffron-50)' } : {}) }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, border: '1.5px solid ' + (r.picked ? 'var(--slate-700)' : 'var(--slate-300)'), background: r.picked ? 'var(--slate-700)' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9 }}>{r.picked && '✓'}</span>
                  <span className={"chip chip--dot dot-" + r.kind} style={{ padding: '2px 8px', fontSize: 11 }}>{r.k}</span>
                  <span style={{ flex: 1 }}/>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>{r.v.toLocaleString()}</span>
                  <span style={{ width: 22, height: 22, borderRadius: 999, background: r.s >= 85 ? 'var(--sage-500)' : 'var(--saffron-500)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)' }}>{r.s}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={mktStyles.productRail}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Buckets</div>
            {[
              { name: 'Floral / cottagecore', c: 'var(--blossom-500)' },
              { name: 'Most sold',            c: 'var(--sage-500)' },
              { name: 'Spoonflower picks',    c: 'var(--slate-500)' },
              { name: 'Trend ideas',          c: 'var(--plum-500)' },
            ].map(b => (
              <div key={b.name} style={mktStyles.productBucket}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: b.c }} />
                <span style={{ fontSize: 12, color: 'var(--ink-900)' }}>{b.name}</span>
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
      hed: 'Keyword research that respects character limits',
      body: 'See per-tag chars and total budget live as you research. No more pasting into a Notes app to count.',
    },
    {
      hed: 'Color-coded tag taxonomy',
      body: 'Liked, sold, scraped, and trending tags get their own color. You see at a glance which signal each keyword carries.',
    },
    {
      hed: 'Buckets across listings',
      body: 'Group tags into themes that match your real shop categories, not abstract scores.',
    },
    {
      hed: 'Works inside Spoonflower',
      body: 'The free Chrome extension stays. Pro adds the cross-listing dashboard you can\u2019t fit in a side panel.',
    },
  ];
  return (
    <section id="features" style={mktStyles.featureGrid}>
      <div className="eyebrow" style={{ marginBottom: 18 }}>What Pro adds</div>
      <h2 style={mktStyles.h2}>The tools you wished the extension had,<br/><em style={{ fontStyle: 'italic', color: 'var(--slate-700)' }}>collected into one workspace.</em></h2>
      <div style={mktStyles.featureGridInner}>
        {items.map((it,i) => (
          <div key={i} className="s-card" style={{ padding: '22px 24px' }}>
            <QuatBullet size={14} />
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 600, margin: '10px 0 6px', color: 'var(--ink-900)', letterSpacing: '-0.01em', lineHeight: 1.25 }}>{it.hed}</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-500)', lineHeight: 1.55 }}>{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- Testimonial ----------------

function Testimonial() {
  return (
    <section style={mktStyles.testimonial}>
      <div style={mktStyles.testimonialInner}>
        <QuatBullet size={20} color="var(--slate-400)" />
        <blockquote style={mktStyles.quote}>
          "I used to keep tags in three spreadsheets. Now I just paste the listing URL and the right keywords float to the top — colored by whether they actually <em style={{ fontStyle: 'italic' }}>sell</em> in my shop."
        </blockquote>
        <div style={mktStyles.attribution}>
          <div style={mktStyles.avatar}>M</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-900)' }}>Maren Olsen</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>Independent fabric designer · 240 listings</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Pricing ----------------

function Pricing() {
  return (
    <section id="pricing" style={mktStyles.pricing}>
      <div className="eyebrow" style={{ textAlign: 'center', marginBottom: 16 }}>Simple plans</div>
      <h2 style={{ ...mktStyles.h2, textAlign: 'center', marginBottom: 36 }}>Free is plenty. <em style={{ fontStyle: 'italic', color: 'var(--slate-700)' }}>Pro pays itself back.</em></h2>
      <div style={mktStyles.pricingGrid}>
        <div className="s-card" style={mktStyles.planCard}>
          <div className="eyebrow">Free · Chrome extension</div>
          <div style={mktStyles.planPrice}>$0</div>
          <div style={mktStyles.planMeta}>forever</div>
          <ul style={mktStyles.planList}>
            <li><QuatBullet size={10}/>SEO keyword finder inline on Spoonflower</li>
            <li><QuatBullet size={10}/>Word buckets by character count</li>
            <li><QuatBullet size={10}/>Per-tag and total character limits</li>
            <li><QuatBullet size={10}/>Quick copy to clipboard</li>
          </ul>
          <a href="#" className="btn btn--ghost" style={{ width: '100%' }}>Install extension</a>
        </div>
        <div className="s-card" style={{ ...mktStyles.planCard, ...mktStyles.planCardFeatured }}>
          <span className="badge badge--pro" style={{ position: 'absolute', top: 16, right: 16 }}>PRO</span>
          <div className="eyebrow" style={{ color: 'var(--saffron-300)' }}>Pro · Web workspace</div>
          <div style={{ ...mktStyles.planPrice, color: 'var(--parchment-50)' }}>$9<span style={{ fontSize: 16, color: 'var(--ink-300)' }}>&nbsp;/&nbsp;mo</span></div>
          <div style={{ ...mktStyles.planMeta, color: 'var(--ink-300)' }}>or $84 / year (save 22%)</div>
          <ul style={{ ...mktStyles.planList, color: 'var(--parchment-100)' }}>
            <li><QuatBullet size={10} color="var(--saffron-500)" />Everything in Free, plus:</li>
            <li><QuatBullet size={10} color="var(--saffron-500)" />Cross-listing keyword dashboard</li>
            <li><QuatBullet size={10} color="var(--saffron-500)" />Color-coded tag taxonomy</li>
            <li><QuatBullet size={10} color="var(--saffron-500)" />Bucket history across listings</li>
            <li><QuatBullet size={10} color="var(--saffron-500)" />CSV export of keyword sets</li>
            <li><QuatBullet size={10} color="var(--saffron-500)" />Priority email support</li>
          </ul>
          <a href="#" className="btn btn--accent" style={{ width: '100%' }}>Start 14-day trial</a>
        </div>
      </div>
    </section>
  );
}

// ---------------- FAQ ----------------

function FAQ() {
  const items = [
    { q: 'Is this affiliated with Spoonflower?', a: 'No. Seller Lab and Seller Lab Pro are independent tools built by zabzablab for the Spoonflower seller community. We are not partnered with or endorsed by Spoonflower Inc.' },
    { q: 'Does my data leave the browser?',     a: 'The free Chrome extension is fully local. Pro stores your buckets and keyword sets in your account so they sync across devices — but never sells data and never trains on your shop.' },
    { q: 'What if I cancel?',                   a: 'Your CSV exports are yours forever. Your buckets stay viewable for 30 days so you can reactivate without losing work.' },
    { q: 'Can my team share an account?',       a: 'A team tier is on the roadmap. For now, Pro is a single-seller workspace.' },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" style={mktStyles.faq}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Asked &amp; answered</div>
      <h2 style={mktStyles.h2}>Questions, plainly.</h2>
      <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={mktStyles.faqItem}>
            <button style={mktStyles.faqQ} onClick={() => setOpen(open === i ? -1 : i)}>
              <span>{it.q}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-500)', fontSize: 18 }}>{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <div style={mktStyles.faqA}>{it.a}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- Footer ----------------

function Footer() {
  return (
    <footer style={mktStyles.footer}>
      <div style={mktStyles.footerInner}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BrandLockup size={24} fontSize={16} />
          <div style={{ fontSize: 13, color: 'var(--ink-500)', maxWidth: 320, lineHeight: 1.55 }}>
            A focused workshop tool for Spoonflower sellers, by an indie maker. Not affiliated with Spoonflower Inc.
          </div>
        </div>
        <div style={mktStyles.footerCols}>
          <div>
            <div style={mktStyles.footerLabel}>Product</div>
            <a style={mktStyles.footerLink}>Chrome extension</a>
            <a style={mktStyles.footerLink}>Pro workspace</a>
            <a style={mktStyles.footerLink}>Changelog</a>
            <a style={mktStyles.footerLink}>Roadmap</a>
          </div>
          <div>
            <div style={mktStyles.footerLabel}>Studio</div>
            <a style={mktStyles.footerLink}>zabzablab</a>
            <a style={mktStyles.footerLink}>Contact</a>
            <a style={mktStyles.footerLink}>Privacy</a>
            <a style={mktStyles.footerLink}>Terms</a>
          </div>
        </div>
      </div>
      <div style={mktStyles.footerBottom}>
        <span>© 2026 zabzablab</span>
        <span>·</span>
        <span>Made with care in cottage country.</span>
      </div>
    </footer>
  );
}

// ---------------- App ----------------

function MarketingApp() {
  return (
    <div style={mktStyles.page}>
      <Nav />
      <Hero />
      <Featurelets />
      <ProductShot />
      <FeatureGrid />
      <Testimonial />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}

// ---------------- Styles ----------------

const mktStyles = {
  page: { background: 'var(--bg)', color: 'var(--ink-900)', fontFamily: 'var(--font-body)' },

  // Nav
  nav: {
    position: 'sticky', top: 0, zIndex: 10,
    background: 'rgba(251, 248, 242, 0.85)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--border)',
  },
  navInner: {
    maxWidth: 1180, margin: '0 auto',
    padding: '14px 32px',
    display: 'flex', alignItems: 'center', gap: 24,
  },
  navLinks: { display: 'flex', gap: 22, marginLeft: 'auto' },
  navLink: {
    color: 'var(--ink-700)',
    fontSize: 14, fontWeight: 500,
    textDecoration: 'none',
    transition: 'color 160ms ease',
  },
  proBadge: {
    fontFamily: 'var(--font-body)', fontWeight: 700,
    fontSize: 9.5, letterSpacing: '0.16em',
    color: 'var(--saffron-700)', background: 'var(--saffron-100)',
    padding: '3px 5px', borderRadius: 3, lineHeight: 1,
  },

  // Hero
  hero: {
    position: 'relative',
    overflow: 'hidden',
    padding: '90px 32px 110px',
  },
  heroShimmer: {
    position: 'absolute', inset: 0,
    backgroundImage: 'url(../../assets/shimmer.svg)',
    backgroundSize: '360px 360px',
    pointerEvents: 'none',
  },
  heroInner: {
    position: 'relative',
    maxWidth: 880, margin: '0 auto',
    textAlign: 'center',
  },
  heroHed: {
    fontFamily: 'var(--font-display)',
    fontWeight: 500,
    fontSize: 84,
    lineHeight: 0.98,
    letterSpacing: '-0.025em',
    margin: 0,
    color: 'var(--ink-900)',
  },
  heroLead: {
    fontSize: 19, lineHeight: 1.5,
    color: 'var(--ink-500)',
    maxWidth: 600, margin: '24px auto 0',
  },
  heroFinePrint: {
    marginTop: 18,
    fontSize: 12.5, color: 'var(--ink-500)',
    letterSpacing: '0.02em',
  },

  // Featurelets
  featureletWrap: {
    maxWidth: 1180, margin: '0 auto',
    padding: '0 32px 64px',
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
    gap: 28,
    borderBottom: '1px solid var(--border)',
  },
  featurelet: {
    display: 'flex', gap: 12,
    alignItems: 'flex-start',
  },
  featureletHed: { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: 'var(--ink-900)', marginBottom: 2 },
  featureletSub: { fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.5 },

  // Product shot
  productWrap: {
    maxWidth: 1180, margin: '0 auto',
    padding: '64px 32px 96px',
  },
  productShot: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 30px 60px -30px rgba(20,24,42,0.20), 0 12px 20px -10px rgba(20,24,42,0.08)',
  },
  productHeader: {
    display: 'grid', gridTemplateColumns: '80px 1fr 80px',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'var(--parchment-50)',
    borderBottom: '1px solid var(--border)',
  },
  windowDots: { display: 'flex', gap: 6 },
  urlBar: {
    fontFamily: 'var(--font-mono)', fontSize: 11.5,
    color: 'var(--ink-500)',
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 10px',
    textAlign: 'center',
    maxWidth: 260, margin: '0 auto',
  },
  productBody: {
    display: 'grid', gridTemplateColumns: '160px 1fr 200px',
    minHeight: 380,
  },
  productSidebar: {
    background: 'var(--parchment-100)',
    borderRight: '1px solid var(--border)',
    padding: 16,
  },
  productNavItem: {
    padding: '7px 10px',
    fontSize: 12.5, color: 'var(--ink-500)',
    borderRadius: 7,
    marginBottom: 2,
  },
  productNavActive: { background: '#fff', color: 'var(--ink-900)', fontWeight: 600 },
  productMain: { padding: 20, minWidth: 0 },
  productHedRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  productKwTable: { display: 'flex', flexDirection: 'column', gap: 4 },
  productKwRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 10px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: '#fff',
  },
  productRail: {
    background: 'var(--parchment-100)',
    borderLeft: '1px solid var(--border)',
    padding: 16,
  },
  productBucket: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px',
    background: '#fff',
    borderRadius: 6,
    border: '1px solid var(--border)',
    marginBottom: 6,
  },

  // Common heading
  h2: {
    fontFamily: 'var(--font-display)',
    fontWeight: 500,
    fontSize: 52,
    lineHeight: 1.04,
    letterSpacing: '-0.02em',
    margin: 0,
    color: 'var(--ink-900)',
  },

  // Feature grid
  featureGrid: {
    maxWidth: 1180, margin: '0 auto',
    padding: '96px 32px',
  },
  featureGridInner: {
    marginTop: 40,
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },

  // Testimonial
  testimonial: {
    background: 'var(--parchment-100)',
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
    padding: '88px 32px',
  },
  testimonialInner: {
    maxWidth: 760, margin: '0 auto',
    textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 18,
  },
  quote: {
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    fontSize: 34,
    lineHeight: 1.22,
    letterSpacing: '-0.015em',
    margin: 0,
    color: 'var(--ink-900)',
    textWrap: 'pretty',
  },
  attribution: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 999,
    background: 'var(--slate-500)', color: '#fff',
    fontWeight: 700, fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // Pricing
  pricing: {
    maxWidth: 1180, margin: '0 auto',
    padding: '96px 32px',
  },
  pricingGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 14,
    maxWidth: 820, margin: '0 auto',
  },
  planCard: {
    padding: 28, position: 'relative',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  planCardFeatured: {
    background: 'var(--ink-900)',
    color: 'var(--parchment-50)',
    borderColor: 'var(--ink-900)',
    boxShadow: '0 20px 40px -16px rgba(20,24,42,0.30)',
  },
  planPrice: {
    fontFamily: 'var(--font-display)',
    fontWeight: 500,
    fontSize: 48,
    lineHeight: 1,
    letterSpacing: '-0.02em',
    color: 'var(--ink-900)',
    marginTop: 8,
  },
  planMeta: { fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 18 },
  planList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: 10,
    marginBottom: 22,
    fontSize: 13.5, lineHeight: 1.45,
    color: 'var(--ink-700)',
  },

  // FAQ
  faq: {
    maxWidth: 820, margin: '0 auto',
    padding: '96px 32px',
  },
  faqItem: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: '#fff',
    overflow: 'hidden',
  },
  faqQ: {
    width: '100%',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 22px',
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: 16, fontWeight: 600, color: 'var(--ink-900)',
    textAlign: 'left',
  },
  faqA: {
    padding: '0 22px 20px',
    fontSize: 14.5, color: 'var(--ink-500)',
    lineHeight: 1.55,
  },

  // Footer
  footer: {
    background: 'var(--ink-900)',
    color: 'var(--parchment-100)',
    padding: '64px 32px 32px',
  },
  footerInner: {
    maxWidth: 1180, margin: '0 auto',
    display: 'grid', gridTemplateColumns: '1.4fr 1fr',
    gap: 48,
  },
  footerCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 },
  footerLabel: {
    fontFamily: 'var(--font-body)', fontWeight: 700,
    fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
    color: 'var(--ink-300)',
    marginBottom: 14,
  },
  footerLink: {
    display: 'block',
    fontSize: 14, color: 'var(--parchment-100)',
    textDecoration: 'none',
    marginBottom: 8,
    cursor: 'pointer',
  },
  footerBottom: {
    maxWidth: 1180, margin: '40px auto 0',
    paddingTop: 24,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', gap: 10,
    fontSize: 12.5, color: 'var(--ink-300)',
  },
};

Object.assign(window, { MarketingApp });
