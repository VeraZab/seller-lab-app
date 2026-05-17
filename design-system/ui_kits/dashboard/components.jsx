/* eslint-disable */
// Spoonflower Seller Lab Pro — Dashboard components.
// Small, mainly-cosmetic React components. State is fake.

const { useState, useMemo } = React;

// ---------------- Inline icon helpers (Lucide-style, 1.75 stroke) ----------------

function Icon({ name, size = 16, color }) {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: color || "currentColor",
    strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round"
  };
  switch (name) {
    case 'search':    return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'plus':      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'x':         return <svg {...props}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case 'check':     return <svg {...props}><path d="m5 12 4.5 4.5L19 7"/></svg>;
    case 'copy':      return <svg {...props}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M4 15V5a1 1 0 0 1 1-1h10"/></svg>;
    case 'sparkle':   return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>;
    case 'folder':    return <svg {...props}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>;
    case 'file':      return <svg {...props}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>;
    case 'list':      return <svg {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
    case 'tag':       return <svg {...props}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.4"/></svg>;
    case 'history':   return <svg {...props}><path d="M3 12a9 9 0 1 0 3-6.71L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>;
    case 'settings':  return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'arrow':     return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'trend-up':  return <svg {...props}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
    case 'minus':     return <svg {...props}><path d="M5 12h14"/></svg>;
    case 'star':      return <svg {...props}><path d="m12 2 3 7 7 .6-5.3 4.7L18 22l-6-3.7L6 22l1.3-7.7L2 9.6 9 9z"/></svg>;
    case 'sort':      return <svg {...props}><path d="m3 8 4-4 4 4M7 4v16M13 16l4 4 4-4M17 4v16"/></svg>;
    case 'flask':     return <svg {...props}><path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 19l-5-10V3"/><path d="M7 14h10"/></svg>;
    default:          return null;
  }
}

function Quatrefoil({ size = 22, color }) {
  // Brand glyph — uses the sharp SVG trace of the original logo.
  return <img src="../../assets/logo.svg" alt="" style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }} />;
}

// ---------------- Sidebar ----------------

function Sidebar({ active, onNav }) {
  const items = [
    { id: 'research', label: 'Research', icon: 'flask' },
    { id: 'buckets',  label: 'Buckets',  icon: 'folder', count: 7 },
    { id: 'listings', label: 'Listings', icon: 'list', count: 32 },
    { id: 'history',  label: 'History',  icon: 'history' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  return (
    <aside style={dashStyles.sidebar}>
      <div style={dashStyles.brand}>
        <div style={dashStyles.brandMark}>
          <img src="../../assets/logo.svg" alt="" style={{ width: 26, height: 26, display: 'block' }} />
        </div>
        <div style={dashStyles.brandLockup}>
          <span style={dashStyles.brandName}>Seller&nbsp;Lab</span>
          <span style={dashStyles.brandPro}>PRO</span>
        </div>
      </div>

      <nav style={dashStyles.nav}>
        <div style={dashStyles.navLabel}>Workspace</div>
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => onNav(it.id)}
            style={{
              ...dashStyles.navItem,
              ...(active === it.id ? dashStyles.navItemActive : {})
            }}
          >
            <Icon name={it.icon} size={15} />
            <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
            {it.count != null && (
              <span style={dashStyles.navCount}>{it.count}</span>
            )}
          </button>
        ))}
      </nav>

      <div style={dashStyles.sidebarBottom}>
        <div style={dashStyles.upsell}>
          <div style={dashStyles.upsellTitle}>Free trial</div>
          <div style={dashStyles.upsellMeta}>11 of 14 days left</div>
          <div style={dashStyles.progressTrack}><div style={{ ...dashStyles.progressFill, width: '78%' }}/></div>
          <button className="btn btn--sm btn--accent" style={{ marginTop: 10, width: '100%' }}>Manage plan</button>
        </div>
        <div style={dashStyles.user}>
          <div style={dashStyles.avatar}>V</div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>Vera Z.</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>zabzablab</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ---------------- Topbar ----------------

function Topbar({ url, onUrlChange, onResearch }) {
  return (
    <header style={dashStyles.topbar}>
      <div style={dashStyles.topbarLeft}>
        <span className="eyebrow" style={{ color: 'var(--ink-500)' }}>Research</span>
        <Icon name="arrow" size={13} color="var(--ink-300)" />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-900)', fontWeight: 500 }}>
          New keyword set
        </span>
      </div>
      <div style={dashStyles.topbarCenter}>
        <div className="field-icon-wrap" style={{ flex: 1 }}>
          <svg className="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-500)' }}>
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.07-7.07L11.5 5"/>
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.07 7.07l1.93-1.93"/>
          </svg>
          <input
            className="input input--with-icon"
            placeholder="Paste a Spoonflower listing URL, or describe your design"
            value={url}
            onChange={e => onUrlChange(e.target.value)}
          />
        </div>
        <button className="btn btn--accent" onClick={onResearch}>
          <Icon name="sparkle" size={14} /> Research
        </button>
      </div>
      <div style={dashStyles.topbarRight}>
        <button className="btn btn--ghost btn--sm"><Icon name="copy" size={13} /> Copy tags</button>
        <button className="btn btn--sm">Save listing</button>
      </div>
    </header>
  );
}

// ---------------- Empty state ----------------

function Empty({ onPasteSample }) {
  return (
    <div style={dashStyles.emptyWrap}>
      <div style={dashStyles.emptyPattern} />
      <div style={dashStyles.emptyContent}>
        <Quatrefoil size={36} color="var(--slate-400)" />
        <div className="eyebrow" style={{ marginTop: 14 }}>Start a keyword set</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36, color: 'var(--ink-900)', lineHeight: 1.05, letterSpacing: '-0.02em', margin: '6px 0 12px', maxWidth: 520, textAlign: 'center' }}>
          Paste a listing URL, <em style={{ fontStyle: 'italic' }}>or just stare at this for a bit.</em>
        </h2>
        <p style={{ color: 'var(--ink-500)', fontSize: 14.5, maxWidth: 440, textAlign: 'center', margin: 0 }}>
          We'll pull the title and existing tags, surface stronger keyword candidates, and let you bucket them by theme and character count.
        </p>
        <button className="btn btn--accent btn--lg" style={{ marginTop: 22 }} onClick={onPasteSample}>
          <Icon name="sparkle" size={15} /> Try a sample listing
        </button>
        <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-500)' }}>
          Or paste a URL in the bar above ↑
        </div>
      </div>
    </div>
  );
}

// ---------------- Keyword research panel ----------------

const SAMPLE_KEYWORDS = [
  { word: 'cottagecore floral', volume: 4200, growth: '+18%', comp: 'low', score: 92, picked: true },
  { word: 'vintage botanical', volume: 3100, growth: '+12%', comp: 'medium', score: 88, picked: true },
  { word: 'moody floral repeat', volume: 2400, growth: '+34%', comp: 'low', score: 86, picked: false },
  { word: 'hand drawn botanical', volume: 1900, growth: '+9%', comp: 'medium', score: 81, picked: true },
  { word: 'muted floral pattern', volume: 1700, growth: '+6%', comp: 'low', score: 79, picked: false },
  { word: 'wildflower fabric', volume: 1500, growth: '+22%', comp: 'medium', score: 77, picked: false },
  { word: 'pressed flowers', volume: 1300, growth: '−4%', comp: 'high', score: 64, picked: false },
  { word: 'english garden', volume: 1100, growth: '+3%', comp: 'medium', score: 71, picked: false },
  { word: 'earth tone floral', volume: 980, growth: '+11%', comp: 'low', score: 76, picked: true },
  { word: 'small scale botanical', volume: 820, growth: '+15%', comp: 'low', score: 74, picked: false },
  { word: 'forest greenery', volume: 760, growth: '+7%', comp: 'medium', score: 69, picked: false },
  { word: 'romantic floral', volume: 690, growth: '−1%', comp: 'high', score: 58, picked: false },
];

function KeywordTable({ rows, onToggle, onBucket }) {
  return (
    <div style={dashStyles.tableWrap}>
      <div style={dashStyles.tableHead}>
        <div style={{ ...dashStyles.cellPick }}> </div>
        <div style={{ ...dashStyles.cellKeyword }}>Keyword</div>
        <div style={{ ...dashStyles.cellNum }}>Chars</div>
        <div style={{ ...dashStyles.cellNum }}>Volume</div>
        <div style={{ ...dashStyles.cellGrowth }}>30d</div>
        <div style={{ ...dashStyles.cellComp }}>Competition</div>
        <div style={{ ...dashStyles.cellScore }}>Score</div>
        <div style={{ ...dashStyles.cellAction }}></div>
      </div>
      {rows.map((r, i) => (
        <div key={r.word} style={{ ...dashStyles.tableRow, ...(r.picked ? dashStyles.tableRowPicked : {}) }}>
          <div style={dashStyles.cellPick}>
            <button onClick={() => onToggle(i)} style={{ ...dashStyles.checkbox, ...(r.picked ? dashStyles.checkboxOn : {}) }}>
              {r.picked && <Icon name="check" size={11} color="#fff" />}
            </button>
          </div>
          <div style={{ ...dashStyles.cellKeyword, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{r.word}</div>
          <div style={{ ...dashStyles.cellNum, color: r.word.length > 35 ? 'var(--brick-500)' : 'var(--ink-700)' }}>{r.word.length}</div>
          <div style={{ ...dashStyles.cellNum, fontVariantNumeric: 'tabular-nums' }}>{r.volume.toLocaleString()}</div>
          <div style={{ ...dashStyles.cellGrowth, color: r.growth.startsWith('+') ? 'var(--sage-700)' : 'var(--brick-700)', fontWeight: 600 }}>{r.growth}</div>
          <div style={dashStyles.cellComp}><CompPip level={r.comp} /></div>
          <div style={dashStyles.cellScore}><ScoreDot value={r.score} /></div>
          <div style={dashStyles.cellAction}>
            <button className="btn btn--ghost btn--sm" onClick={() => onBucket(i)} style={{ padding: '4px 8px' }}>
              <Icon name="folder" size={12} /> Bucket
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompPip({ level }) {
  const map = { low: { color: 'var(--sage-500)', label: 'Low' }, medium: { color: 'var(--saffron-500)', label: 'Medium' }, high: { color: 'var(--brick-500)', label: 'High' } };
  const m = map[level];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-700)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: m.color }} />
      {m.label}
    </span>
  );
}

function ScoreDot({ value }) {
  const color = value >= 85 ? 'var(--sage-500)' : value >= 70 ? 'var(--saffron-500)' : 'var(--ink-300)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-900)', fontWeight: 500 }}>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{value}</span>
    </span>
  );
}

// ---------------- Buckets rail ----------------

const SAMPLE_BUCKETS = [
  { name: 'Floral / cottagecore', count: 14, color: 'var(--saffron-500)', tags: ['cottagecore floral', 'vintage botanical', 'romantic floral'] },
  { name: 'Forest / moody',       count: 9,  color: 'var(--sage-500)',     tags: ['moody floral repeat', 'forest greenery', 'earth tone floral'] },
  { name: 'Hand-drawn',           count: 7,  color: 'var(--slate-500)',    tags: ['hand drawn botanical', 'pressed flowers'] },
  { name: 'Small scale',          count: 5,  color: 'var(--indigo-500)',   tags: ['small scale botanical', 'wildflower fabric'] },
];

function BucketsRail() {
  return (
    <aside style={dashStyles.bucketsRail}>
      <div style={dashStyles.bucketsHead}>
        <span className="eyebrow">Buckets</span>
        <button className="btn btn--ghost btn--sm" style={{ padding: '3px 7px' }}><Icon name="plus" size={11} /> New</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SAMPLE_BUCKETS.map(b => (
          <div key={b.name} style={dashStyles.bucket}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color }} />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{b.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>{b.count}</span>
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
              {b.tags.map(t => <span key={t} className="chip" style={{ padding: '3px 8px', fontSize: 11 }}>{t}</span>)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, ...dashStyles.bucketCallout }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Quatrefoil size={14} color="var(--slate-500)" />
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-900)' }}>Tag draft · 14 / 40</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-700)', lineHeight: 1.5 }}>
          cottagecore floral, vintage botanical, hand drawn botanical, earth tone floral
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button className="btn btn--accent btn--sm" style={{ flex: 1 }}><Icon name="copy" size={12} /> Copy</button>
          <button className="btn btn--ghost btn--sm">Open editor</button>
        </div>
      </div>
    </aside>
  );
}

// ---------------- Listing summary card ----------------

function ListingSummary() {
  return (
    <div className="s-card" style={{ display: 'flex', gap: 18, alignItems: 'center', padding: 14 }}>
      <div style={dashStyles.listingThumb} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge--info">Listing</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>spoonflower.com/designs/14829034</span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>
          Hand-illustrated cottagecore botanical repeat
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--ink-500)' }}>
          <span>5 current tags · 28 chars used</span>
          <span>·</span>
          <span>Last edited 3 days ago</span>
        </div>
      </div>
      <button className="btn btn--ghost btn--sm"><Icon name="file" size={13} /> Open on Spoonflower</button>
    </div>
  );
}

// ---------------- Tag composer / editor ----------------

function TagComposer() {
  const tags = ['cottagecore floral', 'vintage botanical', 'hand drawn botanical', 'earth tone floral', 'moody floral repeat'];
  const total = tags.join(', ').length;
  return (
    <div className="s-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="eyebrow">Final tag string</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: total > 40 ? 'var(--brick-500)' : 'var(--ink-700)' }}>
          {total} / 200 chars · {tags.length} / 13 tags
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tags.map((t, i) => (
          <span key={t} className={"chip" + (t.length > 40 ? " chip--warn" : "")}>
            {t}
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 2 }}>
              <Icon name="x" size={11} color="var(--ink-300)" />
            </button>
          </span>
        ))}
        <span className="chip chip--ghost"><Icon name="plus" size={11} /> add tag</span>
      </div>
    </div>
  );
}

// ---------------- Main app ----------------

function DashboardApp() {
  const [active, setActive] = useState('research');
  const [url, setUrl] = useState('');
  const [hasData, setHasData] = useState(false);
  const [rows, setRows] = useState(SAMPLE_KEYWORDS);

  const handleResearch = () => { setHasData(true); };
  const handleSample = () => { setUrl('https://www.spoonflower.com/en/fabric/14829034'); setHasData(true); };
  const toggle = (i) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, picked: !r.picked } : r));
  const bucket = (i) => {};

  return (
    <div style={dashStyles.appShell}>
      <Sidebar active={active} onNav={setActive} />
      <div style={dashStyles.main}>
        <Topbar url={url} onUrlChange={setUrl} onResearch={handleResearch} />
        {!hasData ? (
          <Empty onPasteSample={handleSample} />
        ) : (
          <div style={dashStyles.workspace}>
            <div style={dashStyles.workspaceMain}>
              <ListingSummary />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="eyebrow">Keyword candidates</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--ink-900)', letterSpacing: '-0.015em', marginTop: 4 }}>
                    42 ideas, ranked by score
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--ghost btn--sm"><Icon name="sort" size={12} /> Score</button>
                  <button className="btn btn--ghost btn--sm"><Icon name="search" size={12} /> Filter</button>
                </div>
              </div>
              <KeywordTable rows={rows} onToggle={toggle} onBucket={bucket} />
              <TagComposer />
            </div>
            <BucketsRail />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Styles ----------------

const dashStyles = {
  appShell: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: 'var(--font-body)',
    color: 'var(--ink-900)',
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: 'var(--parchment-100)',
    borderRight: '1px solid var(--border)',
    padding: '18px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 6px',
  },
  brandMark: {
    width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  brandLockup: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  brandName: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    color: 'var(--ink-900)',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  brandPro: {
    fontFamily: 'var(--font-body)',
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: '0.16em',
    color: 'var(--saffron-700)',
    background: 'var(--saffron-100)',
    padding: '2px 5px',
    borderRadius: 3,
    lineHeight: 1,
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: 10.5, fontWeight: 700,
    letterSpacing: '0.14em', textTransform: 'uppercase',
    color: 'var(--ink-500)',
    padding: '0 8px 6px',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: 13.5, fontWeight: 500,
    color: 'var(--ink-700)',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 8,
    cursor: 'pointer',
    width: '100%',
    transition: 'background 160ms ease-out, color 160ms ease-out',
  },
  navItemActive: {
    background: '#fff',
    color: 'var(--ink-900)',
    fontWeight: 600,
    borderColor: 'var(--border)',
    boxShadow: 'var(--shadow-xs)',
  },
  navCount: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--ink-500)',
    background: 'var(--parchment-50)',
    padding: '1px 7px',
    borderRadius: 999,
    border: '1px solid var(--border)',
  },
  sidebarBottom: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },
  upsell: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    boxShadow: 'var(--shadow-xs)',
  },
  upsellTitle: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-900)' },
  upsellMeta: { fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 },
  progressTrack: { height: 4, background: 'var(--parchment-200)', borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--saffron-500)', borderRadius: 999 },
  user: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 8px',
    borderTop: '1px solid var(--border)',
  },
  avatar: {
    width: 30, height: 30,
    background: 'var(--slate-500)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    borderRadius: 999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 22px',
    background: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, zIndex: 5,
    backdropFilter: 'blur(8px)',
  },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 220, whiteSpace: 'nowrap' },
  topbarCenter: { flex: 1, display: 'flex', gap: 10, minWidth: 0 },
  topbarRight: { display: 'flex', gap: 8, flexShrink: 0 },
  workspace: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: 22,
    padding: '20px 22px 32px',
    minHeight: 0,
  },
  workspaceMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minWidth: 0,
  },
  listingThumb: {
    width: 56, height: 56, flexShrink: 0,
    background: 'var(--parchment-200)',
    backgroundImage: 'radial-gradient(circle at 30% 30%, var(--sage-500), transparent 30%), radial-gradient(circle at 70% 60%, var(--saffron-500), transparent 30%), radial-gradient(circle at 50% 80%, var(--slate-500), transparent 35%)',
    borderRadius: 8,
    border: '1px solid var(--border)',
  },
  tableWrap: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 70px 90px 70px 110px 70px 90px',
    padding: '10px 14px',
    background: 'var(--parchment-50)',
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-body)',
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--ink-500)',
    alignItems: 'center',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 70px 90px 70px 110px 70px 90px',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    alignItems: 'center',
    fontSize: 13,
    color: 'var(--ink-700)',
  },
  tableRowPicked: { background: 'var(--saffron-50)' },
  cellPick: { display: 'flex', alignItems: 'center' },
  cellKeyword: { color: 'var(--ink-900)' },
  cellNum: { fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-700)' },
  cellGrowth: { fontFamily: 'var(--font-mono)', fontSize: 12.5 },
  cellComp: {},
  cellScore: {},
  cellAction: { textAlign: 'right' },
  checkbox: {
    width: 18, height: 18,
    border: '1.5px solid var(--slate-300)',
    borderRadius: 5,
    background: '#fff',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  },
  checkboxOn: { background: 'var(--slate-700)', borderColor: 'var(--slate-700)' },
  bucketsRail: {
    background: 'var(--parchment-100)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 14,
    display: 'flex', flexDirection: 'column',
    minWidth: 0,
  },
  bucketsHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bucket: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 10,
  },
  bucketCallout: {
    background: 'var(--ink-900)',
    color: 'var(--parchment-50)',
    padding: 12,
    borderRadius: 10,
  },
  emptyWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyPattern: {
    position: 'absolute', inset: 0,
    backgroundImage: 'url(../../assets/shimmer.svg)',
    backgroundSize: '360px 360px',
    backgroundRepeat: 'repeat',
    pointerEvents: 'none',
  },
  emptyContent: {
    position: 'relative',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 24px',
  },
};

// Export
Object.assign(window, { DashboardApp });
