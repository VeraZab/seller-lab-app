"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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
import type {
  ParsedSaleRow,
  SaleConflict,
  UploadSalesResult,
} from "./actions";
import type { DesignHistoryRow } from "./page";
import type {
  BucketAgg,
  ConversionStats,
  CustomerAgg,
  DailyPoint,
  HeatmapEvent,
  DesignAgg,
  DesignMonthlySeries,
  Headline,
  KeywordMonthlySeries,
  MyPurchasesSummary,
  YearlySeries,
} from "./stats";

type KpiBundle = {
  headline: Headline;
  myPurchases: MyPurchasesSummary;
  conversion: ConversionStats;
};

type Stats = {
  headline: Headline;
  myPurchases: MyPurchasesSummary;
  kpisByYear: Record<string, KpiBundle>;
  availableYears: number[];
  daily: DailyPoint[];
  yearly: YearlySeries[];
  topDesigns: DesignAgg[];
  topDesignsMonthly: { series: DesignMonthlySeries[]; months: string[] };
  topKeywordsMonthly: { series: KeywordMonthlySeries[]; months: string[] };
  mostRefunded: DesignAgg[];
  substrate: BucketAgg[];
  size: BucketAgg[];
  productCategory: BucketAgg[];
  customers: CustomerAgg[];
  conversion: ConversionStats;
  heatmapEvents: HeatmapEvent[];
};

type SessionUser = {
  email: string;
  displayName: string;
  initial: string;
  plan: "free" | "paid";
};

export type SyncSummary = {
  earliestSaleAt: string | null;
  latestSaleAt: string | null;
  totalSaleEvents: number;
};

export default function AnalyticsClient({
  user,
  stats,
  uploadSales,
  cachedDesignIds,
  uncachedDesignIds,
  storageUrlBase,
  historyByDesign,
  syncSummary,
}: {
  user: SessionUser;
  stats: Stats | null;
  uploadSales: (rows: ParsedSaleRow[]) => Promise<UploadSalesResult>;
  cachedDesignIds: number[];
  uncachedDesignIds: number[];
  storageUrlBase: string;
  historyByDesign: Record<string, DesignHistoryRow[]>;
  syncSummary: SyncSummary;
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
          syncSummary={syncSummary}
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
  syncSummary,
}: {
  stats: Stats | null;
  uploadSales: (rows: ParsedSaleRow[]) => Promise<UploadSalesResult>;
  pushToast: PushToast;
  cachedSet: Set<number>;
  totalDesignsWithImages: number;
  storageUrlBase: string;
  historyByDesign: Record<string, DesignHistoryRow[]>;
  syncSummary: SyncSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedDesignId, setSelectedDesignId] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<SaleConflict[]>([]);
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
        setConflicts(result.conflicts);
        if (result.conflicts.length > 0) {
          console.warn(
            `[analytics/upload] ${result.conflicts.length} rows in CSV differ from existing sales_events on amount/size/qty:`,
            result.conflicts,
          );
        }
        // Explicit breakdown so the user knows exactly what happened.
        // If nothing shows up in the charts they can look at these
        // numbers to figure out where rows went.
        const parts: string[] = [];
        if (result.inserted > 0) parts.push(`${result.inserted} new`);
        if (result.duplicatesSkipped > 0)
          parts.push(`${result.duplicatesSkipped} already saved`);
        if (result.conflicts.length > 0)
          parts.push(`${result.conflicts.length} corrected on Spoonflower`);
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
            syncSummary={syncSummary}
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
        {conflicts.length > 0 && (
          <ConflictsBanner
            conflicts={conflicts}
            onDismiss={() => setConflicts([])}
          />
        )}
        {stats ? (
          <>
            <HeadlineSection
              kpisByYear={stats.kpisByYear}
              availableYears={stats.availableYears}
            />
            <YearOverYearChart yearly={stats.yearly} />
            <Top10KeywordsChart
              series={stats.topKeywordsMonthly.series}
              months={stats.topKeywordsMonthly.months}
            />
            <Top10DesignsChart
              series={stats.topDesignsMonthly.series}
              months={stats.topDesignsMonthly.months}
              cachedSet={cachedSet}
              storageUrlBase={storageUrlBase}
            />
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
            <DayHourHeatmapCard events={stats.heatmapEvents} />
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
  syncSummary,
}: {
  cached: number;
  total: number;
  syncSummary: SyncSummary;
}) {
  const done = cached >= total;
  const range = formatSyncRange(
    syncSummary.earliestSaleAt,
    syncSummary.latestSaleAt,
  );
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
        Synced{" "}
        <strong style={{ color: "var(--ink-900)" }}>
          {syncSummary.totalSaleEvents.toLocaleString("en-US")}
        </strong>{" "}
        entr{syncSummary.totalSaleEvents === 1 ? "y" : "ies"}
        {" "}
        <span style={{ color: "var(--ink-500)" }}>
          (sales, refunds, debits, adjustments)
        </span>
        {range && (
          <>
            {" "}
            from{" "}
            <strong style={{ color: "var(--ink-900)" }}>{range}</strong>
          </>
        )}
        {" · "}
        <strong style={{ color: "var(--ink-900)" }}>{total}</strong> design
        {total === 1 ? "" : "s"}
        {done ? (
          <>
            {" · "}
            <strong style={{ color: "var(--ink-900)" }}>thumbnails ready</strong>
          </>
        ) : (
          <>
            {" · "}
            <strong style={{ color: "var(--ink-900)" }}>
              {cached} / {total} thumbnails
            </strong>{" "}
            cached
          </>
        )}
      </span>
      <span style={{ marginLeft: "auto", color: "var(--ink-500)", fontSize: 11 }}>
        {done
          ? "All caught up — upload a fresh CSV to add more"
          : "Still fetching thumbnails from Spoonflower"}
      </span>
    </div>
  );
}

// Format the sale-range covered by the events synced to our DB. Shows
// month-precision when the range spans multiple months (typical), or a
// single-month label if all data lives in one month.
function formatSyncRange(
  earliestIso: string | null,
  latestIso: string | null,
): string | null {
  if (!earliestIso || !latestIso) return null;
  const a = new Date(earliestIso);
  const b = new Date(latestIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const fmt = (d: Date) =>
    `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const start = fmt(a);
  const end = fmt(b);
  return start === end ? start : `${start} – ${end}`;
}

function ConflictsBanner({
  conflicts,
  onDismiss,
}: {
  conflicts: SaleConflict[];
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid var(--saffron-400, #d9a441)",
        borderLeft: "3px solid var(--saffron-500, #b8863a)",
        borderRadius: 8,
        background: "var(--saffron-50, #fdf6e9)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ color: "var(--ink-900)", fontSize: 13 }}>
          {conflicts.length} sale
          {conflicts.length === 1 ? "" : "s"} may have been corrected on
          Spoonflower
        </strong>
        <span style={{ color: "var(--ink-500)", fontSize: 12 }}>
          Same date + design + customer, different amount or size in this CSV
          vs. what&rsquo;s already saved. Nothing was changed — the existing
          rows are still counted. Delete + re-upload if you want to accept the
          new values.
        </span>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: "var(--ink-600)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
      <div
        style={{
          maxHeight: 220,
          overflowY: "auto",
          borderTop: "1px solid var(--saffron-200, #eadcb5)",
          paddingTop: 8,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {conflicts.slice(0, 50).map((c, i) => (
          <ConflictRow key={i} c={c} />
        ))}
        {conflicts.length > 50 && (
          <span style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 4 }}>
            + {conflicts.length - 50} more (see browser console for full list)
          </span>
        )}
      </div>
    </div>
  );
}

function ConflictRow({ c }: { c: SaleConflict }) {
  const date = c.sold_at.slice(0, 10);
  const who = c.customer && c.customer.trim() ? c.customer : "guest";
  const label = c.design_title ?? (c.design_id ? `#${c.design_id}` : "unknown");
  const diffs: string[] = [];
  if (Math.abs(c.existing.amount - c.incoming.amount) > 0.005) {
    diffs.push(
      `$${c.existing.amount.toFixed(2)} → $${c.incoming.amount.toFixed(2)}`,
    );
  }
  if ((c.existing.size ?? "") !== (c.incoming.size ?? "")) {
    diffs.push(`${c.existing.size ?? "—"} → ${c.incoming.size ?? "—"}`);
  }
  if (c.existing.qty !== c.incoming.qty) {
    diffs.push(`qty ${c.existing.qty} → ${c.incoming.qty}`);
  }
  return (
    <div style={{ fontSize: 12, color: "var(--ink-700)" }}>
      <span style={{ color: "var(--ink-500)" }}>{date}</span>
      {" · "}
      <span style={{ color: "var(--ink-900)" }}>{label}</span>
      {" · "}
      <span style={{ color: "var(--ink-500)" }}>{who}</span>
      {" — "}
      <span>{diffs.join("; ")}</span>
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

// Wraps HeadlineCards with a period filter that matches the chart
// controls (All years · '24 · '25 · '26). Selected year picks the
// pre-computed KPI bundle for that year.
function HeadlineSection({
  kpisByYear,
  availableYears,
}: {
  kpisByYear: Record<string, KpiBundle>;
  availableYears: number[];
}) {
  const [year, setYear] = useState<number | null>(null);
  const bundle = year == null ? kpisByYear.all : kpisByYear[String(year)];
  if (!bundle) return null;
  const periodLabel = year == null ? "All years" : `${year}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
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
          Overview
          <span
            style={{
              color: "var(--ink-500)",
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 13,
              marginLeft: 8,
            }}
          >
            {periodLabel}
          </span>
        </h2>
        {availableYears.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn btn--xs ${year == null ? "" : "btn--ghost"}`}
              onClick={() => setYear(null)}
            >
              All years
            </button>
            {availableYears.map((y, i) => (
              <button
                key={y}
                type="button"
                className={`btn btn--xs ${year === y ? "" : "btn--ghost"}`}
                onClick={() => setYear(year === y ? null : y)}
                style={{
                  borderColor:
                    year == null || year === y
                      ? YEAR_COLORS[i % YEAR_COLORS.length]
                      : undefined,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: YEAR_COLORS[i % YEAR_COLORS.length],
                    marginRight: 6,
                  }}
                />
                {String(y).replace(/^20/, "'")}
              </button>
            ))}
          </div>
        )}
      </div>
      <HeadlineCards
        h={bundle.headline}
        conversion={bundle.conversion}
        myPurchases={bundle.myPurchases}
      />
    </div>
  );
}

function HeadlineCards({
  h,
  conversion,
  myPurchases,
}: {
  h: Headline;
  conversion: ConversionStats;
  myPurchases: MyPurchasesSummary;
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
    {
      label: "My purchases",
      value: money(myPurchases.total),
      sub:
        myPurchases.count > 0
          ? `${myPurchases.count} order${myPurchases.count === 1 ? "" : "s"} · not counted in revenue`
          : "no personal orders yet",
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

type ChartMode = "revenue" | "quantity";

const MODE_META: Record<
  ChartMode,
  { label: string; short: string; format: (v: number) => string }
> = {
  revenue: {
    label: "Net revenue by month",
    short: "$",
    format: (v) => moneyCompact(v),
  },
  quantity: {
    label: "Quantity by month",
    short: "qty",
    format: (v) => compactNumber(v),
  },
};

// Palette for year-over-year lines. Cycles through the design system's
// identity colors so each year is instantly distinguishable.
// Shared controls used across every year-over-year style chart. Renders
// the mode toggle ($/qty) and per-year isolation buttons with the same
// look as the top-level Net-revenue-by-month chart.
function ChartControls({
  mode,
  setMode,
  years,
  isolatedYear,
  setIsolatedYear,
}: {
  mode: ChartMode;
  setMode: (m: ChartMode) => void;
  years: number[];
  isolatedYear: number | null;
  setIsolatedYear: (y: number | null) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
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
      {years.length > 0 && (
        <>
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
            <button
              type="button"
              className={`btn btn--xs ${isolatedYear == null ? "" : "btn--ghost"}`}
              onClick={() => setIsolatedYear(null)}
            >
              All years
            </button>
            {years.map((y, i) => (
              <button
                key={y}
                type="button"
                className={`btn btn--xs ${isolatedYear === y ? "" : "btn--ghost"}`}
                onClick={() =>
                  setIsolatedYear(isolatedYear === y ? null : y)
                }
                style={{
                  borderColor:
                    isolatedYear == null || isolatedYear === y
                      ? YEAR_COLORS[i % YEAR_COLORS.length]
                      : undefined,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: YEAR_COLORS[i % YEAR_COLORS.length],
                    marginRight: 6,
                  }}
                />
                {String(y).replace(/^20/, "'")}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const YEAR_COLORS = [
  "var(--sage-700)",
  "var(--saffron-700)",
  "var(--blossom-500)",
  "var(--plum-500)",
  "var(--slate-500)",
  "var(--brick-500)",
];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Year-over-year monthly chart. One line per year, months on the X axis.
// Buttons toggle which year is "isolated" (highlighted, others dimmed).
// Y-axis auto-scales with nice round tick values.
function YearOverYearChart({ yearly }: { yearly: YearlySeries[] }) {
  const [mode, setMode] = useState<ChartMode>("revenue");
  const [isolatedYear, setIsolatedYear] = useState<number | null>(null);
  const [hover, setHover] = useState<{ year: number; month: number } | null>(
    null,
  );

  const width = 1080;
  const height = 240;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = 36;
  const innerW = width - paddingLeft - paddingRight;
  const innerH = height - paddingTop - paddingBottom;

  const seriesToShow = isolatedYear != null
    ? yearly.filter((y) => y.year === isolatedYear)
    : yearly;

  const valueOf = (s: YearlySeries, m: number) =>
    mode === "quantity" ? s.monthlyQty[m] : s.monthlyNet[m];

  // For the current year, only draw up through the current month —
  // future months are 0 across the board and dragging the line down to
  // zero makes it look like sales fell off a cliff. `monthsFor(year)`
  // returns the count of months we should render (1..12).
  const nowUtc = new Date();
  const currentYearUtc = nowUtc.getUTCFullYear();
  const currentMonthUtc = nowUtc.getUTCMonth();
  const monthsFor = (year: number) =>
    year < currentYearUtc ? 12 : Math.min(12, currentMonthUtc + 1);

  // Axis width = the largest visible span across the shown years. If a
  // past year is in scope its 12 months anchor the axis to Jan-Dec; if
  // the user isolated the current year, the axis shrinks to Jan-<now>.
  const axisMonths = seriesToShow.length
    ? Math.max(...seriesToShow.map((s) => monthsFor(s.year)))
    : 12;

  const rawMax = Math.max(
    1,
    ...seriesToShow.flatMap((s) =>
      Array.from({ length: monthsFor(s.year) }, (_, m) => valueOf(s, m)),
    ),
  );
  const { maxVal, ticks } = niceScale(rawMax, 4);

  const xOfMonth = (m: number) =>
    paddingLeft + (innerW * (m + 0.5)) / axisMonths;
  const yOfValue = (v: number) =>
    paddingTop + innerH - (Math.max(0, v) / maxVal) * innerH;

  const svgRef = useRef<SVGSVGElement>(null);
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || seriesToShow.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    // Snap to the nearest month index (within the visible axis range).
    let bestM = 0;
    let bestDist = Infinity;
    for (let m = 0; m < axisMonths; m++) {
      const dx = Math.abs(xOfMonth(m) - svgX);
      if (dx < bestDist) {
        bestDist = dx;
        bestM = m;
      }
    }
    // For that month, pick the year whose y-position is closest to the
    // mouse — otherwise a low-earning year steals the hover from the
    // one the user is actually pointing at. Skip years whose visible
    // range doesn't extend to this month (e.g. hovering July when it's
    // still 2026 — 2026 has no future data yet).
    const svgY = ((e.clientY - rect.top) / rect.height) * height;
    let bestYear: number | undefined;
    let bestYDist = Infinity;
    for (const s of seriesToShow) {
      if (bestM >= monthsFor(s.year)) continue;
      const yPos = yOfValue(valueOf(s, bestM));
      const yd = Math.abs(yPos - svgY);
      if (yd < bestYDist) {
        bestYDist = yd;
        bestYear = s.year;
      }
    }
    if (bestYear != null) setHover({ year: bestYear, month: bestM });
  };
  const onMouseLeave = () => setHover(null);

  const hoveredSeries =
    hover != null ? seriesToShow.find((s) => s.year === hover.year) : null;
  const hoveredValue =
    hoveredSeries != null && hover != null
      ? valueOf(hoveredSeries, hover.month)
      : 0;

  return (
    <div
      className="s-card"
      style={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
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
          {isolatedYear != null && (
            <span
              style={{
                color: "var(--ink-500)",
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: 14,
                marginLeft: 8,
              }}
            >
              · {isolatedYear} only
            </span>
          )}
        </h2>
        <ChartControls
          mode={mode}
          setMode={setMode}
          years={yearly.map((y) => y.year)}
          isolatedYear={isolatedYear}
          setIsolatedYear={setIsolatedYear}
        />
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
          {/* Horizontal grid + Y-axis labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={paddingLeft}
                x2={paddingLeft + innerW}
                y1={yOfValue(t)}
                y2={yOfValue(t)}
                stroke="var(--parchment-200)"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 8}
                y={yOfValue(t) + 4}
                fontSize="11"
                fill="var(--ink-500)"
                textAnchor="end"
                fontFamily="var(--font-mono)"
              >
                {MODE_META[mode].format(t)}
              </text>
            </g>
          ))}

          {/* Vertical guide at hovered month */}
          {hover && (
            <line
              x1={xOfMonth(hover.month)}
              x2={xOfMonth(hover.month)}
              y1={paddingTop}
              y2={paddingTop + innerH}
              stroke="var(--ink-300)"
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}

          {/* Year lines */}
          {yearly.map((s, i) => {
            const color = YEAR_COLORS[i % YEAR_COLORS.length];
            const dimmed = isolatedYear != null && isolatedYear !== s.year;
            const opacity = dimmed ? 0.08 : 1;
            const visible = monthsFor(s.year);
            const monthIndexes = Array.from({ length: visible }, (_, m) => m);
            const path = monthIndexes
              .map((m) => `${m === 0 ? "M" : "L"}${xOfMonth(m)},${yOfValue(valueOf(s, m))}`)
              .join(" ");
            return (
              <g key={s.year} opacity={opacity} pointerEvents={dimmed ? "none" : undefined}>
                <path d={path} stroke={color} strokeWidth={2} fill="none" />
                {monthIndexes.map((m) => {
                  const v = valueOf(s, m);
                  const isHovered =
                    hover?.year === s.year && hover?.month === m;
                  return (
                    <circle
                      key={m}
                      cx={xOfMonth(m)}
                      cy={yOfValue(v)}
                      r={isHovered ? 5 : 3}
                      fill={color}
                      stroke={isHovered ? "#fff" : "none"}
                      strokeWidth={isHovered ? 2 : 0}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X-axis month labels */}
          {MONTH_LABELS.slice(0, axisMonths).map((label, m) => (
            <text
              key={label}
              x={xOfMonth(m)}
              y={paddingTop + innerH + 18}
              fontSize="11"
              fill="var(--ink-500)"
              textAnchor="middle"
            >
              {label}
            </text>
          ))}
        </svg>
        {hover && hoveredSeries && (
          <YoyTooltip
            year={hover.year}
            month={hover.month}
            value={hoveredValue}
            mode={mode}
            containerWidth={width}
            xInViewBox={xOfMonth(hover.month)}
            yInViewBox={yOfValue(hoveredValue)}
            viewBoxHeight={height}
          />
        )}
      </div>
    </div>
  );
}

// Compute "nice" Y-axis tick values that round to human-friendly
// increments — $2k, $5k, $10k rather than the exact max. Returns the
// adjusted top-of-scale plus 4-5 tick values including 0.
function niceScale(rawMax: number, tickHint: number): {
  maxVal: number;
  ticks: number[];
} {
  if (rawMax <= 0) return { maxVal: 1, ticks: [0, 1] };
  const roughStep = rawMax / tickHint;
  const pow10 = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / pow10;
  const step =
    norm <= 1
      ? 1 * pow10
      : norm <= 2
        ? 2 * pow10
        : norm <= 2.5
          ? 2.5 * pow10
          : norm <= 5
            ? 5 * pow10
            : 10 * pow10;
  const maxVal = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= maxVal + 0.0001; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }
  return { maxVal, ticks };
}

function moneyCompact(n: number): string {
  if (Math.abs(n) >= 1000000)
    return `$${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1000)
    return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function compactNumber(n: number): string {
  if (Math.abs(n) >= 1000000)
    return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

function YoyTooltip({
  year,
  month,
  value,
  mode,
  containerWidth,
  xInViewBox,
  yInViewBox,
  viewBoxHeight,
}: {
  year: number;
  month: number;
  value: number;
  mode: ChartMode;
  containerWidth: number;
  xInViewBox: number;
  yInViewBox: number;
  viewBoxHeight: number;
}) {
  const leftPct = (xInViewBox / containerWidth) * 100;
  const topPct = (yInViewBox / viewBoxHeight) * 100;
  const label =
    mode === "revenue"
      ? money(value)
      : value.toLocaleString("en-US");
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
      <div style={{ fontWeight: 700, marginBottom: 2 }}>
        {MONTH_LABELS[month]} {year}
      </div>
      <div>
        <span style={{ opacity: 0.7 }}>
          {mode === "revenue" ? "net " : "qty "}
        </span>
        {label}
      </div>
    </div>
  );
}

// Top-10 designs monthly time series. One line per design, hover shows
// title + total revenue + wallpaper/fabric/decor mix bar.
function Top10DesignsChart({
  series: allSeries,
  months,
  cachedSet,
  storageUrlBase,
}: {
  series: DesignMonthlySeries[];
  months: string[];
  cachedSet: Set<number>;
  storageUrlBase: string;
}) {
  const [hover, setHover] = useState<{
    designIdx: number;
    monthIdx: number;
  } | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [legendHover, setLegendHover] = useState<number | null>(null);
  // Year filter: null = all years, else a specific YYYY.
  const [isolatedYear, setIsolatedYear] = useState<number | null>(null);
  const [mode, setMode] = useState<ChartMode>("revenue");
  const monthlyFor = (s: DesignMonthlySeries) =>
    mode === "quantity" ? s.monthlyQty : s.monthly;

  // Server sends the union of top-N-by-revenue and top-N-by-qty so we
  // can re-rank locally when mode toggles without losing high-qty low-$
  // designs. Cap at 10 after re-sorting.
  const series = useMemo(() => {
    const sorted = [...allSeries].sort((a, b) =>
      mode === "quantity"
        ? b.totalQty - a.totalQty
        : b.totalNet - a.totalNet,
    );
    return sorted.slice(0, 10);
  }, [allSeries, mode]);

  useEffect(() => {
    setHighlighted(null);
    setHover(null);
    setLegendHover(null);
  }, [mode]);

  // All distinct years present in the data — powers the year buttons.
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const m of months) set.add(parseInt(m.split("-")[0], 10));
    return Array.from(set).sort((a, b) => a - b);
  }, [months]);

  // Filter months + monthly series by isolated year (if any).
  const visibleMonths = useMemo(
    () =>
      isolatedYear == null
        ? months
        : months.filter(
            (m) => parseInt(m.split("-")[0], 10) === isolatedYear,
          ),
    [months, isolatedYear],
  );

  const width = 1080;
  const height = 260;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = 40;
  const innerW = width - paddingLeft - paddingRight;
  const innerH = height - paddingTop - paddingBottom;

  const rawMax = Math.max(
    1,
    ...series.flatMap((s) =>
      visibleMonths.map((m) => monthlyFor(s)[m] ?? 0),
    ),
  );
  const { maxVal, ticks } = niceScale(rawMax, 4);

  const xOfMonth = (i: number) =>
    visibleMonths.length === 1
      ? paddingLeft + innerW / 2
      : paddingLeft + (innerW * i) / (visibleMonths.length - 1);
  const yOfValue = (v: number) =>
    paddingTop + innerH - (Math.max(0, v) / maxVal) * innerH;

  const svgRef = useRef<SVGSVGElement>(null);
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || series.length === 0 || visibleMonths.length === 0)
      return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const svgY = ((e.clientY - rect.top) / rect.height) * height;
    // Snap to nearest month index.
    let bestM = 0;
    let bestMDist = Infinity;
    for (let i = 0; i < visibleMonths.length; i++) {
      const dx = Math.abs(xOfMonth(i) - svgX);
      if (dx < bestMDist) {
        bestMDist = dx;
        bestM = i;
      }
    }
    // Pick the closest design at that month (respect selection: if a
    // design is isolated, only that one is hoverable).
    const candidateIdxs =
      highlighted != null ? [highlighted] : series.map((_, i) => i);
    let bestD = candidateIdxs[0] ?? 0;
    let bestDDist = Infinity;
    for (const i of candidateIdxs) {
      const v = monthlyFor(series[i])[visibleMonths[bestM]] ?? 0;
      const yd = Math.abs(yOfValue(v) - svgY);
      if (yd < bestDDist) {
        bestDDist = yd;
        bestD = i;
      }
    }
    setHover({ designIdx: bestD, monthIdx: bestM });
  };
  const onMouseLeave = () => setHover(null);

  // Space month labels — with more than 12 months on the axis the labels
  // overlap. Show every Nth so the axis stays legible.
  const monthLabelStride =
    visibleMonths.length > 24
      ? 6
      : visibleMonths.length > 12
        ? 3
        : visibleMonths.length > 8
          ? 2
          : 1;

  const hoveredSeries = hover != null ? series[hover.designIdx] : null;
  const hoveredValue =
    hover != null && hoveredSeries != null
      ? monthlyFor(hoveredSeries)[visibleMonths[hover.monthIdx]] ?? 0
      : 0;

  if (series.length === 0) return null;

  return (
    <div
      className="s-card"
      style={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
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
          Top 10 designs over time
          <span
            style={{
              color: "var(--ink-500)",
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 13,
              marginLeft: 8,
            }}
          >
            {MODE_META[mode].label.toLowerCase()} by month
            {isolatedYear != null && ` · ${isolatedYear}`}
          </span>
        </h2>
        <ChartControls
          mode={mode}
          setMode={setMode}
          years={availableYears}
          isolatedYear={isolatedYear}
          setIsolatedYear={setIsolatedYear}
        />
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
          {/* Horizontal gridlines + Y-axis labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={paddingLeft}
                x2={paddingLeft + innerW}
                y1={yOfValue(t)}
                y2={yOfValue(t)}
                stroke="var(--parchment-200)"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 8}
                y={yOfValue(t) + 4}
                fontSize="11"
                fill="var(--ink-500)"
                textAnchor="end"
                fontFamily="var(--font-mono)"
              >
                {MODE_META[mode].format(t)}
              </text>
            </g>
          ))}

          {/* Hover guide */}
          {hover && (
            <line
              x1={xOfMonth(hover.monthIdx)}
              x2={xOfMonth(hover.monthIdx)}
              y1={paddingTop}
              y2={paddingTop + innerH}
              stroke="var(--ink-300)"
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}

          {/* Design lines. If a design is isolated, only that one draws. */}
          {series.map((s, i) => {
            if (highlighted != null && highlighted !== i) return null;
            const color = YEAR_COLORS[i % YEAR_COLORS.length];
            const values = monthlyFor(s);
            const path = visibleMonths
              .map((m, mi) => {
                const v = values[m] ?? 0;
                return `${mi === 0 ? "M" : "L"}${xOfMonth(mi)},${yOfValue(v)}`;
              })
              .join(" ");
            return (
              <g key={s.design_id}>
                <path
                  d={path}
                  stroke={color}
                  strokeWidth={highlighted === i ? 3 : 2}
                  fill="none"
                />
                {visibleMonths.map((m, mi) => {
                  const v = values[m] ?? 0;
                  const isHovered =
                    hover?.designIdx === i && hover?.monthIdx === mi;
                  return (
                    <circle
                      key={m}
                      cx={xOfMonth(mi)}
                      cy={yOfValue(v)}
                      r={isHovered ? 5 : 2.5}
                      fill={color}
                      stroke={isHovered ? "#fff" : "none"}
                      strokeWidth={isHovered ? 2 : 0}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X-axis month labels */}
          {visibleMonths.map((m, i) => {
            if (i % monthLabelStride !== 0) return null;
            const [year, month] = m.split("-");
            const label =
              isolatedYear != null
                ? MONTH_LABELS[parseInt(month, 10) - 1]
                : `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year.slice(2)}`;
            return (
              <text
                key={m}
                x={xOfMonth(i)}
                y={paddingTop + innerH + 18}
                fontSize="10.5"
                fill="var(--ink-500)"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </svg>
        {hover && hoveredSeries && svgRef.current && (
          <Top10FloatingTooltip
            designSeries={hoveredSeries}
            month={visibleMonths[hover.monthIdx]}
            monthValue={hoveredValue}
            mode={mode}
            svgEl={svgRef.current}
            xInViewBox={xOfMonth(hover.monthIdx)}
            yInViewBox={yOfValue(hoveredValue)}
            viewBoxWidth={width}
            viewBoxHeight={height}
            cached={cachedSet.has(hoveredSeries.design_id)}
            storageUrlBase={storageUrlBase}
          />
        )}
      </div>

      {/* Legend below the chart — thumbnails. Click one to isolate that
          design; click again to show all. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        {series.map((s, i) => {
          const color = YEAR_COLORS[i % YEAR_COLORS.length];
          const active = highlighted === i;
          const dim = highlighted != null && highlighted !== i;
          const hovered = legendHover === i;
          return (
            <div
              key={s.design_id}
              style={{ position: "relative", flexShrink: 0 }}
            >
              <button
                type="button"
                onClick={() => setHighlighted(active ? null : i)}
                onMouseEnter={() => setLegendHover(i)}
                onMouseLeave={() =>
                  setLegendHover((v) => (v === i ? null : v))
                }
                style={{
                  position: "relative",
                  width: 96,
                  height: 96,
                  padding: 0,
                  // Always outline in the design's line color so the
                  // thumbnail visually anchors to its line on the graph.
                  border: `4px solid ${color}`,
                  borderRadius: 12,
                  background: "var(--surface)",
                  cursor: "pointer",
                  overflow: "hidden",
                  opacity: dim ? 0.35 : 1,
                  transition:
                    "opacity 160ms ease-out, box-shadow 160ms ease-out",
                  // Extra ring when active or hovered to signal state
                  // without changing the always-visible outline color.
                  boxShadow:
                    active || hovered ? `0 0 0 3px ${color}33` : "none",
                }}
              >
                <DesignSquareThumb
                  designId={s.design_id}
                  title={s.design_title}
                  cached={cachedSet.has(s.design_id)}
                  storageUrlBase={storageUrlBase}
                  size={88}
                />
                {/* Total pill — mode-aware so the badge matches whatever
                    the chart's y-axis is currently plotting. */}
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 6,
                    transform: "translateX(-50%)",
                    padding: "1px 8px",
                    borderRadius: 999,
                    background: "var(--ink-900)",
                    color: "var(--parchment-50)",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    lineHeight: 1.4,
                    pointerEvents: "none",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                  }}
                >
                  {mode === "quantity"
                    ? `${Math.round(s.totalQty)}×`
                    : moneyCompact(s.totalNet)}
                </span>
              </button>
              {hovered && s.design_title && (
                <LegendTitleChip title={s.design_title} color={color} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Small floating chip that appears above a legend thumbnail on hover
// to reveal the design title without waiting on the browser's native
// title-attribute delay. Positioned absolutely relative to the wrapping
// legend cell (position: relative on the parent), so it floats above
// its own thumbnail without pushing siblings around.
function LegendTitleChip({ title, color }: { title: string; color: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: "calc(100% + 6px)",
        transform: "translateX(-50%)",
        maxWidth: 260,
        padding: "6px 10px",
        borderRadius: 8,
        background: "var(--ink-900)",
        color: "var(--parchment-50)",
        fontSize: 12,
        lineHeight: 1.35,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        borderLeft: `3px solid ${color}`,
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {title}
    </div>
  );
}

// Floating tooltip that escapes any parent overflow (including the
// sidebar). Uses a fixed-position div in a portal, computing viewport
// coordinates from the SVG bounding rect. This is what the user needs
// when the chart is narrow enough that the tooltip would otherwise be
// clipped by the left sidebar.
function Top10FloatingTooltip({
  designSeries,
  month,
  monthValue,
  mode,
  svgEl,
  xInViewBox,
  yInViewBox,
  viewBoxWidth,
  viewBoxHeight,
  cached,
  storageUrlBase,
}: {
  designSeries: DesignMonthlySeries;
  month: string;
  monthValue: number;
  mode: ChartMode;
  svgEl: SVGSVGElement;
  xInViewBox: number;
  yInViewBox: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  cached: boolean;
  storageUrlBase: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const rect = svgEl.getBoundingClientRect();
  const scaleX = rect.width / viewBoxWidth;
  const scaleY = rect.height / viewBoxHeight;
  const anchorX = rect.left + xInViewBox * scaleX;
  const anchorY = rect.top + yInViewBox * scaleY;
  // Clamp so tooltip stays inside the viewport horizontally.
  const tooltipWidth = 260;
  const half = tooltipWidth / 2;
  const left = Math.min(
    Math.max(anchorX, half + 8),
    (typeof window !== "undefined" ? window.innerWidth : 9999) - half - 8,
  );
  const top = Math.max(anchorY - 12, 8);
  const [year, monthNum] = month.split("-");
  const monthLabel = `${MONTH_LABELS[parseInt(monthNum, 10) - 1]} ${year}`;
  const node = (
    <div
      style={{
        position: "fixed",
        left,
        top,
        transform: "translate(-50%, -100%)",
        pointerEvents: "none",
        background: "var(--ink-900)",
        color: "var(--parchment-50)",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 11.5,
        lineHeight: 1.5,
        boxShadow: "var(--shadow-lg)",
        zIndex: 1000,
        width: tooltipWidth,
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 6,
            overflow: "hidden",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <DesignSquareThumb
            designId={designSeries.design_id}
            title={designSeries.design_title}
            cached={cached}
            storageUrlBase={storageUrlBase}
            size={56}
          />
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {designSeries.design_title}
        </div>
        <div style={{ opacity: 0.7, fontSize: 10.5, marginBottom: 6 }}>
          #{designSeries.design_id}
        </div>
        <div style={{ fontFamily: "var(--font-mono)" }}>
          <span style={{ opacity: 0.7 }}>{monthLabel} </span>
          {mode === "quantity"
            ? `${Math.round(monthValue)} sold`
            : money(monthValue)}
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 3 }}>
            PRODUCT MIX
          </div>
        <div
          style={{
            display: "flex",
            height: 8,
            borderRadius: 999,
            overflow: "hidden",
            background: "rgba(255,255,255,0.08)",
          }}
        >
          {designSeries.wallpaperPct > 0 && (
            <div
              style={{
                width: `${designSeries.wallpaperPct}%`,
                background: "var(--slate-500)",
              }}
              title={`Wallpaper ${designSeries.wallpaperPct}%`}
            />
          )}
          {designSeries.fabricPct > 0 && (
            <div
              style={{
                width: `${designSeries.fabricPct}%`,
                background: "var(--sage-500)",
              }}
              title={`Fabric ${designSeries.fabricPct}%`}
            />
          )}
          {designSeries.decorPct > 0 && (
            <div
              style={{
                width: `${designSeries.decorPct}%`,
                background: "var(--saffron-500)",
              }}
              title={`Home decor ${designSeries.decorPct}%`}
            />
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 4,
            fontSize: 10.5,
            fontFamily: "var(--font-mono)",
          }}
        >
          {designSeries.wallpaperPct > 0 && (
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  background: "var(--slate-500)",
                  borderRadius: 2,
                  marginRight: 4,
                }}
              />
              wallpaper {designSeries.wallpaperPct}%
            </span>
          )}
          {designSeries.fabricPct > 0 && (
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  background: "var(--sage-500)",
                  borderRadius: 2,
                  marginRight: 4,
                }}
              />
              fabric {designSeries.fabricPct}%
            </span>
          )}
          {designSeries.decorPct > 0 && (
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  background: "var(--saffron-500)",
                  borderRadius: 2,
                  marginRight: 4,
                }}
              />
              decor {designSeries.decorPct}%
            </span>
          )}
        </div>
      </div>
      </div>
      </div>
    </div>
  );
  return createPortal(node, document.body);
}

// Top-10 keywords over time. Similar structure to Top10DesignsChart but
// simpler — no thumbnails, keyword string is the legend chip label.
// Also supports the same year filter.
function Top10KeywordsChart({
  series: allSeries,
  months,
}: {
  series: KeywordMonthlySeries[];
  months: string[];
}) {
  const [hover, setHover] = useState<{
    kwIdx: number;
    monthIdx: number;
  } | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [isolatedYear, setIsolatedYear] = useState<number | null>(null);
  const [mode, setMode] = useState<ChartMode>("revenue");
  const monthlyFor = (s: KeywordMonthlySeries) =>
    mode === "quantity" ? s.monthlyQty : s.monthly;

  // The server sends the union of top-N-by-revenue and top-N-by-qty so
  // we can re-rank locally when the mode toggles without losing keywords
  // that dominate only one metric. Re-slice back to the display cap of
  // 20 after sorting.
  const series = useMemo(() => {
    const sorted = [...allSeries].sort((a, b) =>
      mode === "quantity"
        ? b.totalQty - a.totalQty
        : b.totalNet - a.totalNet,
    );
    return sorted.slice(0, 20);
  }, [allSeries, mode]);

  // Any time the ranking changes the highlighted-index would point at
  // the wrong keyword — reset it. Same for hover.
  useEffect(() => {
    setHighlighted(null);
    setHover(null);
  }, [mode]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const m of months) set.add(parseInt(m.split("-")[0], 10));
    return Array.from(set).sort((a, b) => a - b);
  }, [months]);

  const visibleMonths = useMemo(
    () =>
      isolatedYear == null
        ? months
        : months.filter(
            (m) => parseInt(m.split("-")[0], 10) === isolatedYear,
          ),
    [months, isolatedYear],
  );

  const width = 1080;
  const height = 240;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = 40;
  const innerW = width - paddingLeft - paddingRight;
  const innerH = height - paddingTop - paddingBottom;

  const rawMax = Math.max(
    1,
    ...series.flatMap((s) =>
      visibleMonths.map((m) => monthlyFor(s)[m] ?? 0),
    ),
  );
  const { maxVal, ticks } = niceScale(rawMax, 4);

  const xOfMonth = (i: number) =>
    visibleMonths.length === 1
      ? paddingLeft + innerW / 2
      : paddingLeft + (innerW * i) / (visibleMonths.length - 1);
  const yOfValue = (v: number) =>
    paddingTop + innerH - (Math.max(0, v) / maxVal) * innerH;

  const svgRef = useRef<SVGSVGElement>(null);
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || series.length === 0 || visibleMonths.length === 0)
      return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const svgY = ((e.clientY - rect.top) / rect.height) * height;
    let bestM = 0;
    let bestMDist = Infinity;
    for (let i = 0; i < visibleMonths.length; i++) {
      const dx = Math.abs(xOfMonth(i) - svgX);
      if (dx < bestMDist) {
        bestMDist = dx;
        bestM = i;
      }
    }
    const candidateIdxs =
      highlighted != null ? [highlighted] : series.map((_, i) => i);
    let bestK = candidateIdxs[0] ?? 0;
    let bestKDist = Infinity;
    for (const i of candidateIdxs) {
      const v = monthlyFor(series[i])[visibleMonths[bestM]] ?? 0;
      const yd = Math.abs(yOfValue(v) - svgY);
      if (yd < bestKDist) {
        bestKDist = yd;
        bestK = i;
      }
    }
    setHover({ kwIdx: bestK, monthIdx: bestM });
  };
  const onMouseLeave = () => setHover(null);

  const monthLabelStride =
    visibleMonths.length > 24
      ? 6
      : visibleMonths.length > 12
        ? 3
        : visibleMonths.length > 8
          ? 2
          : 1;

  const hoveredSeries = hover != null ? series[hover.kwIdx] : null;
  const hoveredValue =
    hover != null && hoveredSeries != null
      ? monthlyFor(hoveredSeries)[visibleMonths[hover.monthIdx]] ?? 0
      : 0;

  if (series.length === 0) return null;

  return (
    <div
      className="s-card"
      style={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
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
          Top 20 keywords by sales
          <span
            style={{
              color: "var(--ink-500)",
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 13,
              marginLeft: 8,
            }}
          >
            {MODE_META[mode].label.toLowerCase()} on sales featuring
            each keyword
            {isolatedYear != null && ` · ${isolatedYear}`}
          </span>
        </h2>
        <ChartControls
          mode={mode}
          setMode={setMode}
          years={availableYears}
          isolatedYear={isolatedYear}
          setIsolatedYear={setIsolatedYear}
        />
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
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={paddingLeft}
                x2={paddingLeft + innerW}
                y1={yOfValue(t)}
                y2={yOfValue(t)}
                stroke="var(--parchment-200)"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 8}
                y={yOfValue(t) + 4}
                fontSize="11"
                fill="var(--ink-500)"
                textAnchor="end"
                fontFamily="var(--font-mono)"
              >
                {MODE_META[mode].format(t)}
              </text>
            </g>
          ))}
          {hover && (
            <line
              x1={xOfMonth(hover.monthIdx)}
              x2={xOfMonth(hover.monthIdx)}
              y1={paddingTop}
              y2={paddingTop + innerH}
              stroke="var(--ink-300)"
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}
          {series.map((s, i) => {
            if (highlighted != null && highlighted !== i) return null;
            const color = YEAR_COLORS[i % YEAR_COLORS.length];
            const values = monthlyFor(s);
            const path = visibleMonths
              .map((m, mi) => {
                const v = values[m] ?? 0;
                return `${mi === 0 ? "M" : "L"}${xOfMonth(mi)},${yOfValue(v)}`;
              })
              .join(" ");
            return (
              <g key={s.keyword}>
                <path
                  d={path}
                  stroke={color}
                  strokeWidth={highlighted === i ? 3 : 2}
                  fill="none"
                />
                {visibleMonths.map((m, mi) => {
                  const v = values[m] ?? 0;
                  const isHovered =
                    hover?.kwIdx === i && hover?.monthIdx === mi;
                  return (
                    <circle
                      key={m}
                      cx={xOfMonth(mi)}
                      cy={yOfValue(v)}
                      r={isHovered ? 5 : 2.5}
                      fill={color}
                      stroke={isHovered ? "#fff" : "none"}
                      strokeWidth={isHovered ? 2 : 0}
                    />
                  );
                })}
              </g>
            );
          })}
          {visibleMonths.map((m, i) => {
            if (i % monthLabelStride !== 0) return null;
            const [year, month] = m.split("-");
            const label =
              isolatedYear != null
                ? MONTH_LABELS[parseInt(month, 10) - 1]
                : `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year.slice(2)}`;
            return (
              <text
                key={m}
                x={xOfMonth(i)}
                y={paddingTop + innerH + 18}
                fontSize="10.5"
                fill="var(--ink-500)"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </svg>
        {hover && hoveredSeries && svgRef.current && (
          <KeywordFloatingTooltip
            keyword={hoveredSeries.keyword}
            month={visibleMonths[hover.monthIdx]}
            monthValue={hoveredValue}
            mode={mode}
            svgEl={svgRef.current}
            xInViewBox={xOfMonth(hover.monthIdx)}
            yInViewBox={yOfValue(hoveredValue)}
            viewBoxWidth={width}
            viewBoxHeight={height}
          />
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {series.map((s, i) => {
          const color = YEAR_COLORS[i % YEAR_COLORS.length];
          const active = highlighted === i;
          const dim = highlighted != null && highlighted !== i;
          return (
            <button
              key={s.keyword}
              type="button"
              onClick={() => setHighlighted(active ? null : i)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                border: `1px solid ${active ? color : "var(--parchment-200)"}`,
                borderRadius: 999,
                background: active
                  ? "var(--parchment-100)"
                  : "var(--surface)",
                cursor: "pointer",
                font: "inherit",
                opacity: dim ? 0.4 : 1,
                fontSize: 12.5,
                color: "var(--ink-900)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: color,
                }}
              />
              {s.keyword}
              <span
                style={{
                  marginLeft: 4,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "var(--ink-900)",
                  color: "var(--parchment-50)",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {mode === "quantity"
                  ? `${Math.round(s.totalQty)}×`
                  : moneyCompact(s.totalNet)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function KeywordFloatingTooltip({
  keyword,
  month,
  monthValue,
  mode,
  svgEl,
  xInViewBox,
  yInViewBox,
  viewBoxWidth,
  viewBoxHeight,
}: {
  keyword: string;
  month: string;
  monthValue: number;
  mode: ChartMode;
  svgEl: SVGSVGElement;
  xInViewBox: number;
  yInViewBox: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const rect = svgEl.getBoundingClientRect();
  const scaleX = rect.width / viewBoxWidth;
  const scaleY = rect.height / viewBoxHeight;
  const anchorX = rect.left + xInViewBox * scaleX;
  const anchorY = rect.top + yInViewBox * scaleY;
  const tooltipWidth = 180;
  const half = tooltipWidth / 2;
  const left = Math.min(
    Math.max(anchorX, half + 8),
    (typeof window !== "undefined" ? window.innerWidth : 9999) - half - 8,
  );
  const top = Math.max(anchorY - 12, 8);
  const [year, monthNum] = month.split("-");
  const monthLabel = `${MONTH_LABELS[parseInt(monthNum, 10) - 1]} ${year}`;
  const node = (
    <div
      style={{
        position: "fixed",
        left,
        top,
        transform: "translate(-50%, -100%)",
        pointerEvents: "none",
        background: "var(--ink-900)",
        color: "var(--parchment-50)",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 12,
        lineHeight: 1.4,
        boxShadow: "var(--shadow-lg)",
        zIndex: 1000,
        width: tooltipWidth,
      }}
    >
      <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>
        {keyword}
      </div>
      <div style={{ marginTop: 4, fontFamily: "var(--font-mono)" }}>
        <span style={{ opacity: 0.7 }}>{monthLabel} </span>
        {mode === "quantity"
          ? `${Math.round(monthValue)} sold`
          : money(monthValue)}
      </div>
    </div>
  );
  return createPortal(node, document.body);
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

function DayHourHeatmapCard({ events }: { events: HeatmapEvent[] }) {
  // Bucket on the client so day/hour reflect the viewer's local
  // timezone. Server data is UTC ISO, `Date` parses that fine, and
  // `getDay/getHours` return values in the browser's local tz — DST
  // shifts included, since each event is converted independently.
  const { matrix, max, total } = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let mx = 0;
    let n = 0;
    for (const e of events) {
      const d = new Date(e.sold_at);
      if (Number.isNaN(d.getTime())) continue;
      const day = d.getDay();
      const hour = d.getHours();
      m[day][hour] += e.amount;
      n++;
    }
    for (const row of m) for (const v of row) if (v > mx) mx = v;
    return { matrix: m, max: mx, total: n };
  }, [events]);

  const tzLabel = useMemo(() => formatTimezoneLabel(), []);
  if (total === 0) return null;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
          When do sales happen
          <span
            style={{
              color: "var(--ink-500)",
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 13,
              marginLeft: 8,
            }}
          >
            your local time · {tzLabel}
          </span>
        </h2>
        <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
          darker = more $
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
              {h}
            </div>
          ))}
          {days.map((label, dayIdx) => (
            <RowFragment
              key={label}
              label={label}
              row={matrix[dayIdx]}
              max={max}
              tzLabel={tzLabel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Short human-readable label for the viewer's timezone, e.g.
// "America/Los_Angeles (PDT)" — or just the IANA name if the short
// abbreviation isn't available. Runs client-side only.
function formatTimezoneLabel(): string {
  if (typeof Intl === "undefined") return "";
  const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZoneName: "short",
    }).formatToParts(new Date());
    const abbr = parts.find((p) => p.type === "timeZoneName")?.value;
    return abbr ? `${iana} (${abbr})` : iana;
  } catch {
    return iana;
  }
}

function RowFragment({
  label,
  row,
  max,
  tzLabel,
}: {
  label: string;
  row: number[];
  max: number;
  tzLabel: string;
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
            title={`${label} ${h}:00 ${tzLabel} · ${v > 0 ? money(v) : "no sales"}`}
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
