"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icon";

type SessionUser = {
  email: string;
  displayName: string;
  initial: string;
  plan: "free" | "paid";
};

type WorkspaceClientProps = {
  user: SessionUser;
  signOut: () => Promise<void>;
};

// ---------------- Sample data (will be replaced by real backend in later builds) ----------------

const SAMPLE_KEYWORDS = [
  {
    word: "cottagecore floral",
    volume: 4200,
    growth: "+18%",
    comp: "low" as const,
    score: 92,
    picked: true,
  },
  {
    word: "vintage botanical",
    volume: 3100,
    growth: "+12%",
    comp: "medium" as const,
    score: 88,
    picked: true,
  },
  {
    word: "moody floral repeat",
    volume: 2400,
    growth: "+34%",
    comp: "low" as const,
    score: 86,
    picked: false,
  },
  {
    word: "hand drawn botanical",
    volume: 1900,
    growth: "+9%",
    comp: "medium" as const,
    score: 81,
    picked: true,
  },
  {
    word: "muted floral pattern",
    volume: 1700,
    growth: "+6%",
    comp: "low" as const,
    score: 79,
    picked: false,
  },
  {
    word: "wildflower fabric",
    volume: 1500,
    growth: "+22%",
    comp: "medium" as const,
    score: 77,
    picked: false,
  },
  {
    word: "pressed flowers",
    volume: 1300,
    growth: "−4%",
    comp: "high" as const,
    score: 64,
    picked: false,
  },
  {
    word: "english garden",
    volume: 1100,
    growth: "+3%",
    comp: "medium" as const,
    score: 71,
    picked: false,
  },
  {
    word: "earth tone floral",
    volume: 980,
    growth: "+11%",
    comp: "low" as const,
    score: 76,
    picked: true,
  },
  {
    word: "small scale botanical",
    volume: 820,
    growth: "+15%",
    comp: "low" as const,
    score: 74,
    picked: false,
  },
  {
    word: "forest greenery",
    volume: 760,
    growth: "+7%",
    comp: "medium" as const,
    score: 69,
    picked: false,
  },
  {
    word: "romantic floral",
    volume: 690,
    growth: "−1%",
    comp: "high" as const,
    score: 58,
    picked: false,
  },
];

type Bucket = {
  name: string;
  count: number;
  color: string;
  tags: string[];
  chipClass?: string;
};

const SAMPLE_BUCKETS: Bucket[] = [
  {
    name: "Floral / cottagecore",
    count: 14,
    color: "var(--saffron-500)",
    tags: ["cottagecore floral", "vintage botanical", "romantic floral"],
  },
  {
    name: "Forest / moody",
    count: 9,
    color: "var(--sage-500)",
    tags: [
      "moody floral repeat",
      "forest greenery",
      "earth tone floral",
    ],
  },
  {
    name: "Hand-drawn",
    count: 7,
    color: "var(--slate-500)",
    tags: ["hand drawn botanical", "pressed flowers"],
  },
  {
    name: "Small scale",
    count: 5,
    color: "var(--indigo-500)",
    tags: ["small scale botanical", "wildflower fabric"],
  },
  {
    name: "Starred",
    count: 6,
    color: "var(--saffron-500)",
    tags: ["pressed flowers", "linen weight", "heirloom"],
    chipClass: "chip--starred",
  },
];

type Keyword = (typeof SAMPLE_KEYWORDS)[number];

// ---------------- Page ----------------

export default function WorkspaceClient({
  user,
  signOut,
}: WorkspaceClientProps) {
  const [active, setActive] = useState("research");
  const [url, setUrl] = useState("");
  const [hasData, setHasData] = useState(false);
  const [rows, setRows] = useState<Keyword[]>(SAMPLE_KEYWORDS);

  const handleResearch = () => setHasData(true);
  const handleSample = () => {
    setUrl("https://www.spoonflower.com/en/fabric/14829034");
    setHasData(true);
  };
  const toggle = (i: number) =>
    setRows((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, picked: !r.picked } : r)),
    );

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg)",
        fontFamily: "var(--font-body)",
        color: "var(--ink-900)",
      }}
    >
      <Sidebar
        active={active}
        onNav={setActive}
        user={user}
        signOut={signOut}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <Topbar
          url={url}
          onUrlChange={setUrl}
          onResearch={handleResearch}
        />
        {!hasData ? (
          <Empty onPasteSample={handleSample} />
        ) : (
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1fr 320px",
              gap: 22,
              padding: "20px 22px 32px",
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                minWidth: 0,
              }}
            >
              <ListingSummary />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div className="eyebrow">Keyword candidates</div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                      fontWeight: 500,
                      color: "var(--ink-900)",
                      letterSpacing: "-0.015em",
                      marginTop: 4,
                    }}
                  >
                    {rows.length} ideas, ranked by score
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn--ghost btn--sm">
                    <Icon name="sort" size={12} /> Score
                  </button>
                  <button className="btn btn--ghost btn--sm">
                    <Icon name="search" size={12} /> Filter
                  </button>
                </div>
              </div>
              <KeywordTable rows={rows} onToggle={toggle} />
              <TagComposer />
            </div>
            <BucketsRail />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Sidebar ----------------

type SidebarProps = {
  active: string;
  onNav: (id: string) => void;
  user: SessionUser;
  signOut: () => Promise<void>;
};

function Sidebar({ active, onNav, user, signOut }: SidebarProps) {
  const [isSigningOut, startSignOut] = useTransition();
  const items = [
    { id: "research", label: "Research", icon: "flask" as const },
    {
      id: "buckets",
      label: "Buckets",
      icon: "folder" as const,
      count: 7,
    },
    {
      id: "listings",
      label: "Listings",
      icon: "list" as const,
      count: 32,
    },
    { id: "history", label: "History", icon: "history" as const },
    { id: "settings", label: "Settings", icon: "settings" as const },
  ];
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--parchment-100)",
        borderRight: "1px solid var(--border)",
        padding: "18px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div style={{ padding: "4px 6px" }}>
        <BrandLockup href="/workspace" size={26} fontSize={17} />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-500)",
            padding: "0 8px 6px",
          }}
        >
          Workspace
        </div>
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onNav(it.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                fontFamily: "var(--font-body)",
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--ink-900)" : "var(--ink-700)",
                background: isActive ? "#fff" : "transparent",
                border: "1px solid",
                borderColor: isActive ? "var(--border)" : "transparent",
                borderRadius: 8,
                cursor: "pointer",
                width: "100%",
                boxShadow: isActive ? "var(--shadow-xs)" : "none",
                transition:
                  "background 160ms ease-out, color 160ms ease-out",
              }}
            >
              <Icon name={it.icon} size={15} />
              <span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
              {it.count != null && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--ink-500)",
                    background: "var(--parchment-50)",
                    padding: "1px 7px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                  }}
                >
                  {it.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--ink-900)",
            }}
          >
            Free trial
          </div>
          <div
            style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 2 }}
          >
            11 of 14 days left
          </div>
          <div
            style={{
              height: 4,
              background: "var(--parchment-200)",
              borderRadius: 999,
              marginTop: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "var(--saffron-500)",
                borderRadius: 999,
                width: "78%",
              }}
            />
          </div>
          <button
            className="btn btn--sm btn--accent"
            style={{ marginTop: 10, width: "100%" }}
          >
            Manage plan
          </button>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 8px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              background: "var(--slate-500)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {user.initial}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.2,
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink-900)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={user.email}
            >
              {user.displayName}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-500)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
              }}
            >
              {user.plan === "paid" ? "Pro" : "Free"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => startSignOut(() => signOut())}
            disabled={isSigningOut}
            title="Sign out"
            aria-label="Sign out"
            style={{
              border: "1px solid transparent",
              background: "transparent",
              padding: 6,
              borderRadius: 8,
              cursor: "pointer",
              color: "var(--ink-500)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition:
                "background 160ms ease-out, color 160ms ease-out, border-color 160ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--parchment-200)";
              e.currentTarget.style.color = "var(--ink-900)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-500)";
            }}
          >
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ---------------- Topbar ----------------

type TopbarProps = {
  url: string;
  onUrlChange: (v: string) => void;
  onResearch: () => void;
};

function Topbar({ url, onUrlChange, onResearch }: TopbarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 22px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 5,
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 220,
          whiteSpace: "nowrap",
        }}
      >
        <span className="eyebrow" style={{ color: "var(--ink-500)" }}>
          Research
        </span>
        <Icon name="arrow" size={13} color="var(--ink-300)" />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 17,
            color: "var(--ink-900)",
            fontWeight: 500,
          }}
        >
          New keyword set
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 10,
          minWidth: 0,
        }}
      >
        <div className="field-icon-wrap" style={{ flex: 1 }}>
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
            <Icon name="link" size={14} />
          </span>
          <input
            className="input input--with-icon"
            placeholder="Paste a Spoonflower listing URL, or describe your design"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </div>
        <button className="btn btn--accent" onClick={onResearch}>
          <Icon name="sparkle" size={14} /> Research
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button className="btn btn--ghost btn--sm">
          <Icon name="copy" size={13} /> Copy tags
        </button>
        <button className="btn btn--sm">Save listing</button>
      </div>
    </header>
  );
}

// ---------------- Empty state ----------------

function Empty({ onPasteSample }: { onPasteSample: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/assets/shimmer.svg)",
          backgroundSize: "360px 360px",
          backgroundRepeat: "repeat",
          pointerEvents: "none",
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "60px 24px",
        }}
      >
        <Image
          src="/assets/logo.svg"
          alt=""
          width={36}
          height={36}
          style={{ width: 36, height: 36 }}
        />
        <div className="eyebrow" style={{ marginTop: 14 }}>
          Start a keyword set
        </div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: 36,
            color: "var(--ink-900)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            margin: "6px 0 12px",
            maxWidth: 520,
            textAlign: "center",
          }}
        >
          Paste a listing URL,{" "}
          <em style={{ fontStyle: "italic" }}>
            or just stare at this for a bit.
          </em>
        </h2>
        <p
          style={{
            color: "var(--ink-500)",
            fontSize: 14.5,
            maxWidth: 440,
            textAlign: "center",
            margin: 0,
          }}
        >
          We&rsquo;ll pull the title and existing tags, surface stronger
          keyword candidates, and let you bucket them by theme and character
          count.
        </p>
        <button
          className="btn btn--accent btn--lg"
          style={{ marginTop: 22 }}
          onClick={onPasteSample}
        >
          <Icon name="sparkle" size={15} /> Try a sample listing
        </button>
        <div
          style={{
            marginTop: 14,
            fontSize: 12.5,
            color: "var(--ink-500)",
          }}
        >
          Or paste a URL in the bar above ↑
        </div>
      </div>
    </div>
  );
}

// ---------------- Listing summary ----------------

function ListingSummary() {
  return (
    <div
      className="s-card"
      style={{
        display: "flex",
        gap: 18,
        alignItems: "center",
        padding: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          flexShrink: 0,
          background: "var(--parchment-200)",
          backgroundImage:
            "radial-gradient(circle at 30% 30%, var(--sage-500), transparent 30%), radial-gradient(circle at 70% 60%, var(--saffron-500), transparent 30%), radial-gradient(circle at 50% 80%, var(--slate-500), transparent 35%)",
          borderRadius: 8,
          border: "1px solid var(--border)",
        }}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge--info">Listing</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-500)",
            }}
          >
            spoonflower.com/designs/14829034
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 19,
            fontWeight: 500,
            color: "var(--ink-900)",
            letterSpacing: "-0.01em",
          }}
        >
          Hand-illustrated cottagecore botanical repeat
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 12.5,
            color: "var(--ink-500)",
          }}
        >
          <span>5 current tags · 28 chars used</span>
          <span>·</span>
          <span>Last edited 3 days ago</span>
        </div>
      </div>
      <button className="btn btn--ghost btn--sm">
        <Icon name="file" size={13} /> Open on Spoonflower
      </button>
    </div>
  );
}

// ---------------- Keyword table ----------------

type KeywordTableProps = {
  rows: Keyword[];
  onToggle: (i: number) => void;
};

function KeywordTable({ rows, onToggle }: KeywordTableProps) {
  const gridTemplate =
    "40px 1fr 70px 90px 70px 110px 70px 90px";
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          padding: "10px 14px",
          background: "var(--parchment-50)",
          borderBottom: "1px solid var(--border)",
          fontFamily: "var(--font-body)",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-500)",
          alignItems: "center",
        }}
      >
        <div />
        <div>Keyword</div>
        <div>Chars</div>
        <div>Volume</div>
        <div>30d</div>
        <div>Competition</div>
        <div>Score</div>
        <div />
      </div>
      {rows.map((r, i) => (
        <div
          key={r.word}
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplate,
            padding: "10px 14px",
            borderBottom: "1px solid var(--border)",
            alignItems: "center",
            fontSize: 13,
            color: "var(--ink-700)",
            background: r.picked ? "var(--saffron-50)" : undefined,
          }}
        >
          <button
            onClick={() => onToggle(i)}
            style={{
              width: 18,
              height: 18,
              border: "1.5px solid var(--slate-300)",
              borderRadius: 5,
              background: r.picked ? "var(--slate-700)" : "#fff",
              borderColor: r.picked ? "var(--slate-700)" : "var(--slate-300)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            {r.picked && <Icon name="check" size={11} color="#fff" />}
          </button>
          <div
            style={{
              color: "var(--ink-900)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            {r.word}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              color:
                r.word.length > 35
                  ? "var(--brick-500)"
                  : "var(--ink-700)",
            }}
          >
            {r.word.length}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              fontVariantNumeric: "tabular-nums",
              color: "var(--ink-700)",
            }}
          >
            {r.volume.toLocaleString()}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              color: r.growth.startsWith("+")
                ? "var(--sage-700)"
                : "var(--brick-700)",
              fontWeight: 600,
            }}
          >
            {r.growth}
          </div>
          <div>
            <CompPip level={r.comp} />
          </div>
          <div>
            <ScoreDot value={r.score} />
          </div>
          <div style={{ textAlign: "right" }}>
            <button
              className="btn btn--ghost btn--sm"
              style={{ padding: "4px 8px" }}
            >
              <Icon name="folder" size={12} /> Bucket
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompPip({ level }: { level: "low" | "medium" | "high" }) {
  const map = {
    low: { color: "var(--sage-500)", label: "Low" },
    medium: { color: "var(--saffron-500)", label: "Medium" },
    high: { color: "var(--brick-500)", label: "High" },
  } as const;
  const m = map[level];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        color: "var(--ink-700)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: m.color,
        }}
      />
      {m.label}
    </span>
  );
}

function ScoreDot({ value }: { value: number }) {
  const color =
    value >= 85
      ? "var(--sage-500)"
      : value >= 70
        ? "var(--saffron-500)"
        : "var(--ink-300)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        color: "var(--ink-900)",
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: color,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </span>
  );
}

// ---------------- Tag composer ----------------

function TagComposer() {
  const tags = [
    "cottagecore floral",
    "vintage botanical",
    "hand drawn botanical",
    "earth tone floral",
    "moody floral repeat",
  ];
  const total = tags.join(", ").length;
  return (
    <div className="s-card" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span className="eyebrow">Final tag string</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: total > 200 ? "var(--brick-500)" : "var(--ink-700)",
          }}
        >
          {total} / 200 chars · {tags.length} / 13 tags
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tags.map((t) => (
          <span
            key={t}
            className={"chip" + (t.length > 40 ? " chip--warn" : "")}
          >
            {t}
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                marginLeft: 2,
                display: "inline-flex",
              }}
              aria-label={`Remove ${t}`}
            >
              <Icon name="x" size={11} color="var(--ink-300)" />
            </button>
          </span>
        ))}
        <span className="chip chip--ghost">
          <Icon name="plus" size={11} /> add tag
        </span>
      </div>
    </div>
  );
}

// ---------------- Buckets rail ----------------

function BucketsRail() {
  return (
    <aside
      style={{
        background: "var(--parchment-100)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span className="eyebrow">Buckets</span>
        <button
          className="btn btn--ghost btn--sm"
          style={{ padding: "3px 7px" }}
        >
          <Icon name="plus" size={11} /> New
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SAMPLE_BUCKETS.map((b) => (
          <div
            key={b.name}
            style={{
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: b.color,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--ink-900)",
                }}
              >
                {b.name}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--ink-500)",
                }}
              >
                {b.count}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 5,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              {b.tags.map((t) => (
                <span
                  key={t}
                  className={"chip " + (b.chipClass ?? "")}
                  style={{ padding: "3px 8px", fontSize: 11 }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          background: "var(--ink-900)",
          color: "var(--parchment-50)",
          padding: 12,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <Image
            src="/assets/logo.svg"
            alt=""
            width={14}
            height={14}
            style={{ width: 14, height: 14 }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: "var(--parchment-50)",
            }}
          >
            Tag draft · 14 / 40
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--parchment-100)",
            lineHeight: 1.5,
          }}
        >
          cottagecore floral, vintage botanical, hand drawn botanical, earth
          tone floral
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            className="btn btn--accent btn--sm"
            style={{ flex: 1 }}
          >
            <Icon name="copy" size={12} /> Copy
          </button>
          <button className="btn btn--ghost btn--sm">Open editor</button>
        </div>
      </div>
    </aside>
  );
}
