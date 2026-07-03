"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icon";
import {
  ToastViewport,
  useToasts,
  type Toast,
} from "@/components/toast";
import { parseSalesCsv } from "./parse-csv";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type { ParsedSaleRow, UploadSalesResult } from "./actions";
import type { DesignHistoryRow } from "./page";
import type {
  BucketAgg,
  ConversionStats,
  CustomerAgg,
  DailyPoint,
  DayHourHeatmap,
  DesignAgg,
  Headline,
} from "./stats";

type Stats = {
  headline: Headline;
  daily: DailyPoint[];
  topDesigns: DesignAgg[];
  mostRefunded: DesignAgg[];
  substrate: BucketAgg[];
  size: BucketAgg[];
  productCategory: BucketAgg[];
  customers: CustomerAgg[];
  conversion: ConversionStats;
  heatmap: DayHourHeatmap;
};

type SessionUser = {
  email: string;
  displayName: string;
  initial: string;
  plan: "free" | "paid";
};

export default function AnalyticsClient({
  user,
  stats,
  uploadSales,
  cachedDesignIds,
  uncachedDesignIds,
  storageUrlBase,
  historyByDesign,
}: {
  user: SessionUser;
  stats: Stats | null;
  uploadSales: (rows: ParsedSaleRow[]) => Promise<UploadSalesResult>;
  cachedDesignIds: number[];
  uncachedDesignIds: number[];
  storageUrlBase: string;
  historyByDesign: Record<string, DesignHistoryRow[]>;
}) {
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const [locallyCached, setLocallyCached] = useState<Set<number>>(
    () => new Set(cachedDesignIds),
  );

  // Background cache pump. Walks the uncached list, hitting the API one
  // design at a time with 1s spacing. Rate-limited server-side too, but
  // client throttle keeps our own render happy.
  //
  // Auth: we grab the current session's access token from the browser
  // Supabase client (which is the source of truth for the signed-in
  // session in the browser). Earlier we passed the token as a prop from
  // the server, but that returned null in some SSR configurations and
  // silently killed the pump.
  useEffect(() => {
    if (uncachedDesignIds.length === 0) {
      console.log("[analytics] cache pump: nothing to fetch");
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        console.warn(
          "[analytics] cache pump: no browser session — sign in required",
        );
        return;
      }
      console.log(
        `[analytics] cache pump: starting for ${uncachedDesignIds.length} designs`,
      );
      let done = 0;
      let failures = 0;
      for (const id of uncachedDesignIds) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/analytics/cache-design-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ designId: id }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            cached?: boolean;
            status?: number;
            error?: string;
            tagCount?: number;
          };
          if (res.ok && data.cached) {
            setLocallyCached((prev) => {
              if (prev.has(id)) return prev;
              const next = new Set(prev);
              next.add(id);
              return next;
            });
            done++;
            console.log(
              `[analytics] cached ${id}` +
                (data.tagCount != null ? ` (${data.tagCount} tags)` : ""),
            );
          } else {
            failures++;
            console.warn(
              `[analytics] scrape failed for ${id}: HTTP ${res.status}`,
              data,
            );
          }
        } catch (e) {
          failures++;
          console.error(`[analytics] pump threw for ${id}`, e);
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
      console.log(
        `[analytics] cache pump done — ${done} cached, ${failures} failed`,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [uncachedDesignIds]);

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
        <AnalyticsBody
          stats={stats}
          uploadSales={uploadSales}
          pushToast={pushToast}
          cachedSet={locallyCached}
          totalDesignsWithImages={cachedDesignIds.length + uncachedDesignIds.length}
          storageUrlBase={storageUrlBase}
          historyByDesign={historyByDesign}
        />
      </div>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

type PushToast = (t: Omit<Toast, "id">) => number;

function Sidebar({ user }: { user: SessionUser }) {
  const items = [
    {
      href: "/workspace",
      label: "Keyword Library",
      icon: "star" as const,
    },
    {
      href: "/analytics",
      label: "Sales & Analytics",
      icon: "trend-up" as const,
      active: true,
    },
    {
      href: "/customers",
      label: "Customers",
      icon: "history" as const,
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
              border: it.active ? "1px solid var(--border)" : "1px solid transparent",
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
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0, flex: 1 }}>
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

function AnalyticsBody({
  stats,
  uploadSales,
  pushToast,
  cachedSet,
  totalDesignsWithImages,
  storageUrlBase,
  historyByDesign,
}: {
  stats: Stats | null;
  uploadSales: (rows: ParsedSaleRow[]) => Promise<UploadSalesResult>;
  pushToast: PushToast;
  cachedSet: Set<number>;
  totalDesignsWithImages: number;
  storageUrlBase: string;
  historyByDesign: Record<string, DesignHistoryRow[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedDesignId, setSelectedDesignId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { rows, skipped, errors, skipSamples } = parseSalesCsv(text);
      if (errors.length) {
        pushToast({ kind: "error", message: errors[0] });
        return;
      }
      if (!rows.length) {
        pushToast({ kind: "error", message: "No valid rows in CSV." });
        return;
      }
      // Log any skipped rows to the console with reasons so we can
      // debug alternate CSV formats without needing to ship server-side
      // logging for this. Also surface a summary in the toast.
      if (skipSamples.length > 0) {
        console.warn(
          `[analytics/upload] skipped ${skipped} rows during parse. Samples:`,
          skipSamples,
        );
      }
      startTransition(async () => {
        const result = await uploadSales(rows);
        // Explicit breakdown so the user knows exactly what happened.
        // If nothing shows up in the charts they can look at these
        // numbers to figure out where rows went.
        const parts: string[] = [];
        if (result.inserted > 0) parts.push(`${result.inserted} new`);
        if (result.duplicatesSkipped > 0)
          parts.push(`${result.duplicatesSkipped} already saved`);
        if (skipped > 0) parts.push(`${skipped} unparseable`);
        if (result.errors.length)
          parts.push(`${result.errors.length} DB errors`);
        const isSuccess =
          result.errors.length === 0 && result.inserted > 0;
        const isNothing = result.inserted === 0 && result.errors.length === 0;
        const summary =
          parts.length > 0
            ? parts.join(" · ")
            : "No rows to import";
        const skipHint =
          skipSamples.length > 0
            ? `. First skipped row (line ${skipSamples[0].line}): ${skipSamples[0].reason}. See console for more.`
            : "";
        pushToast({
          kind: result.errors.length
            ? "error"
            : isSuccess
              ? "success"
              : "info",
          message: `Received ${rows.length} row${rows.length === 1 ? "" : "s"} · ${summary}${isNothing ? " (all were duplicates or unparseable)" : ""}${skipHint}`,
        });
        router.refresh();
      });
    };
    reader.onerror = () =>
      pushToast({ kind: "error", message: "Couldn't read file." });
    reader.readAsText(file);
  };

  return (
    <div
      style={{
        flex: 1,
        padding: "var(--space-8) var(--space-8) var(--space-10)",
        minWidth: 0,
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
        <PageHeader onUpload={() => fileRef.current?.click()} pending={pending} />
        {totalDesignsWithImages > 0 && (
          <CacheStatusBadge
            cached={cachedSet.size}
            total={totalDesignsWithImages}
          />
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {stats ? (
          <>
            <HeadlineCards h={stats.headline} conversion={stats.conversion} />
            <DailyChart daily={stats.daily} />
            <TopDesigns
              designs={stats.topDesigns}
              cachedSet={cachedSet}
              storageUrlBase={storageUrlBase}
              onSelectDesign={setSelectedDesignId}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "var(--space-4)",
              }}
            >
              <BreakdownCard
                title="By product category"
                data={stats.productCategory}
              />
              <BreakdownCard title="By substrate" data={stats.substrate} />
              <BreakdownCard title="By size" data={stats.size} />
            </div>
            <Conversion
              conversion={stats.conversion}
              cachedSet={cachedSet}
              storageUrlBase={storageUrlBase}
            />
            <DayHourHeatmapCard heatmap={stats.heatmap} />
          </>
        ) : (
          <EmptyState onUpload={() => fileRef.current?.click()} pending={pending} />
        )}
      </div>
      {selectedDesignId != null && stats && (
        <DesignDetailModal
          designId={selectedDesignId}
          design={
            stats.topDesigns.find((d) => d.design_id === selectedDesignId) ??
            null
          }
          history={historyByDesign[String(selectedDesignId)] ?? []}
          cached={cachedSet.has(selectedDesignId)}
          storageUrlBase={storageUrlBase}
          onClose={() => setSelectedDesignId(null)}
        />
      )}
    </div>
  );
}

function DesignDetailModal({
  designId,
  design,
  history,
  cached,
  storageUrlBase,
  onClose,
}: {
  designId: number;
  design: DesignAgg | null;
  history: DesignHistoryRow[];
  cached: boolean;
  storageUrlBase: string;
  onClose: () => void;
}) {
  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sort newest first; refunds get red styling.
  const sortedHistory = useMemo(
    () =>
      [...history].sort((a, b) =>
        a.sold_at < b.sold_at ? 1 : a.sold_at > b.sold_at ? -1 : 0,
      ),
    [history],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Design transaction history"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 24, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-5)",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          maxWidth: 780,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-4)",
            padding: "var(--space-5)",
            borderBottom: "1px solid var(--parchment-200)",
          }}
        >
          <DesignSquareThumb
            designId={designId}
            title={design?.design_title ?? null}
            cached={cached}
            storageUrlBase={storageUrlBase}
            size={120}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <a
              href={`https://www.spoonflower.com/en/fabric/${designId}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`${design?.design_title ?? designId} — open on Spoonflower`}
              style={{
                color: "var(--ink-900)",
                textDecoration: "none",
                display: "block",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  fontWeight: 500,
                  margin: 0,
                  letterSpacing: "-0.015em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {design?.design_title ?? `Design ${designId}`}
                <Icon name="arrow" size={13} color="var(--ink-500)" />
              </h2>
            </a>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-500)",
                fontFamily: "var(--font-mono)",
                marginTop: 4,
              }}
            >
              #{designId}
            </div>
            {design && (
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-3)",
                  flexWrap: "wrap",
                  marginTop: "var(--space-3)",
                  fontSize: 12,
                }}
              >
                <ModalStat label="Sales" value={design.saleCount} />
                <ModalStat label="Units" value={design.units} />
                <ModalStat label="Gross" value={money(design.gross)} />
                {design.refunds > 0 && (
                  <ModalStat
                    label="Refunds"
                    value={`${design.refundCount} · ${money(design.refunds)}`}
                    danger
                  />
                )}
                <ModalStat label="Net" value={money(design.net)} highlight />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              alignSelf: "flex-start",
              background: "transparent",
              border: "none",
              padding: 6,
              cursor: "pointer",
              color: "var(--ink-500)",
              borderRadius: 6,
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        {/* Transaction list */}
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            overflowY: "auto",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-500)",
              marginBottom: "var(--space-2)",
            }}
          >
            Transactions ({sortedHistory.length})
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {sortedHistory.map((r) => {
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
                    fontSize: 13,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>
                      {isRefund ? "Refund" : r.type === "sale" ? "Sale" : r.type}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--ink-500)",
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginTop: 2,
                      }}
                    >
                      <span>{r.sold_at.slice(0, 10)}</span>
                      {r.customer && (
                        <>
                          <span>·</span>
                          <CustomerLink customer={r.customer} />
                        </>
                      )}
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
                      fontSize: 13,
                      fontWeight: 600,
                      color: isRefund
                        ? "var(--brick-700)"
                        : "var(--ink-900)",
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
      </div>
    </div>
  );
}

function ModalStat({
  label,
  value,
  highlight,
  danger,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  danger?: boolean;
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
          color: danger
            ? "var(--brick-700)"
            : highlight
              ? "var(--sage-700)"
              : "var(--ink-900)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CustomerLink({ customer }: { customer: string }) {
  const isGuest = ["guest", "guest_user", "anonymous"].includes(
    customer.toLowerCase(),
  );
  if (isGuest) {
    return (
      <span style={{ color: "var(--ink-500)" }}>guest user</span>
    );
  }
  return (
    <a
      href={`https://www.spoonflower.com/profiles/${encodeURIComponent(customer)}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "var(--ink-700)",
        textDecoration: "none",
        borderBottom: "1px dotted var(--ink-300)",
      }}
    >
      {customer}
    </a>
  );
}

function CacheStatusBadge({
  cached,
  total,
}: {
  cached: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((cached / total) * 100) : 0;
  const done = cached >= total;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--parchment-100)",
        fontSize: 12,
        color: "var(--ink-700)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: done ? "var(--sage-500)" : "var(--saffron-500)",
          animation: done ? "none" : "cachePulse 1.5s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes cachePulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }`}</style>
      <span>
        Design images:{" "}
        <strong style={{ color: "var(--ink-900)" }}>
          {cached} / {total}
        </strong>{" "}
        ready ({pct}%)
      </span>
      <span style={{ marginLeft: "auto", color: "var(--ink-500)", fontSize: 11 }}>
        {done
          ? "All caught up"
          : "Still loading — this happens once, then they’re yours"}
      </span>
    </div>
  );
}

function PageHeader({
  onUpload,
  pending,
}: {
  onUpload: () => void;
  pending: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "var(--space-3)",
      }}
    >
      <div>
        <div className="eyebrow" style={{ color: "var(--ink-500)" }}>
          Sales & Analytics
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 30,
            fontWeight: 500,
            color: "var(--ink-900)",
            letterSpacing: "-0.018em",
            margin: "var(--space-1) 0 0",
            lineHeight: 1.1,
          }}
        >
          Your Spoonflower earnings
        </h1>
      </div>
      <button
        type="button"
        className="btn btn--accent"
        onClick={onUpload}
        disabled={pending}
      >
        <Icon name="file" size={13} /> {pending ? "Uploading…" : "Upload CSV"}
      </button>
    </div>
  );
}

function EmptyState({
  onUpload,
  pending,
}: {
  onUpload: () => void;
  pending: boolean;
}) {
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
      <Icon name="trend-up" size={40} color="var(--ink-300)" />
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 500,
          margin: 0,
        }}
      >
        Upload your Spoonflower earnings CSV
      </h2>
      <p
        style={{
          color: "var(--ink-500)",
          fontSize: 14,
          maxWidth: 480,
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        On Spoonflower go to your seller dashboard &rarr; Earnings &rarr; Export.
        Upload the file here. Every column is preserved and re-uploads are
        deduped, so you can re-import the same file safely.
      </p>
      <button
        type="button"
        className="btn btn--accent"
        onClick={onUpload}
        disabled={pending}
      >
        <Icon name="file" size={13} /> {pending ? "Uploading…" : "Upload CSV"}
      </button>
    </div>
  );
}

function HeadlineCards({
  h,
  conversion,
}: {
  h: Headline;
  conversion: ConversionStats;
}) {
  const cards = [
    {
      label: "Net revenue",
      value: money(h.netRevenue),
      sub: `${money(h.grossRevenue)} gross · ${money(h.refundsTotal)} refunds`,
    },
    {
      label: "Sales",
      value: h.saleCount.toLocaleString("en-US"),
      sub: `${money(h.avgSaleAmount)} avg · ${h.refundCount} refunds`,
    },
    {
      label: "Customers",
      value: `${h.uniqueCustomers.toLocaleString("en-US")} signed-in`,
      sub:
        h.saleCount > 0
          ? `${h.returningCustomers} returning`
          : "no sales yet",
    },
    {
      label: "Unique designs",
      value: h.uniqueDesigns.toLocaleString("en-US"),
      sub: "bought at least once",
    },
    {
      label: "Swatch → sale",
      value:
        conversion.sampleCount > 0 ? `${conversion.rate}%` : "—",
      sub:
        conversion.sampleCount > 0
          ? `${conversion.convertedCount} of ${conversion.sampleCount} swatches converted`
          : "no swatch purchases yet",
    },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "var(--space-3)",
      }}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          className="s-card"
          style={{
            padding: "var(--space-4) var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-500)",
            }}
          >
            {c.label}
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              color: "var(--ink-900)",
              lineHeight: 1.1,
            }}
          >
            {c.value}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

type TimeframeOption = { key: "30d" | "90d" | "6mo" | "1y" | "all"; label: string; days: number | null };

const TIMEFRAMES: TimeframeOption[] = [
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "6mo", label: "6 months", days: 183 },
  { key: "1y", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: null },
];

type ChartMode = "revenue" | "quantity";

const MODE_META: Record<
  ChartMode,
  { label: string; short: string; format: (v: number) => string }
> = {
  revenue: {
    label: "Net revenue per day",
    short: "$",
    format: (v) => money(v),
  },
  quantity: {
    label: "Quantity per day",
    short: "quantity",
    format: (v) => v.toLocaleString("en-US"),
  },
};

function DailyChart({ daily }: { daily: DailyPoint[] }) {
  const [mode, setMode] = useState<ChartMode>("revenue");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Default to 30 days, but fall back to "all" if we have fewer than 30
  // days of data — otherwise the chart looks broken (huge visible range,
  // one data point at the far right).
  const [timeframe, setTimeframe] = useState<TimeframeOption["key"]>(
    daily.length >= 30 ? "30d" : "all",
  );

  const visibleDaily = useMemo(() => {
    const tf = TIMEFRAMES.find((t) => t.key === timeframe) ?? TIMEFRAMES[0];
    if (!tf.days) return daily;
    return daily.slice(-tf.days);
  }, [daily, timeframe]);

  const width = 1080;
  const height = 200;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const innerW = width - paddingLeft - paddingRight;
  const innerH = height - paddingTop - paddingBottom;

  const { points, maxVal } = useMemo(() => {
    const values = visibleDaily.map((d) =>
      mode === "quantity" ? d.qty : d.net,
    );
    const max = Math.max(1, ...values);
    const step = visibleDaily.length > 1 ? innerW / (visibleDaily.length - 1) : 0;
    const points = visibleDaily.map((_, i) => ({
      x: paddingLeft + i * step,
      y: paddingTop + innerH - (values[i] / max) * innerH,
      value: values[i],
      day: visibleDaily[i].day,
    }));
    return { points, maxVal: max };
  }, [visibleDaily, mode, innerW, innerH]);

  const svgRef = useRef<SVGSVGElement>(null);

  // Find the index of the closest data point to the mouse's SVG-space x.
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || visibleDaily.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dx = Math.abs(points[i].x - svgX);
      if (dx < bestDist) {
        bestDist = dx;
        bestIdx = i;
      }
    }
    setHoverIdx(bestIdx);
  };
  const onMouseLeave = () => setHoverIdx(null);
  const hovered =
    hoverIdx != null && visibleDaily[hoverIdx]
      ? { point: points[hoverIdx], day: visibleDaily[hoverIdx] }
      : null;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  const areaPath = points.length
    ? `${path} L${points[points.length - 1].x},${paddingTop + innerH} L${points[0].x},${paddingTop + innerH} Z`
    : "";

  return (
    <div
      className="s-card"
      style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
          }}
        >
          {MODE_META[mode].label}
        </h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(Object.keys(MODE_META) as ChartMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn btn--xs ${mode === m ? "" : "btn--ghost"}`}
                onClick={() => setMode(m)}
              >
                {MODE_META[m].short}
              </button>
            ))}
          </div>
          <span
            aria-hidden
            style={{
              width: 1,
              height: 16,
              background: "var(--parchment-200)",
              margin: "0 2px",
            }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {TIMEFRAMES.map((t) => {
              const disabled = t.days !== null && daily.length < t.days / 3;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`btn btn--xs ${timeframe === t.key ? "" : "btn--ghost"}`}
                  onClick={() => setTimeframe(t.key)}
                  disabled={disabled}
                  title={disabled ? "Not enough data for this range yet" : undefined}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={{ overflow: "visible", cursor: "crosshair" }}
        >
          <defs>
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sage-500)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--sage-500)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={paddingLeft}
              x2={paddingLeft + innerW}
              y1={paddingTop + innerH * (1 - t)}
              y2={paddingTop + innerH * (1 - t)}
              stroke="var(--parchment-200)"
              strokeWidth={1}
            />
          ))}
          {areaPath && <path d={areaPath} fill="url(#area-grad)" />}
          {path && (
            <path d={path} stroke="var(--sage-700)" strokeWidth={2} fill="none" />
          )}
          {points.map((p, i) => (
            <circle
              key={p.day}
              cx={p.x}
              cy={p.y}
              r={hoverIdx === i ? 4.5 : 2.5}
              fill="var(--sage-700)"
              stroke={hoverIdx === i ? "#fff" : "none"}
              strokeWidth={hoverIdx === i ? 2 : 0}
            />
          ))}
          {hovered && (
            <line
              x1={hovered.point.x}
              x2={hovered.point.x}
              y1={paddingTop}
              y2={paddingTop + innerH}
              stroke="var(--ink-300)"
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}
          {points.length > 0 && (
            <>
              <text
                x={paddingLeft}
                y={paddingTop + innerH + 18}
                fontSize="11"
                fill="var(--ink-500)"
                textAnchor="start"
              >
                {points[0].day}
              </text>
              <text
                x={paddingLeft + innerW}
                y={paddingTop + innerH + 18}
                fontSize="11"
                fill="var(--ink-500)"
                textAnchor="end"
              >
                {points[points.length - 1].day}
              </text>
              <text
                x={paddingLeft - 8}
                y={paddingTop + 4}
                fontSize="11"
                fill="var(--ink-500)"
                textAnchor="end"
              >
                {MODE_META[mode].format(maxVal)}
              </text>
            </>
          )}
        </svg>
        {hovered && (
          <HoverTooltip
            day={hovered.day}
            containerWidth={width}
            xInViewBox={hovered.point.x}
            yInViewBox={hovered.point.y}
            viewBoxHeight={height}
          />
        )}
      </div>
    </div>
  );
}

// Positioned tooltip above the hovered data point. Translates the point's
// SVG-space coordinates to CSS % so it tracks the chart even when the
// SVG scales responsively.
function HoverTooltip({
  day,
  containerWidth,
  xInViewBox,
  yInViewBox,
  viewBoxHeight,
}: {
  day: DailyPoint;
  containerWidth: number;
  xInViewBox: number;
  yInViewBox: number;
  viewBoxHeight: number;
}) {
  const leftPct = (xInViewBox / containerWidth) * 100;
  const topPct = (yInViewBox / viewBoxHeight) * 100;
  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: "translate(-50%, calc(-100% - 12px))",
        pointerEvents: "none",
        background: "var(--ink-900)",
        color: "var(--parchment-50)",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 11.5,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        boxShadow: "var(--shadow-md)",
        zIndex: 5,
        fontFamily: "var(--font-mono)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{day.day}</div>
      <div>
        <span style={{ opacity: 0.7 }}>net </span>
        {money(day.net)}
      </div>
      <div>
        <span style={{ opacity: 0.7 }}># sales </span>
        {day.count.toLocaleString("en-US")}
      </div>
      <div>
        <span style={{ opacity: 0.7 }}>qty </span>
        {day.qty.toLocaleString("en-US")}
      </div>
      {day.refunds > 0 && (
        <div style={{ color: "var(--brick-500)" }}>
          <span style={{ opacity: 0.7 }}>refunds </span>
          {money(day.refunds)}
        </div>
      )}
    </div>
  );
}

// Thumbnail for a design.
//   - If we've cached the image to Supabase Storage → serve from there.
//   - Else → soft loading tile with a subtle pulse. The scrape worker
//     will populate Storage in the background; a page refresh will pick
//     up the cached URL.
//   - If Storage's URL 404s (rare) → static placeholder tile.
//
// We no longer render Spoonflower's own CDN URL directly because their
// public URL scheme requires a signed hash we don't know until we scrape
// the listing page.
function DesignThumb({
  designId,
  title,
  size = 44,
  cached,
  storageUrlBase,
}: {
  designId: number;
  title?: string | null;
  size?: number;
  cached: boolean;
  storageUrlBase: string;
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
          animation: "designThumbPulse 1.6s ease-in-out infinite",
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}
        title={`${title ?? designId} — image is loading`}
        aria-label="Design image loading"
      >
        <style>{`@keyframes designThumbPulse {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }`}</style>
      </div>
    );
  }
  const src = `${storageUrlBase}/${designId}.png`;
  if (failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: "var(--parchment-200)",
          border: "1px solid var(--border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-300)",
          flexShrink: 0,
        }}
        title={title ?? String(designId)}
      >
        <Icon name="file" size={14} />
      </div>
    );
  }
  return (
    // Native img tag (not next/image) — Spoonflower's CDN is external and
    // we'd need to whitelist the domain in next.config; direct img keeps
    // this feature self-contained.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
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

type TopDesignSort = "net" | "sales" | "refundDollars" | "refundCount";

const TOP_SORT_META: Record<
  TopDesignSort,
  { label: string; short: string; title: string }
> = {
  net: {
    label: "Net revenue",
    short: "$ net",
    title: "Top designs by net revenue",
  },
  sales: {
    label: "Sales",
    short: "# sales",
    title: "Top designs by sales count",
  },
  refundDollars: {
    label: "Refund $",
    short: "$ refund",
    title: "Top designs by refund dollars",
  },
  refundCount: {
    label: "Refunds",
    short: "# refund",
    title: "Top designs by refund frequency",
  },
};

function TopDesigns({
  designs,
  cachedSet,
  storageUrlBase,
  onSelectDesign,
}: {
  designs: DesignAgg[];
  cachedSet: Set<number>;
  storageUrlBase: string;
  onSelectDesign: (id: number) => void;
}) {
  const [sortMode, setSortMode] = useState<TopDesignSort>("net");

  const sorted = useMemo(() => {
    // Refund sort modes filter out designs with no refunds — otherwise
    // the tail of the grid is padded with cards showing "0 refunds",
    // which is noisy and hides the useful signal. Net / sales modes show
    // all designs.
    const filtered =
      sortMode === "refundDollars"
        ? designs.filter((d) => d.refunds > 0)
        : sortMode === "refundCount"
          ? designs.filter((d) => d.refundCount > 0)
          : designs;
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortMode === "sales") return b.saleCount - a.saleCount;
      if (sortMode === "refundDollars") return b.refunds - a.refunds;
      if (sortMode === "refundCount") return b.refundCount - a.refundCount;
      return b.net - a.net;
    });
    return copy;
  }, [designs, sortMode]);

  if (!designs.length) return null;
  return (
    <div className="s-card" style={{ padding: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          marginBottom: "var(--space-3)",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 500,
              margin: 0,
            }}
          >
            {TOP_SORT_META[sortMode].title}
          </h2>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-500)",
              marginTop: 2,
            }}
          >
            {designs.length}{" "}
            {designs.length === 1
              ? "unique design bought"
              : "unique designs bought"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(Object.keys(TOP_SORT_META) as TopDesignSort[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`btn btn--xs ${sortMode === m ? "" : "btn--ghost"}`}
              onClick={() => setSortMode(m)}
              title={`Sort by ${TOP_SORT_META[m].label}`}
            >
              {TOP_SORT_META[m].short}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {sorted.map((d) => (
          <DesignThumbCard
            key={d.design_id}
            design={d}
            cached={cachedSet.has(d.design_id)}
            storageUrlBase={storageUrlBase}
            sortMode={sortMode}
            onClick={() => onSelectDesign(d.design_id)}
          />
        ))}
      </div>
    </div>
  );
}

// Card that renders one design in the Top Designs grid. Modeled after the
// extension's `.thumb-card` pattern — square thumbnail on top, tight
// text block underneath (title, stats, primary value). The sort mode
// determines which value the card foregrounds so the emphasized number
// aligns with what the user is ranking by.
function DesignThumbCard({
  design,
  cached,
  storageUrlBase,
  sortMode,
  onClick,
}: {
  design: DesignAgg;
  cached: boolean;
  storageUrlBase: string;
  sortMode: TopDesignSort;
  onClick: () => void;
}) {
  const primary =
    sortMode === "sales"
      ? { value: design.saleCount.toLocaleString("en-US"), label: "sold" }
      : sortMode === "refundDollars"
        ? { value: money(design.refunds), label: "refunded", danger: true }
        : sortMode === "refundCount"
          ? { value: design.refundCount.toLocaleString("en-US"), label: "refunds", danger: true }
          : { value: money(design.net), label: "net" };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--parchment-200)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        color: "var(--ink-900)",
        cursor: "pointer",
        padding: 0,
        textAlign: "left",
        font: "inherit",
        transition: "border-color 160ms ease-out",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--slate-300)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--parchment-200)";
      }}
    >
      <DesignSquareThumb
        designId={design.design_id}
        title={design.design_title}
        cached={cached}
        storageUrlBase={storageUrlBase}
      />
      <div
        style={{
          padding: "8px 10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-900)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 500,
          }}
          title={design.design_title}
        >
          {design.design_title}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--ink-500)",
          }}
        >
          <span>
            {design.saleCount} sold
            {design.refundCount > 0 && (
              <span style={{ color: "var(--brick-700)" }}>
                {" · "}
                {design.refundCount}↩
              </span>
            )}
          </span>
          <span
            style={{
              fontWeight: 600,
              color: primary.danger
                ? "var(--brick-700)"
                : "var(--sage-700)",
            }}
            title={primary.label}
          >
            {primary.value}
          </span>
        </div>
      </div>
    </button>
  );
}

// Square-aspect thumbnail — same source-of-truth logic as the row-style
// DesignThumb (cached from Storage → real image; uncached → shimmer;
// failed → static placeholder) but rendered as a 100%-width block that
// fills the card and enforces a 1:1 crop.
function DesignSquareThumb({
  designId,
  title,
  cached,
  storageUrlBase,
  size,
}: {
  designId: number;
  title: string | null;
  cached: boolean;
  storageUrlBase: string;
  // Optional fixed width in pixels. Defaults to 100% (fills container),
  // which is right for the grid card. Modal header passes a specific
  // pixel value so the thumb doesn't hog the flex row.
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const commonSquareStyle: React.CSSProperties = {
    width: size != null ? size : "100%",
    aspectRatio: "1 / 1",
    display: "block",
    background: "var(--parchment-100)",
    flexShrink: 0,
    borderRadius: size != null ? "var(--radius-md)" : undefined,
  };
  if (!cached) {
    return (
      <div
        style={{
          ...commonSquareStyle,
          background:
            "linear-gradient(90deg, var(--parchment-100), var(--parchment-200), var(--parchment-100))",
          backgroundSize: "200% 100%",
          animation: "designSqThumbPulse 1.6s ease-in-out infinite",
        }}
        title={`${title ?? designId} — loading`}
      >
        <style>{`@keyframes designSqThumbPulse {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }`}</style>
      </div>
    );
  }
  if (failed) {
    return (
      <div
        style={{ ...commonSquareStyle, background: "var(--parchment-200)" }}
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
      style={{ ...commonSquareStyle, objectFit: "cover" }}
    />
  );
}

function SortableHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        font: "inherit",
        color: active ? "var(--ink-900)" : "inherit",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontSize: 10.5,
        fontWeight: 700,
      }}
    >
      {label}
      {active && (
        <span
          aria-hidden
          style={{ fontSize: 10, color: "var(--ink-900)" }}
        >
          ↓
        </span>
      )}
    </button>
  );
}

function MostRefunded({
  designs,
  cachedSet,
  storageUrlBase,
}: {
  designs: DesignAgg[];
  cachedSet: Set<number>;
  storageUrlBase: string;
}) {
  return (
    <div
      className="s-card"
      style={{
        padding: "var(--space-4)",
        borderLeft: "3px solid var(--brick-500)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "var(--space-3)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
          }}
        >
          Most refunded designs
        </h2>
        <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
          net = gross − refunds
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr style={{ color: "var(--ink-500)", textAlign: "left" }}>
              <Th>Design</Th>
              <Th align="right">Gross</Th>
              <Th align="right">Refunded</Th>
              <Th align="right">Net</Th>
              <Th align="right">Refund %</Th>
            </tr>
          </thead>
          <tbody>
            {designs.map((d) => {
              const pct = d.gross > 0
                ? Math.round((d.refunds / d.gross) * 100)
                : 100;
              return (
                <tr
                  key={d.design_id}
                  style={{ borderTop: "1px solid var(--parchment-200)" }}
                >
                  <Td>
                    <a
                      href={`https://www.spoonflower.com/en/fabric/${d.design_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--ink-900)",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <DesignThumb
                        designId={d.design_id}
                        title={d.design_title}
                        cached={cachedSet.has(d.design_id)}
                        storageUrlBase={storageUrlBase}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{d.design_title}</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--ink-500)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          #{d.design_id}
                        </div>
                      </div>
                    </a>
                  </Td>
                  <Td align="right">{money(d.gross)}</Td>
                  <Td align="right" bold>
                    <span style={{ color: "var(--brick-700)" }}>
                      {money(d.refunds)}
                    </span>
                  </Td>
                  <Td align="right">{money(d.net)}</Td>
                  <Td align="right">
                    <span
                      style={{
                        color: pct >= 50 ? "var(--brick-700)" : "var(--ink-700)",
                        fontWeight: pct >= 50 ? 600 : 400,
                      }}
                    >
                      {pct}%
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  data,
}: {
  title: string;
  data: BucketAgg[];
}) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.net));
  return (
    <div className="s-card" style={{ padding: "var(--space-4)" }}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 16,
          fontWeight: 500,
          margin: "0 0 var(--space-3)",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((b) => (
          <div key={b.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 6,
                fontSize: 12.5,
              }}
            >
              <span style={{ color: "var(--ink-900)" }}>{b.label}</span>
              <span style={{ color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
                {money(b.net)} · {b.count}
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--parchment-200)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(b.net / max) * 100}%`,
                  background: "var(--sage-500)",
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Customers({ customers }: { customers: CustomerAgg[] }) {
  if (!customers.length) return null;
  const repeatCount = customers.filter((c) => c.orders > 1).length;
  return (
    <div className="s-card" style={{ padding: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "var(--space-3)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
          }}
        >
          Customers
        </h2>
        <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
          {customers.length} unique · {repeatCount} repeat
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--ink-500)", textAlign: "left" }}>
              <Th>Customer</Th>
              <Th align="right">Orders</Th>
              <Th align="right">Gross</Th>
              <Th align="right">Net</Th>
              <Th>First</Th>
              <Th>Last</Th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.customer}
                style={{ borderTop: "1px solid var(--parchment-200)" }}
              >
                <Td>
                  {c.isGuest ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--ink-500)",
                      }}
                    >
                      <Icon name="star" size={11} /> {c.customer}
                    </span>
                  ) : (
                    c.customer
                  )}
                </Td>
                <Td align="right">{c.orders}</Td>
                <Td align="right">{money(c.gross)}</Td>
                <Td align="right" bold>
                  {money(c.net)}
                </Td>
                <Td>{c.firstAt.slice(0, 10)}</Td>
                <Td>{c.lastAt.slice(0, 10)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      style={{
        padding: "6px 8px",
        fontWeight: 700,
        fontSize: 10.5,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--ink-500)",
        textAlign: align === "right" ? "right" : "left",
        borderBottom: "1px solid var(--parchment-200)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  bold,
}: {
  children: React.ReactNode;
  align?: "right";
  bold?: boolean;
}) {
  return (
    <td
      style={{
        padding: "8px",
        textAlign: align === "right" ? "right" : "left",
        color: "var(--ink-900)",
        fontFamily: align === "right" ? "var(--font-mono)" : "inherit",
        fontWeight: bold ? 600 : 400,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </td>
  );
}

function Conversion({
  conversion,
  cachedSet,
  storageUrlBase,
}: {
  conversion: ConversionStats;
  cachedSet: Set<number>;
  storageUrlBase: string;
}) {
  if (conversion.sampleCount === 0) return null;
  const rate = conversion.rate;
  return (
    <div className="s-card" style={{ padding: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "var(--space-3)",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
          }}
        >
          Sample → full purchase conversion
        </h2>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: rate >= 15
              ? "var(--sage-700)"
              : rate >= 5
                ? "var(--ink-700)"
                : "var(--brick-700)",
            fontWeight: 600,
          }}
        >
          {rate}% overall · {conversion.convertedCount} of {conversion.sampleCount}
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: "var(--ink-500)",
          margin: "0 0 var(--space-3)",
          lineHeight: 1.5,
        }}
      >
        A conversion is a swatch/sample purchase that the same signed-in
        buyer followed with a full-product purchase of the same design.
        Anonymous <em>guest</em> samples aren&rsquo;t counted since we
        can&rsquo;t attribute them.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--ink-500)", textAlign: "left" }}>
              <Th>Design</Th>
              <Th align="right">Samples</Th>
              <Th align="right">Converted</Th>
              <Th align="right">Rate</Th>
              <Th align="right">Full-product $</Th>
            </tr>
          </thead>
          <tbody>
            {conversion.perDesign.map((d) => (
              <tr
                key={d.design_id}
                style={{ borderTop: "1px solid var(--parchment-200)" }}
              >
                <Td>
                  <a
                    href={`https://www.spoonflower.com/en/fabric/${d.design_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--ink-900)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <DesignThumb
                      designId={d.design_id}
                      title={d.design_title}
                      cached={cachedSet.has(d.design_id)}
                      storageUrlBase={storageUrlBase}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{d.design_title}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--ink-500)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        #{d.design_id}
                      </div>
                    </div>
                  </a>
                </Td>
                <Td align="right">{d.samples}</Td>
                <Td align="right">{d.conversions}</Td>
                <Td align="right" bold>
                  <span
                    style={{
                      color: d.rate >= 15
                        ? "var(--sage-700)"
                        : d.rate >= 5
                          ? "var(--ink-700)"
                          : "var(--brick-700)",
                    }}
                  >
                    {d.rate}%
                  </span>
                </Td>
                <Td align="right">{money(d.fullRevenue)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayHourHeatmapCard({ heatmap }: { heatmap: DayHourHeatmap }) {
  if (heatmap.totalSales === 0) return null;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="s-card" style={{ padding: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "var(--space-3)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
          }}
        >
          When do sales happen
        </h2>
        <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
          UTC · darker = more $
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "36px repeat(24, minmax(20px, 1fr))",
            gap: 2,
            minWidth: 620,
          }}
        >
          <div />
          {Array.from({ length: 24 }).map((_, h) => (
            <div
              key={h}
              style={{
                fontSize: 10,
                textAlign: "center",
                color: "var(--ink-500)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
          {days.map((label, dayIdx) => (
            <RowFragment
              key={label}
              label={label}
              row={heatmap.matrix[dayIdx]}
              max={heatmap.max}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RowFragment({
  label,
  row,
  max,
}: {
  label: string;
  row: number[];
  max: number;
}) {
  return (
    <>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-500)",
          fontWeight: 600,
          alignSelf: "center",
        }}
      >
        {label}
      </div>
      {row.map((v, h) => {
        const t = max > 0 ? v / max : 0;
        const alpha = 0.08 + t * 0.72;
        return (
          <div
            key={h}
            title={`${label} ${h}:00 UTC · ${v > 0 ? money(v) : "no sales"}`}
            style={{
              height: 22,
              borderRadius: 3,
              background:
                v > 0
                  ? `rgba(74, 120, 88, ${alpha})`
                  : "var(--parchment-200)",
            }}
          />
        );
      })}
    </>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
