"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icon";
import type { CustomerAgg } from "../analytics/stats";
import type { CustomerHistoryRow } from "./page";

type SessionUser = {
  email: string;
  displayName: string;
  initial: string;
  plan: "free" | "paid";
};

// Same guest key convention as the server component.
const GUEST_KEY = "__guest__";

export default function CustomersClient({
  user,
  customers,
  historyByCustomer,
  totalSaleEvents,
  guestSaleEvents,
  cachedDesignIds,
  storageUrlBase,
}: {
  user: SessionUser;
  customers: CustomerAgg[];
  historyByCustomer: Record<string, CustomerHistoryRow[]>;
  totalSaleEvents: number;
  guestSaleEvents: number;
  cachedDesignIds: number[];
  storageUrlBase: string;
}) {
  const [selected, setSelected] = useState<string | null>(
    // Default selection: first non-guest customer, else the guest lane.
    customers.find((c) => !c.isGuest)?.customer ??
      customers[0]?.customer ??
      null,
  );
  const [query, setQuery] = useState("");
  const cachedSet = useMemo(
    () => new Set(cachedDesignIds),
    [cachedDesignIds],
  );

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.customer.toLowerCase().includes(q));
  }, [customers, query]);

  // Reverse-lookup: selected customer label → history key.
  const selectedKey = useMemo(() => {
    const c = customers.find((x) => x.customer === selected);
    if (!c) return null;
    return c.isGuest ? GUEST_KEY : c.customer;
  }, [selected, customers]);

  const detail = selectedKey ? historyByCustomer[selectedKey] : null;
  const selectedCustomer = customers.find((c) => c.customer === selected);
  const guestPct =
    totalSaleEvents > 0
      ? Math.round((guestSaleEvents / totalSaleEvents) * 100)
      : 0;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
        fontFamily: "var(--font-body)",
        color: "var(--ink-900)",
      }}
    >
      <Sidebar user={user} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            padding: "var(--space-8) var(--space-8) var(--space-10)",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              maxWidth: 1120,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-5)",
            }}
          >
            <PageHeader
              totalCustomers={customers.length}
              guestSaleEvents={guestSaleEvents}
              totalSaleEvents={totalSaleEvents}
              guestPct={guestPct}
            />

            {customers.length === 0 ? (
              <EmptyState />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(260px, 320px) 1fr",
                  gap: "var(--space-4)",
                  alignItems: "start",
                }}
              >
                <CustomerList
                  customers={filteredCustomers}
                  selected={selected}
                  onSelect={setSelected}
                  query={query}
                  onQueryChange={setQuery}
                />
                <CustomerDetail
                  customer={selectedCustomer}
                  history={detail ?? []}
                  cachedSet={cachedSet}
                  storageUrlBase={storageUrlBase}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ user }: { user: SessionUser }) {
  const items = [
    { href: "/workspace", label: "Keyword Library", icon: "star" as const },
    {
      href: "/analytics",
      label: "Sales & Analytics",
      icon: "trend-up" as const,
    },
    {
      href: "/customers",
      label: "Customers",
      icon: "history" as const,
      active: true,
    },
  ];
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--parchment-100)",
        borderRight: "1px solid var(--border)",
        padding: "18px 14px 0",
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
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            prefetch
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              fontSize: 13.5,
              fontWeight: it.active ? 600 : 500,
              color: it.active ? "var(--ink-900)" : "var(--ink-700)",
              background: it.active ? "#fff" : "transparent",
              border: it.active
                ? "1px solid var(--border)"
                : "1px solid transparent",
              borderRadius: 8,
              boxShadow: it.active ? "var(--shadow-xs)" : "none",
            }}
          >
            <Icon name={it.icon} size={15} />
            <span style={{ flex: 1 }}>{it.label}</span>
          </Link>
        ))}
      </nav>
      <div
        style={{
          marginTop: "auto",
          padding: "14px 8px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
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
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
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
      </div>
    </aside>
  );
}

function PageHeader({
  totalCustomers,
  guestSaleEvents,
  totalSaleEvents,
  guestPct,
}: {
  totalCustomers: number;
  guestSaleEvents: number;
  totalSaleEvents: number;
  guestPct: number;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ color: "var(--ink-500)" }}>
        Customers
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 30,
          fontWeight: 500,
          color: "var(--ink-900)",
          letterSpacing: "-0.018em",
          margin: "var(--space-1) 0 var(--space-3)",
          lineHeight: 1.1,
        }}
      >
        Who&rsquo;s buying your designs
      </h1>
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          flexWrap: "wrap",
          fontSize: 13,
          color: "var(--ink-500)",
        }}
      >
        <span>
          <strong style={{ color: "var(--ink-900)" }}>
            {totalCustomers}
          </strong>{" "}
          unique buyer{totalCustomers === 1 ? "" : "s"}
        </span>
        <span>·</span>
        <span>
          <strong style={{ color: "var(--ink-900)" }}>
            {guestSaleEvents}
          </strong>{" "}
          guest sale{guestSaleEvents === 1 ? "" : "s"}{" "}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color:
                guestPct >= 75
                  ? "var(--brick-700)"
                  : guestPct >= 50
                    ? "var(--saffron-700)"
                    : "var(--ink-500)",
            }}
          >
            ({guestPct}% of {totalSaleEvents})
          </span>
        </span>
      </div>
    </div>
  );
}

function CustomerList({
  customers,
  selected,
  onSelect,
  query,
  onQueryChange,
}: {
  customers: CustomerAgg[];
  selected: string | null;
  onSelect: (customer: string) => void;
  query: string;
  onQueryChange: (v: string) => void;
}) {
  return (
    <div
      className="s-card"
      style={{
        padding: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        maxHeight: "78vh",
      }}
    >
      <div className="field-icon-wrap" style={{ position: "relative" }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--ink-500)",
            display: "inline-flex",
            pointerEvents: "none",
          }}
        >
          <Icon name="search" size={13} />
        </span>
        <input
          className="input input--with-icon"
          type="search"
          placeholder="Search customers"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) onQueryChange("");
          }}
          style={{ fontSize: 12.5, padding: "7px 10px 7px 30px" }}
        />
      </div>
      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {customers.map((c) => {
          const isSelected = c.customer === selected;
          return (
            <button
              key={c.customer}
              type="button"
              onClick={() => onSelect(c.customer)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px",
                borderRadius: 8,
                background: isSelected ? "var(--parchment-100)" : "transparent",
                border: isSelected
                  ? "1px solid var(--border)"
                  : "1px solid transparent",
                textAlign: "left",
                cursor: "pointer",
                width: "100%",
                fontFamily: "inherit",
                color: "var(--ink-900)",
              }}
            >
              <span
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: c.isGuest ? "var(--ink-500)" : "var(--ink-900)",
                  }}
                >
                  {c.isGuest && (
                    <Icon name="star" size={11} color="var(--ink-500)" />
                  )}
                  {c.customer}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-500)",
                    fontFamily: "var(--font-mono)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    {c.orders} order{c.orders === 1 ? "" : "s"} ·{" "}
                    {money(c.net)}
                  </span>
                  {c.refunds > 0 && (
                    <span
                      style={{
                        color: "var(--brick-700)",
                        fontWeight: 600,
                      }}
                      title={`${money(c.refunds)} refunded`}
                    >
                      −{money(c.refunds)}
                    </span>
                  )}
                </span>
              </span>
              <Icon
                name="arrow"
                size={12}
                color={isSelected ? "var(--ink-500)" : "var(--ink-300)"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomerDetail({
  customer,
  history,
  cachedSet,
  storageUrlBase,
}: {
  customer?: CustomerAgg;
  history: CustomerHistoryRow[];
  cachedSet: Set<number>;
  storageUrlBase: string;
}) {
  if (!customer) return null;
  // Purchase history rows sorted newest first (server already sends
  // newest first from sold_at desc query, but sort defensively so re-
  // fetches or client rearrangements don't surprise us).
  const sorted = useMemo(
    () =>
      [...history].sort((a, b) =>
        a.sold_at < b.sold_at ? 1 : a.sold_at > b.sold_at ? -1 : 0,
      ),
    [history],
  );

  return (
    <div
      className="s-card"
      style={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <CustomerHeader customer={customer} />
      <PurchaseHistory
        rows={sorted}
        cachedSet={cachedSet}
        storageUrlBase={storageUrlBase}
      />
    </div>
  );
}

function CustomerHeader({ customer }: { customer: CustomerAgg }) {
  const label = customer.customer;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        flexWrap: "wrap",
        paddingBottom: "var(--space-3)",
        borderBottom: "1px solid var(--parchment-200)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="eyebrow" style={{ color: "var(--ink-500)" }}>
          {customer.isGuest ? "Anonymous buyers" : "Customer"}
        </div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 500,
            margin: 0,
            letterSpacing: "-0.015em",
          }}
        >
          {label}
        </h2>
        {!customer.isGuest && (
          <a
            href={`https://www.spoonflower.com/profiles/${encodeURIComponent(customer.customer)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: "var(--ink-500)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            View profile on Spoonflower <Icon name="arrow" size={10} />
          </a>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          fontSize: 12,
          color: "var(--ink-500)",
          flexWrap: "wrap",
        }}
      >
        <Stat label="Orders" value={customer.orders} />
        <Stat label="Gross" value={money(customer.gross)} />
        {customer.refunds > 0 && (
          <Stat
            label="Refunds"
            value={money(customer.refunds)}
            color="var(--brick-700)"
          />
        )}
        <Stat label="Net" value={money(customer.net)} highlight />
        <Stat label="First" value={customer.firstAt.slice(0, 10)} />
        <Stat label="Last" value={customer.lastAt.slice(0, 10)} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  color,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-500)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: highlight ? 15 : 13,
          fontWeight: highlight ? 600 : 400,
          color: color ?? "var(--ink-900)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PurchaseHistory({
  rows,
  cachedSet,
  storageUrlBase,
}: {
  rows: CustomerHistoryRow[];
  cachedSet: Set<number>;
  storageUrlBase: string;
}) {
  if (rows.length === 0)
    return (
      <div style={{ color: "var(--ink-500)", fontSize: 13 }}>
        No purchase history yet.
      </div>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-500)",
        }}
      >
        Purchase history ({rows.length})
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {rows.map((r) => {
          const isRefund = r.type === "refund" || r.amount < 0;
          return (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 10px",
                border: "1px solid var(--parchment-200)",
                borderLeft: isRefund
                  ? "3px solid var(--brick-500)"
                  : "3px solid var(--sage-500)",
                borderRadius: 8,
                background: isRefund
                  ? "rgba(194, 84, 80, 0.03)"
                  : "transparent",
              }}
            >
              {r.design_id ? (
                <DesignThumb
                  designId={r.design_id}
                  title={r.design_title}
                  cached={cachedSet.has(r.design_id)}
                  storageUrlBase={storageUrlBase}
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    background: "var(--parchment-200)",
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {r.design_id ? (
                  <a
                    href={`https://www.spoonflower.com/en/fabric/${r.design_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--ink-900)",
                      textDecoration: "none",
                      fontWeight: 500,
                      fontSize: 13,
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.design_title ?? `Design ${r.design_id}`}
                  </a>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--ink-500)" }}>
                    (no design)
                  </span>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-500)",
                    display: "flex",
                    gap: 8,
                    marginTop: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <span>{r.sold_at.slice(0, 10)}</span>
                  {r.size && (
                    <>
                      <span>·</span>
                      <span>{r.size}</span>
                    </>
                  )}
                  {r.substrate && (
                    <>
                      <span>·</span>
                      <span>{r.substrate}</span>
                    </>
                  )}
                  {r.qty !== 1 && (
                    <>
                      <span>·</span>
                      <span>×{r.qty}</span>
                    </>
                  )}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13.5,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: isRefund ? "var(--brick-700)" : "var(--ink-900)",
                }}
              >
                {isRefund ? "−" : ""}
                {money(Math.abs(r.amount))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Thumbnail — same logic as the analytics page. Storage-first with a
// shimmer placeholder for uncached designs.
function DesignThumb({
  designId,
  title,
  cached,
  storageUrlBase,
  size = 40,
}: {
  designId: number;
  title?: string | null;
  cached: boolean;
  storageUrlBase: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!cached) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background:
            "linear-gradient(90deg, var(--parchment-100), var(--parchment-200), var(--parchment-100))",
          backgroundSize: "200% 100%",
          animation: "customersThumbPulse 1.6s ease-in-out infinite",
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}
        title={`${title ?? designId} — loading`}
      >
        <style>{`@keyframes customersThumbPulse {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }`}</style>
      </div>
    );
  }
  if (failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: "var(--parchment-200)",
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}
        title={title ?? String(designId)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${storageUrlBase}/${designId}.png`}
      alt={title ?? `Design ${designId}`}
      onError={() => setFailed(true)}
      loading="lazy"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--parchment-100)",
        flexShrink: 0,
      }}
    />
  );
}

function EmptyState() {
  return (
    <div
      className="s-card s-card--tinted"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-12) var(--space-5)",
        textAlign: "center",
      }}
    >
      <Icon name="history" size={36} color="var(--ink-300)" />
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          fontWeight: 500,
          margin: 0,
        }}
      >
        No customer history yet
      </h2>
      <p
        style={{
          color: "var(--ink-500)",
          fontSize: 13.5,
          margin: 0,
          maxWidth: 420,
        }}
      >
        Upload a Spoonflower earnings CSV in the Sales &amp; Analytics tab and
        your buyers will show up here.
      </p>
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
