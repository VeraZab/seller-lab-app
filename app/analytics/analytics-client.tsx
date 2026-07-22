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
import {
  autoGroupByPrefix,
  createVariantSet,
  deleteVariantSet,
  renameVariantSet,
  setVariantMembership,
  type VariantData,
  type VariantSet,
} from "./variant-actions";
import { foldDesignAggByVariant, foldDesignsByVariant } from "./stats";
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
  variantData,
}: {
  user: SessionUser;
  stats: Stats | null;
  uploadSales: (rows: ParsedSaleRow[]) => Promise<UploadSalesResult>;
  cachedDesignIds: number[];
  uncachedDesignIds: number[];
  storageUrlBase: string;
  historyByDesign: Record<string, DesignHistoryRow[]>;
  syncSummary: SyncSummary;
  variantData: VariantData;
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
          variantData={variantData}
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
      label: "Sales",
      icon: "dollar" as const,
      active: true,
    },
    {
      href: "/customers",
      label: "Customers",
      icon: "user" as const,
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
  variantData,
}: {
  stats: Stats | null;
  uploadSales: (rows: ParsedSaleRow[]) => Promise<UploadSalesResult>;
  pushToast: PushToast;
  cachedSet: Set<number>;
  totalDesignsWithImages: number;
  storageUrlBase: string;
  historyByDesign: Record<string, DesignHistoryRow[]>;
  syncSummary: SyncSummary;
  variantData: VariantData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // When the user clicks a card in the Top Designs grid we open a
  // detail modal. Two shapes:
  //   { kind: "design", designId }: opens one design's history.
  //   { kind: "variant", name, designIds, leadDesignId }: aggregates
  //     history + stats across every member of the variant set.
  const [selectedTarget, setSelectedTarget] = useState<
    | null
    | { kind: "design"; designId: number }
    | {
        kind: "variant";
        name: string;
        designIds: number[];
        leadDesignId: number;
      }
  >(null);
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
              variantData={variantData}
              pushToast={pushToast}
            />
            <TopDesigns
              designs={stats.topDesigns}
              cachedSet={cachedSet}
              storageUrlBase={storageUrlBase}
              onSelectDesign={(designId) =>
                setSelectedTarget({ kind: "design", designId })
              }
              onSelectVariant={(v) =>
                setSelectedTarget({ kind: "variant", ...v })
              }
              variantData={variantData}
              pushToast={pushToast}
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
      {selectedTarget && stats && (() => {
        if (selectedTarget.kind === "design") {
          const design =
            stats.topDesigns.find(
              (d) => d.design_id === selectedTarget.designId,
            ) ?? null;
          return (
            <DesignDetailModal
              designId={selectedTarget.designId}
              design={design}
              displayTitle={design?.design_title ?? null}
              memberCount={1}
              history={historyByDesign[String(selectedTarget.designId)] ?? []}
              cached={cachedSet.has(selectedTarget.designId)}
              storageUrlBase={storageUrlBase}
              onClose={() => setSelectedTarget(null)}
            />
          );
        }
        // Variant target: aggregate DesignAgg fields across members +
        // concatenate history rows so every sale/refund across the set
        // shows in one timeline.
        const members = selectedTarget.designIds
          .map((id) => stats.topDesigns.find((d) => d.design_id === id))
          .filter((d): d is DesignAgg => !!d);
        const combined: DesignAgg = members.reduce(
          (acc, d) => ({
            design_id: selectedTarget.leadDesignId,
            design_title: selectedTarget.name,
            gross: acc.gross + d.gross,
            refunds: acc.refunds + d.refunds,
            net: acc.net + d.net,
            units: acc.units + d.units,
            saleCount: acc.saleCount + d.saleCount,
            refundCount: acc.refundCount + d.refundCount,
          }),
          {
            design_id: selectedTarget.leadDesignId,
            design_title: selectedTarget.name,
            gross: 0,
            refunds: 0,
            net: 0,
            units: 0,
            saleCount: 0,
            refundCount: 0,
          },
        );
        const combinedHistory = selectedTarget.designIds
          .flatMap((id) => historyByDesign[String(id)] ?? [])
          .sort((a, b) => (b.sold_at < a.sold_at ? -1 : 1));
        return (
          <DesignDetailModal
            designId={selectedTarget.leadDesignId}
            design={combined}
            displayTitle={selectedTarget.name}
            memberCount={members.length}
            history={combinedHistory}
            cached={cachedSet.has(selectedTarget.leadDesignId)}
            storageUrlBase={storageUrlBase}
            onClose={() => setSelectedTarget(null)}
          />
        );
      })()}
    </div>
  );
}

function DesignDetailModal({
  designId,
  design,
  displayTitle,
  memberCount,
  history,
  cached,
  storageUrlBase,
  onClose,
}: {
  // Anchor design_id — for variant sets, this is the lead design's id
  // (used to render the primary thumbnail). For individual designs,
  // just its own id.
  designId: number;
  // Aggregated design agg. For variant sets, this is the sum across
  // all members (net/gross/refunds/qty/counts). For individual designs
  // it's the design's own row.
  design: DesignAgg | null;
  // Title to display above the stats. For a variant set this is the
  // set's name; for a design it's design.design_title. Passed
  // separately so the modal doesn't have to know which case it's in.
  displayTitle: string | null;
  // Number of designs feeding this modal — 1 for individual, N for
  // variant sets. Shown as a subtitle when > 1.
  memberCount: number;
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
            title={displayTitle ?? design?.design_title ?? null}
            cached={cached}
            storageUrlBase={storageUrlBase}
            size={120}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            {memberCount > 1 ? (
              <div>
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
                  }}
                >
                  {displayTitle ?? `Variant set`}
                </h2>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-500)",
                    fontFamily: "var(--font-mono)",
                    marginTop: 4,
                  }}
                >
                  Variant set · {memberCount} designs
                </div>
              </div>
            ) : (
              <a
                href={`https://www.spoonflower.com/en/fabric/${designId}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`${displayTitle ?? designId} — open on Spoonflower`}
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
                  {displayTitle ?? `Design ${designId}`}
                  <Icon name="arrow" size={13} color="var(--ink-500)" />
                </h2>
              </a>
            )}
            {memberCount === 1 && (
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
            )}
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
        border: "1px solid var(--saffron-300)",
        borderLeft: "3px solid var(--saffron-500, #b8863a)",
        borderRadius: 8,
        background: "var(--saffron-50)",
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
          Sales
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
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "var(--ink-500)",
          lineHeight: 1.4,
        }}
      >
        Net revenue may differ from Spoonflower&rsquo;s dashboard by a few
        cents. Their &ldquo;Total Earned From Sales&rdquo; sums pre-rounded
        internal earnings; the CSV export rounds each row to cents before
        we see it, so tiny rounding biases accumulate. Not a bug on either
        side &mdash; the same reality at slightly different precisions.
      </p>
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

// Placeholder card used when a filtered chart has no data. Keeps the
// section header visible so the user isn't confused about a chart
// silently vanishing, and offers a one-click reset back to All years.
function ChartEmptyCard({
  title,
  message,
  onReset,
}: {
  title: string;
  message: string;
  onReset?: () => void;
}) {
  return (
    <div
      className="s-card"
      style={{
        padding: "var(--space-4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
          }}
        >
          {title}
        </h2>
        <span style={{ color: "var(--ink-500)", fontSize: 13 }}>{message}</span>
      </div>
      {onReset && (
        <button
          type="button"
          className="btn btn--xs"
          onClick={onReset}
        >
          Reset to All years
        </button>
      )}
    </div>
  );
}

// Year-over-year monthly chart. One line per year, months on the X axis.
// Buttons toggle which year is "isolated" (highlighted, others dimmed).
// Y-axis auto-scales with nice round tick values.
function YearOverYearChart({ yearly }: { yearly: YearlySeries[] }) {
  const [mode, setMode] = useState<ChartMode>("revenue");
  const [layout, setLayout] = useState<"stacked" | "continuous">("stacked");
  const [isolatedYear, setIsolatedYear] = useState<number | null>(null);
  const [hover, setHover] = useState<{ year: number; month: number } | null>(
    null,
  );

  useEffect(() => setHover(null), [layout, mode, isolatedYear]);

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

  // Continuous-layout data: one point per month across the whole span,
  // leading empty months trimmed so a user who started in March isn't
  // shown a flat $0 line for Jan/Feb.
  type ContinuousPoint = {
    year: number;
    month: number;
    net: number;
    qty: number;
    monthKey: string;
  };
  const continuousPoints = useMemo<ContinuousPoint[]>(() => {
    if (layout !== "continuous") return [];
    const source = isolatedYear != null
      ? yearly.filter((y) => y.year === isolatedYear)
      : yearly;
    const raw: ContinuousPoint[] = [];
    for (const y of source) {
      for (let m = 0; m < monthsFor(y.year); m++) {
        raw.push({
          year: y.year,
          month: m,
          net: y.monthlyNet[m],
          qty: y.monthlyQty[m],
          monthKey: `${y.year}-${String(m + 1).padStart(2, "0")}`,
        });
      }
    }
    let firstIdx = raw.findIndex((p) => p.net !== 0 || p.qty !== 0);
    if (firstIdx < 0) firstIdx = 0;
    return raw.slice(firstIdx);
  }, [layout, yearly, isolatedYear, currentYearUtc, currentMonthUtc]);

  const rawMax =
    layout === "continuous"
      ? Math.max(
          1,
          ...continuousPoints.map((p) =>
            mode === "quantity" ? p.qty : p.net,
          ),
        )
      : Math.max(
          1,
          ...seriesToShow.flatMap((s) =>
            Array.from({ length: monthsFor(s.year) }, (_, m) => valueOf(s, m)),
          ),
        );
  const { maxVal, ticks } = niceScale(rawMax, 4);

  const xOfMonth = (m: number) =>
    paddingLeft + (innerW * (m + 0.5)) / axisMonths;
  const xOfPoint = (i: number) =>
    continuousPoints.length <= 1
      ? paddingLeft + innerW / 2
      : paddingLeft + (innerW * i) / (continuousPoints.length - 1);
  const yOfValue = (v: number) =>
    paddingTop + innerH - (Math.max(0, v) / maxVal) * innerH;

  const svgRef = useRef<SVGSVGElement>(null);
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    if (layout === "continuous") {
      if (continuousPoints.length === 0) return;
      let bestI = 0;
      let bestDist = Infinity;
      for (let i = 0; i < continuousPoints.length; i++) {
        const dx = Math.abs(xOfPoint(i) - svgX);
        if (dx < bestDist) {
          bestDist = dx;
          bestI = i;
        }
      }
      const p = continuousPoints[bestI];
      setHover({ year: p.year, month: p.month });
      return;
    }
    if (seriesToShow.length === 0) return;
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
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className={`btn btn--xs ${layout === "stacked" ? "" : "btn--ghost"}`}
              onClick={() => setLayout("stacked")}
              title="Overlay each year on a Jan-Dec axis"
            >
              Stacked
            </button>
            <button
              type="button"
              className={`btn btn--xs ${layout === "continuous" ? "" : "btn--ghost"}`}
              onClick={() => setLayout("continuous")}
              title="Draw one continuous timeline across all months"
            >
              Continuous
            </button>
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
          <ChartControls
            mode={mode}
            setMode={setMode}
            years={yearly.map((y) => y.year)}
            isolatedYear={isolatedYear}
            setIsolatedYear={setIsolatedYear}
          />
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={{ overflow: "hidden", cursor: "crosshair" }}
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
              x1={
                layout === "continuous"
                  ? xOfPoint(
                      Math.max(
                        0,
                        continuousPoints.findIndex(
                          (p) => p.year === hover.year && p.month === hover.month,
                        ),
                      ),
                    )
                  : xOfMonth(hover.month)
              }
              x2={
                layout === "continuous"
                  ? xOfPoint(
                      Math.max(
                        0,
                        continuousPoints.findIndex(
                          (p) => p.year === hover.year && p.month === hover.month,
                        ),
                      ),
                    )
                  : xOfMonth(hover.month)
              }
              y1={paddingTop}
              y2={paddingTop + innerH}
              stroke="var(--ink-300)"
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}

          {/* Year lines — stacked layout, filled area series. Each year
              renders as a translucent shape closed to the x-axis, with
              the top edge stroked in the year's color and points marking
              each month. When a specific year is isolated the others are
              skipped entirely. */}
          {layout === "stacked" &&
            yearly.map((s, i) => {
              if (isolatedYear != null && isolatedYear !== s.year) return null;
              const color = YEAR_COLORS[i % YEAR_COLORS.length];
              const visible = monthsFor(s.year);
              const monthIndexes = Array.from({ length: visible }, (_, m) => m);
              const axisY = paddingTop + innerH;
              const linePath = monthIndexes
                .map((m) => `${m === 0 ? "M" : "L"}${xOfMonth(m)},${yOfValue(valueOf(s, m))}`)
                .join(" ");
              // Filled area = line path + segment down to the axis + back
              // along the axis + close.
              const areaPath = `${linePath} L${xOfMonth(monthIndexes[monthIndexes.length - 1] ?? 0)},${axisY} L${xOfMonth(0)},${axisY} Z`;
              return (
                <g key={s.year}>
                  <path d={areaPath} fill={color} opacity={0.18} stroke="none" />
                  <path d={linePath} stroke={color} strokeWidth={2} fill="none" />
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

          {/* Continuous single line across all months */}
          {layout === "continuous" && continuousPoints.length > 0 && (() => {
            const color = YEAR_COLORS[0];
            const valueOfPoint = (p: ContinuousPoint) =>
              mode === "quantity" ? p.qty : p.net;
            const path = continuousPoints
              .map(
                (p, i) =>
                  `${i === 0 ? "M" : "L"}${xOfPoint(i)},${yOfValue(valueOfPoint(p))}`,
              )
              .join(" ");
            const axisY = paddingTop + innerH;
            const areaPath = `${path} L${xOfPoint(continuousPoints.length - 1)},${axisY} L${xOfPoint(0)},${axisY} Z`;
            return (
              <g>
                <path d={areaPath} fill={color} opacity={0.18} stroke="none" />
                <path d={path} stroke={color} strokeWidth={2} fill="none" />
                {continuousPoints.map((p, i) => {
                  const isHovered =
                    hover?.year === p.year && hover?.month === p.month;
                  return (
                    <circle
                      key={p.monthKey}
                      cx={xOfPoint(i)}
                      cy={yOfValue(valueOfPoint(p))}
                      r={isHovered ? 5 : 2.5}
                      fill={color}
                      stroke={isHovered ? "#fff" : "none"}
                      strokeWidth={isHovered ? 2 : 0}
                    />
                  );
                })}
              </g>
            );
          })()}

          {/* X-axis month labels — stacked: Jan..Dec (or shorter) */}
          {layout === "stacked" &&
            MONTH_LABELS.slice(0, axisMonths).map((label, m) => (
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

          {/* X-axis month labels — continuous: sparse MMM 'YY tags */}
          {layout === "continuous" &&
            (() => {
              const stride = Math.max(1, Math.ceil(continuousPoints.length / 10));
              return continuousPoints
                .map((p, i) => {
                  if (i !== continuousPoints.length - 1 && i % stride !== 0)
                    return null;
                  const short = `${MONTH_LABELS[p.month]} '${String(p.year).slice(-2)}`;
                  return (
                    <text
                      key={p.monthKey}
                      x={xOfPoint(i)}
                      y={paddingTop + innerH + 18}
                      fontSize="11"
                      fill="var(--ink-500)"
                      textAnchor="middle"
                    >
                      {short}
                    </text>
                  );
                })
                .filter(Boolean);
            })()}
        </svg>
        {hover && hoveredSeries && (
          <YoyTooltip
            year={hover.year}
            month={hover.month}
            value={hoveredValue}
            mode={mode}
            containerWidth={width}
            xInViewBox={
              layout === "continuous"
                ? xOfPoint(
                    Math.max(
                      0,
                      continuousPoints.findIndex(
                        (p) =>
                          p.year === hover.year && p.month === hover.month,
                      ),
                    ),
                  )
                : xOfMonth(hover.month)
            }
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
  series: rawSeries,
  months,
  cachedSet,
  storageUrlBase,
  variantData,
  pushToast,
}: {
  series: DesignMonthlySeries[];
  months: string[];
  cachedSet: Set<number>;
  storageUrlBase: string;
  variantData: VariantData;
  pushToast: PushToast;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<{
    designIdx: number;
    monthIdx: number;
  } | null>(null);
  // Chart always renders a single-series bar chart for the "highlighted"
  // design — no stacked view. Defaults to 0 (top earner). User can pick
  // any thumbnail in the legend to swap which one is charted.
  const [highlighted, setHighlighted] = useState<number>(0);
  const [legendHover, setLegendHover] = useState<number | null>(null);
  // Year filter: null = all years, else a specific YYYY.
  const [isolatedYear, setIsolatedYear] = useState<number | null>(null);
  const [mode, setMode] = useState<ChartMode>("revenue");
  // Grouping: individual designs vs folded variant sets. Default to
  // grouped when there's at least one variant set in scope — the user
  // already told us that grouping is meaningful for them. Batch
  // selection for CREATING variant sets lives in the TopDesigns table
  // below; this chart just consumes the resulting sets.
  const [grouping, setGrouping] = useState<"individual" | "grouped">(
    variantData.sets.length > 0 ? "grouped" : "individual",
  );

  // Fold designs into variant sets when Grouped is active. Individual
  // mode passes the raw per-design series through unchanged.
  const allSeries = useMemo(() => {
    if (grouping !== "grouped") return rawSeries;
    return foldDesignsByVariant(
      rawSeries,
      variantData.sets,
      variantData.setByDesignId,
    );
  }, [rawSeries, variantData, grouping]);

  const monthlyFor = (s: DesignMonthlySeries) =>
    mode === "quantity" ? s.monthlyQty : s.monthly;

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

  // Server sends the union of top-N-by-revenue and top-N-by-qty so we
  // can re-rank locally when mode toggles without losing high-qty low-$
  // designs. When a year is isolated, we re-rank by that year's totals
  // and drop designs with no sales in that year — otherwise the legend
  // would show 10 designs but half would be flat-line ghosts.
  const displayTotal = (s: DesignMonthlySeries): { net: number; qty: number } => {
    if (isolatedYear == null) {
      return { net: s.totalNet, qty: s.totalQty };
    }
    let net = 0;
    let qty = 0;
    for (const m of visibleMonths) {
      net += s.monthly[m] ?? 0;
      qty += s.monthlyQty[m] ?? 0;
    }
    return { net, qty };
  };

  const series = useMemo(() => {
    if (isolatedYear == null) {
      const sorted = [...allSeries].sort((a, b) =>
        mode === "quantity"
          ? b.totalQty - a.totalQty
          : b.totalNet - a.totalNet,
      );
      return sorted.slice(0, 10);
    }
    const yearMonths = months.filter(
      (m) => parseInt(m.split("-")[0], 10) === isolatedYear,
    );
    const withTotal = allSeries.map((s) => ({
      s,
      key:
        mode === "quantity"
          ? yearMonths.reduce((a, m) => a + (s.monthlyQty[m] ?? 0), 0)
          : yearMonths.reduce((a, m) => a + (s.monthly[m] ?? 0), 0),
    }));
    return withTotal
      .filter((x) => x.key > 0)
      .sort((a, b) => b.key - a.key)
      .slice(0, 10)
      .map((x) => x.s);
  }, [allSeries, mode, isolatedYear, months]);

  // Reset which design is charted when the underlying series changes
  // (mode toggle, year isolation, grouping change). Always fall back to
  // the first (top-earner).
  useEffect(() => {
    setHighlighted(0);
    setHover(null);
    setLegendHover(null);
  }, [mode, isolatedYear, grouping, series.length]);

  const width = 1080;
  const height = 260;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = 40;
  const innerW = width - paddingLeft - paddingRight;
  const innerH = height - paddingTop - paddingBottom;

  // Single-series scale: y-axis fits the currently-charted design's
  // biggest positive month. Negatives clamp to 0 in the visual — the
  // tooltip still shows the raw signed value.
  const rawMax = Math.max(
    1,
    ...visibleMonths.map((m) => {
      const s = series[highlighted];
      if (!s) return 0;
      return Math.max(0, monthlyFor(s)[m] ?? 0);
    }),
  );
  const { maxVal, ticks } = niceScale(rawMax, 4);

  // Bars sit at the center of their column. With N months across innerW,
  // each column is innerW/N wide and the bar occupies ~72% of it so
  // there's whitespace between bars.
  const xOfMonth = (i: number) =>
    visibleMonths.length === 0
      ? paddingLeft + innerW / 2
      : paddingLeft + (innerW * (i + 0.5)) / visibleMonths.length;
  const yOfValue = (v: number) =>
    paddingTop + innerH - (Math.max(0, v) / maxVal) * innerH;
  const barWidth =
    (innerW / Math.max(1, visibleMonths.length)) * 0.72;

  const svgRef = useRef<SVGSVGElement>(null);
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || series.length === 0 || visibleMonths.length === 0)
      return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const svgY = ((e.clientY - rect.top) / rect.height) * height;
    // Single-series bars — hover just snaps to the nearest month
    // column. Design index is always the currently highlighted one.
    let bestM = 0;
    let bestMDist = Infinity;
    for (let i = 0; i < visibleMonths.length; i++) {
      const dx = Math.abs(xOfMonth(i) - svgX);
      if (dx < bestMDist) {
        bestMDist = dx;
        bestM = i;
      }
    }
    setHover({ designIdx: highlighted, monthIdx: bestM });
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
  // Top-of-column y position for the hovered month — the highlighted
  // design's value at that month. Tooltip anchors here so it sits just
  // above the bar without overlapping.
  const hoveredColumnTopY = useMemo(() => {
    if (hover == null) return paddingTop;
    const m = visibleMonths[hover.monthIdx];
    const s = series[highlighted];
    if (!s) return paddingTop;
    return yOfValue(Math.max(0, monthlyFor(s)[m] ?? 0));
  }, [hover, visibleMonths, series, mode, maxVal, highlighted]);

  if (series.length === 0) {
    return (
      <ChartEmptyCard
        title="Top 10 designs over time"
        message={
          isolatedYear != null
            ? `No design sales in ${isolatedYear}. Pick a different year or reset to All years.`
            : "No design sales yet."
        }
        onReset={
          isolatedYear != null ? () => setIsolatedYear(null) : undefined
        }
      />
    );
  }

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
          {isolatedYear != null && (
            <span
              style={{
                color: "var(--ink-500)",
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: 13,
                marginLeft: 8,
              }}
            >
              {isolatedYear}
            </span>
          )}
        </h2>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            marginLeft: "auto",
          }}
        >
          {variantData.sets.length > 0 && (
            <>
              <ToggleSwitch
                on={grouping === "grouped"}
                onToggle={() =>
                  setGrouping(
                    grouping === "grouped" ? "individual" : "grouped",
                  )
                }
                label="View as variant groups"
              />
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 16,
                  background: "var(--parchment-200)",
                  margin: "0 2px",
                }}
              />
            </>
          )}
          <ChartControls
            mode={mode}
            setMode={setMode}
            years={availableYears}
            isolatedYear={isolatedYear}
            setIsolatedYear={setIsolatedYear}
          />
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={{ overflow: "hidden", cursor: "crosshair" }}
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

          {/* Single-series bars — always render one design's monthly
              values. Which one is picked in the legend below. */}
          {visibleMonths.map((m, mi) => {
            const s = series[highlighted];
            if (!s) return null;
            const v = Math.max(0, monthlyFor(s)[m] ?? 0);
            if (v === 0) return null;
            const h = (v / maxVal) * innerH;
            const y = paddingTop + innerH - h;
            const cx = xOfMonth(mi);
            const isHovered = hover?.monthIdx === mi;
            return (
              <rect
                key={m}
                x={cx - barWidth / 2}
                y={y}
                width={barWidth}
                height={h}
                fill={YEAR_COLORS[highlighted % YEAR_COLORS.length]}
                opacity={isHovered ? 1 : 0.92}
                stroke={isHovered ? "#fff" : "none"}
                strokeWidth={isHovered ? 2 : 0}
              />
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
            // Anchor at the top of the stacked column (not chart top,
            // not the segment inside). Sits directly above the stack,
            // close to the data yet never overlapping any bar segment.
            yInViewBox={hoveredColumnTopY}
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
          const dim = !active;
          const hovered = legendHover === i;
          const isVariantSet = !!s.variantSetId;
          const variantCount = s.variantDesignIds?.length ?? 0;
          const thumbAnchor = isVariantSet
            ? s.variantLeadDesignId ?? s.design_id
            : s.design_id;
          return (
            <div
              key={s.variantSetId ?? s.design_id}
              style={{ position: "relative", flexShrink: 0 }}
            >
              <button
                type="button"
                onClick={() => setHighlighted(i)}
                onMouseEnter={() => setLegendHover(i)}
                onMouseLeave={() =>
                  setLegendHover((v) => (v === i ? null : v))
                }
                style={{
                  position: "relative",
                  width: 96,
                  height: 96,
                  padding: 0,
                  border: `2px solid ${color}`,
                  borderRadius: 12,
                  background: "var(--surface)",
                  cursor: "pointer",
                  overflow: "hidden",
                  opacity: dim ? 0.55 : 1,
                  transition:
                    "opacity 160ms ease-out, box-shadow 160ms ease-out",
                  boxShadow:
                    active || hovered ? `0 0 0 2px ${color}33` : "none",
                }}
              >
                {/* Variant sets get a stacked-thumbnail feel: the lead
                    design's thumb is the anchor, with subtle offset
                    layers behind and a small "N variants" chip. */}
                {isVariantSet && variantCount > 1 && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        left: 4,
                        right: -2,
                        bottom: 6,
                        borderRadius: 8,
                        border: `1px solid ${color}88`,
                        background: "var(--parchment-50)",
                        zIndex: 0,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 2,
                        right: 0,
                        bottom: 4,
                        borderRadius: 9,
                        border: `1px solid ${color}bb`,
                        background: "var(--surface)",
                        zIndex: 1,
                      }}
                    />
                  </>
                )}
                <div style={{ position: "relative", zIndex: 2 }}>
                  <DesignSquareThumb
                    designId={thumbAnchor}
                    title={s.design_title}
                    cached={cachedSet.has(thumbAnchor)}
                    storageUrlBase={storageUrlBase}
                    size={88}
                  />
                </div>
                {isVariantSet && variantCount > 1 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 4,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: color,
                      color: "var(--parchment-50)",
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      lineHeight: 1.5,
                      pointerEvents: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                      zIndex: 3,
                    }}
                  >
                    ×{variantCount}
                  </span>
                )}
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
                    zIndex: 3,
                  }}
                >
                  {mode === "quantity"
                    ? `${Math.round(displayTotal(s).qty)}×`
                    : moneyCompact(displayTotal(s).net)}
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

// Help modal that explains variant grouping — the two ways to create a
// set (drag-drop and auto-group), how folded totals aggregate,
// clicking the ×N chip to edit, and the toggle switching between
// individual and grouped views.
const kbdStyle: React.CSSProperties = {
  padding: "1px 6px",
  fontFamily: "var(--font-mono)",
  fontSize: 11.5,
  background: "var(--parchment-100)",
  border: "1px solid var(--parchment-300)",
  borderRadius: 4,
  color: "var(--ink-900)",
};

function VariantGroupsHelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How variant grouping works"
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
          borderRadius: 12,
          padding: 24,
          width: 560,
          maxWidth: "94vw",
          maxHeight: "88vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 500,
          }}
        >
          Grouping variants
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-700)", lineHeight: 1.55 }}>
          Group color and scale versions of the same design so their sales
          fold into one card.
        </p>

        <div>
          <h4 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 500 }}>
            Ways to group
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-700)", lineHeight: 1.65 }}>
            <li>
              <strong>Drag a card onto another.</strong> Onto a plain design
              makes a new group. Onto an existing group adds to it. Group
              onto group merges them.
            </li>
            <li>
              <strong>Click the <span style={{ display: "inline-flex", verticalAlign: "middle", width: 14, height: 14, borderRadius: 999, background: "var(--surface)", boxShadow: "0 0 0 1px var(--parchment-300)", alignItems: "center", justifyContent: "center", margin: "0 2px" }}>
                <svg width="7" height="7" viewBox="0 0 10 10" aria-hidden><line x1="5" y1="1.4" x2="5" y2="8.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><line x1="1.4" y1="5" x2="8.6" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </span> icon</strong> on a card. A searchable list of groups pops
              up — pick one to add / merge into.
            </li>
            <li>
              <strong>Multi-select first.</strong> Hold <kbd style={kbdStyle}>Cmd</kbd> (Mac) or{" "}
              <kbd style={kbdStyle}>Ctrl</kbd> (Windows) and click cards to build
              a selection. Then drag any one of them onto a target, or click
              its <span style={{ display: "inline-flex", verticalAlign: "middle", width: 14, height: 14, borderRadius: 999, background: "var(--surface)", boxShadow: "0 0 0 1px var(--parchment-300)", alignItems: "center", justifyContent: "center", margin: "0 2px" }}>
                <svg width="7" height="7" viewBox="0 0 10 10" aria-hidden><line x1="5" y1="1.4" x2="5" y2="8.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><line x1="1.4" y1="5" x2="8.6" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </span> — the whole selection moves together.
            </li>
            <li>
              <strong>Auto-group by code.</strong> If your titles carry codes
              like <code>ZAB25045</code>, use the header button to bulk-group
              every design sharing a code in one shot.
            </li>
          </ul>
        </div>

        <div>
          <h4 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 500 }}>
            Managing groups
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-700)", lineHeight: 1.65 }}>
            <li>
              Click the <strong>×N</strong> chip on a group to rename, remove
              a variant, or delete the group.
            </li>
            <li>
              Click any group card to see combined sales — stats and
              transactions fold across every variant.
            </li>
            <li>
              Toggle <strong>View as variant groups</strong> in the header to
              switch between folded and individual views.
            </li>
            <li>
              Press <kbd style={kbdStyle}>Esc</kbd> to clear a multi-selection.
            </li>
          </ul>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn--sm"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// Anchored dropdown that lists every existing variant set, searchable
// by name. Selecting a set adds the caller's design_ids to it. Renders
// via portal + position:fixed so it doesn't get clipped by parent
// overflow.
function AddToSetPopover({
  label,
  anchorRect,
  sets,
  designsById,
  cachedSet,
  storageUrlBase,
  onClose,
  onPick,
}: {
  label: string;
  anchorRect: DOMRect;
  sets: VariantSet[];
  // Used to pick each set's top-earning member as its thumbnail hero
  // (matches how the folded variant cards choose their thumbnail).
  designsById: Map<number, DesignAgg>;
  cachedSet: Set<number>;
  storageUrlBase: string;
  onClose: () => void;
  onPick: (setId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const width = 320;
  const gutter = 8;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (!pending) onClose();
      }
    };
    // Delay attach so the click that opened us doesn't immediately
    // close it.
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose, pending]);

  // Position — prefer below/right of the anchor. Clamp to viewport.
  const desiredTop = anchorRect.bottom + gutter;
  const desiredLeft = anchorRect.left;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(Math.max(gutter, desiredLeft), vw - width - gutter);
  // If the popover would fall off the bottom, place above the anchor.
  const maxHeight = 380;
  const top =
    desiredTop + maxHeight > vh - gutter
      ? Math.max(gutter, anchorRect.top - maxHeight - gutter)
      : desiredTop;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sets;
    return sets.filter((s) => s.name.toLowerCase().includes(q));
  }, [sets, query]);

  const node = (
    <div
      ref={containerRef}
      role="listbox"
      style={{
        position: "fixed",
        top,
        left,
        width,
        maxHeight,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: "10px 12px 6px" }}>
        <div style={{ fontSize: 11, color: "var(--ink-500)", marginBottom: 6 }}>
          {label}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search variant sets"
          disabled={pending}
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            font: "inherit",
            fontSize: 12.5,
          }}
        />
      </div>
      <div
        style={{
          overflowY: "auto",
          padding: "4px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              padding: "12px",
              fontSize: 12,
              color: "var(--ink-500)",
              textAlign: "center",
            }}
          >
            No sets match &ldquo;{query}&rdquo;
          </div>
        )}
        {filtered.map((s) => {
          // Pick the top-earning member as the thumbnail hero. Falls
          // back to the first design_id if nothing resolves (e.g. all
          // members outside topDesigns for some reason).
          let anchor = s.designIds[0] ?? 0;
          let bestNet = -Infinity;
          for (const id of s.designIds) {
            const d = designsById.get(id);
            if (d && d.net > bestNet) {
              bestNet = d.net;
              anchor = id;
            }
          }
          return (
            <button
              key={s.id}
              type="button"
              role="option"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onPick(s.id);
                } finally {
                  setPending(false);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 8px",
                border: "1px solid transparent",
                borderRadius: 6,
                background: "var(--surface)",
                cursor: pending ? "wait" : "pointer",
                textAlign: "left",
                font: "inherit",
                color: "var(--ink-900)",
              }}
              onMouseEnter={(e) => {
                if (!pending)
                  e.currentTarget.style.background = "var(--parchment-100)";
              }}
              onMouseLeave={(e) => {
                if (!pending)
                  e.currentTarget.style.background = "var(--surface)";
              }}
            >
              <div style={{ width: 36, height: 36, flexShrink: 0 }}>
                <DesignSquareThumb
                  designId={anchor}
                  title={s.name}
                  cached={cachedSet.has(anchor)}
                  storageUrlBase={storageUrlBase}
                  size={36}
                />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={s.name}
                >
                  {s.name}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-500)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {s.designIds.length} design
                  {s.designIds.length === 1 ? "" : "s"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
  return createPortal(node, document.body);
}

// Confirmation modal for multi-source drops. Shows the target (a
// variant set or a plain design) and each source card so the user can
// verify what they're about to merge before it commits.
function ConfirmDropModal({
  target,
  sources,
  designsById,
  variantData,
  cachedSet,
  storageUrlBase,
  onCancel,
  onConfirm,
}: {
  target: DragPayload;
  sources: DragPayload[];
  designsById: Map<number, DesignAgg>;
  variantData: VariantData;
  cachedSet: Set<number>;
  storageUrlBase: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  // Resolve target thumb + name.
  const targetInfo =
    target.kind === "variant"
      ? (() => {
          const set = variantData.sets.find((s) => s.id === target.setId);
          const leadId = set?.designIds[0] ?? 0;
          return {
            title: set?.name ?? "Variant set",
            subtitle: `${set?.designIds.length ?? 0} designs currently`,
            anchorDesignId: leadId,
          };
        })()
      : (() => {
          const d = designsById.get(target.designId);
          return {
            title: d?.design_title ?? `Design ${target.designId}`,
            subtitle: `#${target.designId}`,
            anchorDesignId: target.designId,
          };
        })();

  // Expand sources to individual design_ids for the preview list.
  const sourceDesignIds = Array.from(
    new Set(
      sources.flatMap((s) =>
        s.kind === "design"
          ? [s.designId]
          : variantData.sets.find((v) => v.id === s.setId)?.designIds ?? [],
      ),
    ),
  );
  const sourceDesigns = sourceDesignIds
    .map((id) => designsById.get(id))
    .filter((d): d is DesignAgg => !!d);

  const verb =
    target.kind === "variant"
      ? `Add to "${targetInfo.title}"`
      : `Create new group`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm drop"
      onClick={() => !busy && onCancel()}
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
          borderRadius: 12,
          padding: 20,
          width: 640,
          maxWidth: "94vw",
          maxHeight: "88vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          {verb}?
        </h3>

        {/* Target */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: 10,
            background: "var(--parchment-100)",
            borderRadius: 8,
          }}
        >
          <DesignSquareThumb
            designId={targetInfo.anchorDesignId}
            title={targetInfo.title}
            cached={cachedSet.has(targetInfo.anchorDesignId)}
            storageUrlBase={storageUrlBase}
            size={64}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Target
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {targetInfo.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
              {targetInfo.subtitle}
            </div>
          </div>
        </div>

        {/* Sources */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
          <div style={{ fontSize: 11, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Moving {sourceDesigns.length} design{sourceDesigns.length === 1 ? "" : "s"}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              maxHeight: 260,
              overflowY: "auto",
              padding: 6,
              border: "1px solid var(--parchment-200)",
              borderRadius: 8,
            }}
          >
            {sourceDesigns.map((d) => (
              <div
                key={d.design_id}
                style={{
                  width: 88,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
                title={`${d.design_title} · #${d.design_id}`}
              >
                <DesignSquareThumb
                  designId={d.design_id}
                  title={d.design_title}
                  cached={cachedSet.has(d.design_id)}
                  storageUrlBase={storageUrlBase}
                  size={88}
                />
                <a
                  href={`https://www.spoonflower.com/en/fabric/${d.design_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${d.design_title} — open on Spoonflower`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-700)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.3,
                    textDecoration: "none",
                  }}
                >
                  {d.design_title}
                </a>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Applying…" : verb}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal that scans design titles for a user-supplied prefix code
// (e.g. "ZAB"), extracts the token pattern PREFIX+alphanumerics, and
// creates one variant set per code with 2+ members. Optionally clears
// every existing set first so the user can start clean and let the
// algorithm redo everything.
function AutoGroupModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (prefix: string, clearExisting: boolean) => Promise<void>;
}) {
  const [prefix, setPrefix] = useState("");
  const [clearExisting, setClearExisting] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const canApply = prefix.trim().length >= 2 && !busy;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Auto-group by title code"
      onClick={() => !busy && onClose()}
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
          borderRadius: 12,
          padding: 20,
          width: 480,
          maxWidth: "94vw",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          Auto-group by title code
        </h3>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-700)", lineHeight: 1.55 }}>
          Do your designs share a family code in the title (like{" "}
          <code style={{ background: "var(--parchment-100)", padding: "1px 4px", borderRadius: 4 }}>
            ZAB25045
          </code>
          )? Type the letter prefix only — we&rsquo;ll find the numbers
          that follow.
        </p>
        <div
          style={{
            padding: "10px 12px",
            background: "var(--parchment-100)",
            borderRadius: 8,
            fontSize: 12.5,
            color: "var(--ink-700)",
            lineHeight: 1.5,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>Example title:</strong>{" "}
            <span style={{ color: "var(--ink-500)" }}>
              &ldquo;cottagecore geese garden floral{" "}
            </span>
            <code
              style={{
                background: "var(--saffron-50)",
                padding: "1px 4px",
                borderRadius: 3,
                fontWeight: 700,
              }}
            >
              ZAB25045
            </code>
            <span style={{ color: "var(--ink-500)" }}>&rdquo;</span>
          </div>
          <div>
            <strong>You type:</strong>{" "}
            <code
              style={{
                background: "var(--saffron-50)",
                padding: "1px 4px",
                borderRadius: 3,
                fontWeight: 700,
              }}
            >
              ZAB
            </code>
            <span style={{ color: "var(--ink-500)" }}>
              {" "}
              (just the letters — not the numbers, not a full code)
            </span>
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-500)",
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: "var(--ink-700)" }}>How the match works:</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            <li>
              Case is ignored — <code>ZAB</code>, <code>Zab</code>, and{" "}
              <code>zab</code> all match.
            </li>
            <li>
              The prefix must stand on its own as a word — <code>ZAB</code>{" "}
              inside a longer word like <code>ZABRA</code> doesn&rsquo;t
              count.
            </li>
            <li>
              Everything alphanumeric right after the prefix is captured as
              the code, until the next space or punctuation.
            </li>
            <li>
              Designs sharing the same code (2 or more) get grouped.
            </li>
          </ul>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
            Prefix (letters only)
          </span>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="PRE"
            disabled={busy}
            autoFocus
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              font: "inherit",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.05em",
            }}
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--ink-700)",
          }}
        >
          <input
            type="checkbox"
            checked={clearExisting}
            onChange={(e) => setClearExisting(e.target.checked)}
            disabled={busy}
          />
          Delete all existing variant sets first
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={!canApply}
            onClick={async () => {
              setBusy(true);
              try {
                await onApply(prefix.trim(), clearExisting);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Grouping…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal for editing an existing variant set. Lists members with a
// remove button on each, allows renaming, and offers to delete the
// whole set. Add-more happens via the "+" affordance on the set card
// (a different mode), not from here — keeps this modal focused on the
// existing set state.
function VariantEditModal({
  set,
  designsById,
  sortMode,
  cachedSet,
  storageUrlBase,
  onClose,
  onRename,
  onRemoveMember,
  onDelete,
}: {
  set: { id: string; name: string; designIds: number[] };
  designsById: Map<number, DesignAgg>;
  // Same sort metric currently selected on the Top Designs table so
  // members here rank in the same order the user sees outside the
  // modal.
  sortMode: TopDesignSort;
  cachedSet: Set<number>;
  storageUrlBase: string;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
  onRemoveMember: (designId: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [nameDraft, setNameDraft] = useState(set.name);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const members = useMemo(() => {
    const resolved = set.designIds
      .map((id) => designsById.get(id))
      .filter((d): d is DesignAgg => !!d);
    resolved.sort((a, b) => {
      if (sortMode === "sales") return b.saleCount - a.saleCount;
      if (sortMode === "refundDollars") return b.refunds - a.refunds;
      if (sortMode === "refundCount") return b.refundCount - a.refundCount;
      return b.net - a.net;
    });
    return resolved;
  }, [set.designIds, designsById, sortMode]);

  const dirtyName = nameDraft.trim() && nameDraft.trim() !== set.name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={() => !pending && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: 20,
          width: 520,
          maxWidth: "94vw",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 500,
            }}
          >
            Edit variant set
          </h3>
          <button
            type="button"
            className="btn btn--xs btn--ghost"
            onClick={onClose}
            disabled={pending}
          >
            Close
          </button>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Name</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={pending}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                font: "inherit",
              }}
            />
            <button
              type="button"
              className="btn btn--sm"
              disabled={pending || !dirtyName}
              onClick={async () => {
                setPending(true);
                await onRename(nameDraft.trim());
                setPending(false);
              }}
            >
              Save name
            </button>
          </div>
        </label>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minHeight: 0,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
            {members.length} member{members.length === 1 ? "" : "s"}
            {members.length < 2 && (
              <> · removing more will delete the set</>
            )}
          </span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              overflowY: "auto",
              border: "1px solid var(--parchment-200)",
              borderRadius: 8,
              padding: 6,
            }}
          >
            {members.map((m) => (
              <div
                key={m.design_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 6,
                  borderRadius: 6,
                }}
              >
                <div style={{ width: 96, height: 96, flexShrink: 0 }}>
                  <DesignSquareThumb
                    designId={m.design_id}
                    title={m.design_title}
                    cached={cachedSet.has(m.design_id)}
                    storageUrlBase={storageUrlBase}
                    size={96}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a
                    href={`https://www.spoonflower.com/en/fabric/${m.design_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${m.design_title} — open on Spoonflower`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                      color: "var(--ink-900)",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.design_title}
                    </span>
                    <Icon name="arrow" size={11} color="var(--ink-500)" />
                  </a>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ink-500)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    #{m.design_id} ·{" "}
                    <strong style={{ color: "var(--ink-900)" }}>
                      {sortMode === "sales"
                        ? `${m.saleCount} sold`
                        : sortMode === "refundDollars"
                          ? `${money(m.refunds)} refunded`
                          : sortMode === "refundCount"
                            ? `${m.refundCount} refunds`
                            : money(m.net)}
                    </strong>
                    {sortMode === "net" && (
                      <> · {m.saleCount} sold</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--xs btn--ghost"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    await onRemoveMember(m.design_id);
                    setPending(false);
                  }}
                  title="Remove this design from the set"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {!confirmingDelete ? (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              style={{ color: "var(--brick-500)" }}
            >
              Delete set
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--ink-700)" }}>
                Delete this variant set? Members become ungrouped again.
              </span>
              <button
                type="button"
                className="btn btn--xs btn--ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--xs"
                onClick={async () => {
                  setPending(true);
                  await onDelete();
                }}
                disabled={pending}
                style={{ background: "var(--brick-500)" }}
              >
                Delete
              </button>
            </div>
          )}
          <button
            type="button"
            className="btn btn--sm"
            onClick={onClose}
            disabled={pending}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Small pill-style on/off switch. Used for surface-level view modes
// where a two-button pair would feel like extra chrome.
function ToggleSwitch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 10px 3px 4px",
        borderRadius: 999,
        border: `1px solid ${on ? "var(--sage-500)" : "var(--parchment-300)"}`,
        background: on ? "var(--sage-100)" : "var(--surface)",
        color: "var(--ink-900)",
        font: "inherit",
        fontSize: 12,
        cursor: "pointer",
        transition: "background 160ms ease-out, border-color 160ms ease-out",
      }}
    >
      <span
        style={{
          width: 28,
          height: 16,
          borderRadius: 999,
          background: on ? "var(--sage-500)" : "var(--parchment-300)",
          position: "relative",
          transition: "background 160ms ease-out",
        }}
        aria-hidden
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 14 : 2,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: "var(--surface)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
            transition: "left 160ms ease-out",
          }}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

// Sticky bar shown while the user is in batch-select mode for grouping
// designs into a variant set. Reports the current selection count and
// exposes clear + save actions.
function SelectionBar({
  count,
  onClear,
  onSave,
  mode = "new",
  targetName,
}: {
  count: number;
  onClear: () => void;
  onSave: () => void;
  mode?: "new" | "append";
  targetName?: string;
}) {
  const minCount = mode === "append" ? 1 : 2;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        background: "var(--saffron-50)",
        border: "1px solid var(--saffron-300)",
        borderRadius: 8,
        fontSize: 12.5,
      }}
    >
      <span>
        <strong>{count}</strong> design{count === 1 ? "" : "s"} selected
      </span>
      <span style={{ color: "var(--ink-500)", fontSize: 11 }}>
        {mode === "append"
          ? `Adding to "${targetName}". Pick any orphan designs to add, then save.`
          : "Pick 2 or more variants (color / scale variations of the same base design), then save."}
      </span>
      <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        <button
          type="button"
          className="btn btn--xs btn--ghost"
          onClick={onClear}
          disabled={count === 0}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn btn--xs"
          onClick={onSave}
          disabled={count < minCount}
        >
          {mode === "append" ? "Add to set" : "Save as variant set"}
        </button>
      </span>
    </div>
  );
}

// Modal shown after the user commits a batch selection — confirms the
// set name (defaulted to the top-earning design's title).
function VariantSaveModal({
  initialName,
  count,
  saving,
  onCancel,
  onSave,
}: {
  initialName: string;
  count: number;
  saving: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: 20,
          width: 400,
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          Save {count} designs as a variant set
        </h3>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
            Set name (defaults to the top-earner)
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              font: "inherit",
            }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => onSave(name.trim())}
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
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

  // The server sends the union of top-N-by-revenue and top-N-by-qty so
  // we can re-rank locally when the mode toggles without losing keywords
  // that dominate only one metric. When a year is isolated we re-rank
  // by that year's totals too and hide keywords with no data in it.
  const displayTotal = (s: KeywordMonthlySeries): { net: number; qty: number } => {
    if (isolatedYear == null) {
      return { net: s.totalNet, qty: s.totalQty };
    }
    let net = 0;
    let qty = 0;
    for (const m of visibleMonths) {
      net += s.monthly[m] ?? 0;
      qty += s.monthlyQty[m] ?? 0;
    }
    return { net, qty };
  };

  const series = useMemo(() => {
    if (isolatedYear == null) {
      const sorted = [...allSeries].sort((a, b) =>
        mode === "quantity"
          ? b.totalQty - a.totalQty
          : b.totalNet - a.totalNet,
      );
      return sorted.slice(0, 20);
    }
    const yearMonths = months.filter(
      (m) => parseInt(m.split("-")[0], 10) === isolatedYear,
    );
    const withTotal = allSeries.map((s) => ({
      s,
      key:
        mode === "quantity"
          ? yearMonths.reduce((a, m) => a + (s.monthlyQty[m] ?? 0), 0)
          : yearMonths.reduce((a, m) => a + (s.monthly[m] ?? 0), 0),
    }));
    return withTotal
      .filter((x) => x.key > 0)
      .sort((a, b) => b.key - a.key)
      .slice(0, 20)
      .map((x) => x.s);
  }, [allSeries, mode, isolatedYear, months]);

  useEffect(() => {
    setHighlighted(null);
    setHover(null);
  }, [mode, isolatedYear]);

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

  if (series.length === 0) {
    return (
      <ChartEmptyCard
        title="Top 20 keywords by sales"
        message={
          isolatedYear != null
            ? `No keyword activity in ${isolatedYear}. Pick a different year or reset to All years.`
            : "No keyword activity yet."
        }
        onReset={
          isolatedYear != null ? () => setIsolatedYear(null) : undefined
        }
      />
    );
  }

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
          style={{ overflow: "hidden", cursor: "crosshair" }}
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
                  ? `${Math.round(displayTotal(s).qty)}×`
                  : moneyCompact(displayTotal(s).net)}
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
  onSelectVariant,
  variantData,
  pushToast,
}: {
  designs: DesignAgg[];
  cachedSet: Set<number>;
  storageUrlBase: string;
  onSelectDesign: (id: number) => void;
  onSelectVariant: (set: {
    name: string;
    designIds: number[];
    leadDesignId: number;
  }) => void;
  variantData: VariantData;
  pushToast: PushToast;
}) {
  const router = useRouter();
  const [sortMode, setSortMode] = useState<TopDesignSort>("net");
  // Grouping toggle. Auto-on the moment there's at least one variant
  // set — that way the user sees their groupings by default. Can flip
  // off to switch back to per-design view.
  const [grouping, setGrouping] = useState<"individual" | "grouped">(
    variantData.sets.length > 0 ? "grouped" : "individual",
  );
  // Edit modal state — which variant set the user opened via the ×N
  // chip. Null when no modal is shown.
  const [editingSet, setEditingSet] = useState<{
    id: string;
    name: string;
    designIds: number[];
  } | null>(null);
  // Auto-group-by-prefix modal open state.
  const [autoGroupOpen, setAutoGroupOpen] = useState(false);
  // "How grouping works" explainer modal.
  const [helpOpen, setHelpOpen] = useState(false);
  // Multi-selection for group actions. Keys are JSON-stringified
  // DragPayloads so a set can hold a mix of design_ids and variant
  // set_ids without collision. Cmd/Ctrl+click toggles; plain click
  // clears and opens the detail modal like before.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  // Pending drop staged for confirmation. Shown as a modal when the
  // user drops with a multi-selection so they can review the target
  // and confirm — otherwise merges silently through and it's easy to
  // lose track of what merged with what.
  const [pendingDrop, setPendingDrop] = useState<{
    target: DragPayload;
    sources: DragPayload[];
  } | null>(null);
  // "Add to existing set" popover — anchored to the + button of the
  // originating card. Works for both orphan cards ("add me to a set")
  // and variant-set cards ("merge me into another set"). `sourceSetIds`
  // gets populated when the source is one or more variant sets so we
  // can delete them after merging. `excludeSetId` prevents a set from
  // appearing as a target for itself.
  const [addToSetPopover, setAddToSetPopover] = useState<{
    designIds: number[];
    sourceSetIds: string[];
    anchorRect: DOMRect;
    excludeSetId?: string;
    label: string;
  } | null>(null);
  const isSelected = (p: DragPayload) => selectedKeys.has(JSON.stringify(p));
  const toggleSelected = (p: DragPayload) => {
    setSelectedKeys((prev) => {
      const key = JSON.stringify(p);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const clearSelection = () => setSelectedKeys(new Set());

  // Clear selection on Escape.
  useEffect(() => {
    if (selectedKeys.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedKeys.size]);

  // Fast lookup: design_id → DesignAgg. Used by the edit modal so
  // members can render their thumbnail + title without another prop
  // drill.
  const designsById = useMemo(() => {
    const m = new Map<number, DesignAgg>();
    for (const d of designs) m.set(d.design_id, d);
    return m;
  }, [designs]);

  // Fold designs by variant set when Grouped is active.
  const displayDesigns = useMemo(() => {
    if (grouping !== "grouped") return designs;
    return foldDesignAggByVariant(
      designs,
      variantData.sets,
      variantData.setByDesignId,
    );
  }, [designs, variantData, grouping]);

  // Central drop dispatcher — resolves what to do when a source card is
  // dropped onto a target card. Handles:
  //   design → design: create a new variant set from both.
  //   design → variant set: append the design to the set.
  //   variant set → variant set: append all members of the source set
  //     to the target set, then delete the emptied source set.
  //   variant set → design: same as reverse (design → set) but treat
  //     the design as the anchor since it's the drop target — actually
  //     the more useful move is to merge them all into a new set. We'll
  //     just create a new set containing the design + all members.
  const onDropOnCard = (target: DragPayload, source: DragPayload) => {
    // If the dragged card was part of a multi-selection, treat every
    // selected card as a source (except the drop target itself).
    const sourceKey = JSON.stringify(source);
    const targetKey = JSON.stringify(target);
    const sources: DragPayload[] =
      selectedKeys.has(sourceKey) && selectedKeys.size > 1
        ? Array.from(selectedKeys)
            .filter((k) => k !== targetKey)
            .map((k) => JSON.parse(k) as DragPayload)
        : [source];

    // Any multi-source drop gets staged for confirmation so the user
    // sees the target explicitly. Single-source drops apply directly.
    if (sources.length > 1) {
      setPendingDrop({ target, sources });
      return;
    }
    void applyDrop(target, sources);
  };

  const applyDrop = async (
    target: DragPayload,
    sources: DragPayload[],
  ) => {
    // Helper: expand a payload to the concrete design_ids it represents.
    const expand = (p: DragPayload): number[] => {
      if (p.kind === "design") return [p.designId];
      const set = variantData.sets.find((s) => s.id === p.setId);
      return set?.designIds ?? [];
    };
    const sourceDesignIds = Array.from(
      new Set(sources.flatMap(expand)),
    );
    const sourceVariantSets = sources
      .filter((s): s is Extract<DragPayload, { kind: "variant" }> => s.kind === "variant")
      .map((s) => s.setId);

    if (target.kind === "variant") {
      if (sourceDesignIds.length === 0) return;
      const existing =
        variantData.sets.find((s) => s.id === target.setId)?.designIds ??
        [];
      const nextIds = Array.from(
        new Set([...existing, ...sourceDesignIds]),
      );
      const res = await setVariantMembership(target.setId, nextIds);
      if (res.error) {
        pushToast({ kind: "error", message: res.error });
        return;
      }
      // Delete any source variant sets whose members were merged in.
      for (const setId of sourceVariantSets) {
        if (setId !== target.setId) await deleteVariantSet(setId);
      }
      const targetName =
        variantData.sets.find((s) => s.id === target.setId)?.name ??
        "variant set";
      pushToast({
        kind: "success",
        message:
          sourceVariantSets.length > 0
            ? `Merged into "${targetName}".`
            : `Added ${sourceDesignIds.length} design${sourceDesignIds.length === 1 ? "" : "s"} to "${targetName}".`,
      });
      clearSelection();
      router.refresh();
      return;
    }

    // target.kind === "design" — create a NEW set containing target +
    // all source design_ids.
    const ids = Array.from(
      new Set([target.designId, ...sourceDesignIds]),
    );
    if (ids.length < 2) return;
    const lead =
      designs
        .filter((d) => ids.includes(d.design_id))
        .sort((a, b) => b.net - a.net)[0];
    const name = lead?.design_title ?? "Variant set";
    const res = await createVariantSet(name, ids);
    if (res.error) {
      pushToast({ kind: "error", message: res.error });
      return;
    }
    // Delete any source variant sets that were consumed.
    for (const setId of sourceVariantSets) {
      await deleteVariantSet(setId);
    }
    pushToast({ kind: "success", message: `Variant set "${name}" created.` });
    clearSelection();
    router.refresh();
  };

  const sorted = useMemo(() => {
    const filtered =
      sortMode === "refundDollars"
        ? displayDesigns.filter((d) => d.refunds > 0)
        : sortMode === "refundCount"
          ? displayDesigns.filter((d) => d.refundCount > 0)
          : displayDesigns;
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortMode === "sales") return b.saleCount - a.saleCount;
      if (sortMode === "refundDollars") return b.refunds - a.refunds;
      if (sortMode === "refundCount") return b.refundCount - a.refundCount;
      return b.net - a.net;
    });
    return copy;
  }, [displayDesigns, sortMode]);

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
            {variantData.sets.length > 0 && (
              <>
                {" · "}
                {variantData.sets.length}{" "}
                {variantData.sets.length === 1
                  ? "variant group"
                  : "variant groups"}
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {variantData.sets.length > 0 && (
            <>
              <ToggleSwitch
                on={grouping === "grouped"}
                onToggle={() =>
                  setGrouping(
                    grouping === "grouped" ? "individual" : "grouped",
                  )
                }
                label="View as variant groups"
              />
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 16,
                  background: "var(--parchment-200)",
                  margin: "0 2px",
                }}
              />
            </>
          )}
          <button
            type="button"
            className="btn btn--xs btn--ghost"
            onClick={() => setAutoGroupOpen(true)}
            title="Auto-group by a title code like ZAB25045"
          >
            Auto-group by code
          </button>
          <button
            type="button"
            aria-label="How does variant grouping work?"
            title="How does variant grouping work?"
            onClick={() => setHelpOpen(true)}
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              border: "1.5px solid var(--ink-500)",
              background: "var(--surface)",
              color: "var(--ink-700)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              cursor: "pointer",
              font: "inherit",
              fontSize: 12,
              fontWeight: 700,
              fontStyle: "italic",
              lineHeight: 1,
              fontFamily: "var(--font-display)",
            }}
          >
            i
          </button>
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
      </div>
      {selectedKeys.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 10px",
            background: "var(--saffron-50)",
            border: "1px solid var(--saffron-300)",
            borderRadius: 8,
            fontSize: 12.5,
          }}
        >
          <strong>{selectedKeys.size}</strong>{" "}
          selected
          <span style={{ color: "var(--ink-500)", fontSize: 11 }}>
            Drag any selected card onto a target to move them all together.
          </span>
          <button
            type="button"
            className="btn btn--xs btn--ghost"
            style={{ marginLeft: "auto" }}
            onClick={clearSelection}
          >
            Clear
          </button>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {sorted.map((d) => {
          const isVariantSet = !!d.variantSetId;
          const isOrphan =
            !isVariantSet && !variantData.setByDesignId[d.design_id];
          const cardPayload: DragPayload = isVariantSet
            ? { kind: "variant", setId: d.variantSetId! }
            : { kind: "design", designId: d.design_id };
          return (
            <DesignThumbCard
              key={d.variantSetId ?? d.design_id}
              design={d}
              cached={cachedSet.has(
                d.variantLeadDesignId ?? d.design_id,
              )}
              storageUrlBase={storageUrlBase}
              sortMode={sortMode}
              onClick={(e) => {
                // Cmd (Mac) / Ctrl (Windows) → toggle in selection.
                if (e.metaKey || e.ctrlKey) {
                  e.preventDefault();
                  toggleSelected(cardPayload);
                  return;
                }
                // Plain click clears any prior selection and opens the
                // detail modal.
                if (selectedKeys.size > 0) clearSelection();
                if (isVariantSet) {
                  onSelectVariant({
                    name: d.design_title,
                    designIds: d.variantDesignIds ?? [],
                    leadDesignId:
                      d.variantLeadDesignId ?? d.design_id,
                  });
                } else {
                  onSelectDesign(d.design_id);
                }
              }}
              variantMarker={
                isVariantSet
                  ? {
                      kind: "set",
                      count: d.variantDesignIds?.length ?? 0,
                    }
                  : isOrphan
                    ? { kind: "orphan" }
                    : { kind: "member" }
              }
              onEditClick={
                isVariantSet
                  ? () => {
                      setEditingSet({
                        id: d.variantSetId!,
                        name: d.design_title,
                        designIds: d.variantDesignIds ?? [],
                      });
                    }
                  : undefined
              }
              dragPayload={cardPayload}
              onDropOnCard={(source) => onDropOnCard(cardPayload, source)}
              selected={isSelected(cardPayload)}
              onAddToSetClick={
                variantData.sets.length >
                  (isVariantSet ? 1 : 0)
                  ? (anchorEl) => {
                      // Assemble sources. If this card is in the multi
                      // selection, use every selected card; otherwise
                      // just this one.
                      const key = JSON.stringify(cardPayload);
                      const selectedPayloads = selectedKeys.has(key)
                        ? Array.from(selectedKeys).map(
                            (k) => JSON.parse(k) as DragPayload,
                          )
                        : [cardPayload];
                      const designIds = Array.from(
                        new Set(
                          selectedPayloads.flatMap((p) =>
                            p.kind === "design"
                              ? [p.designId]
                              : variantData.sets.find((s) => s.id === p.setId)
                                  ?.designIds ?? [],
                          ),
                        ),
                      );
                      const sourceSetIds = Array.from(
                        new Set(
                          selectedPayloads
                            .filter(
                              (
                                p,
                              ): p is Extract<DragPayload, { kind: "variant" }> =>
                                p.kind === "variant",
                            )
                            .map((p) => p.setId),
                        ),
                      );
                      setAddToSetPopover({
                        designIds,
                        sourceSetIds,
                        // Never offer the source set as a target — you
                        // can't merge a set into itself.
                        excludeSetId: isVariantSet
                          ? d.variantSetId ?? undefined
                          : undefined,
                        anchorRect: anchorEl.getBoundingClientRect(),
                        label: isVariantSet
                          ? `Merge into another variant set`
                          : `Add ${designIds.length} design${designIds.length === 1 ? "" : "s"} to …`,
                      });
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
      {editingSet && (
        <VariantEditModal
          set={editingSet}
          designsById={designsById}
          sortMode={sortMode}
          cachedSet={cachedSet}
          storageUrlBase={storageUrlBase}
          onClose={() => setEditingSet(null)}
          onRename={async (newName) => {
            const res = await renameVariantSet(editingSet.id, newName);
            if (res.error) {
              pushToast({ kind: "error", message: res.error });
              return;
            }
            pushToast({ kind: "success", message: "Set renamed." });
            setEditingSet({ ...editingSet, name: newName });
            router.refresh();
          }}
          onRemoveMember={async (designId) => {
            const nextIds = editingSet.designIds.filter(
              (id) => id !== designId,
            );
            const res = await setVariantMembership(editingSet.id, nextIds);
            if (res.error) {
              pushToast({ kind: "error", message: res.error });
              return;
            }
            pushToast({ kind: "success", message: "Removed from set." });
            if (nextIds.length < 2) {
              // Fewer than 2 members remaining defeats the purpose of a
              // variant set. Delete it so the user doesn't get stuck
              // with a "set of 1" pill.
              await deleteVariantSet(editingSet.id);
              pushToast({
                kind: "info",
                message:
                  "Set deleted — a variant set needs 2+ members.",
              });
              setEditingSet(null);
              router.refresh();
              return;
            }
            setEditingSet({ ...editingSet, designIds: nextIds });
            router.refresh();
          }}
          onDelete={async () => {
            const res = await deleteVariantSet(editingSet.id);
            if (res.error) {
              pushToast({ kind: "error", message: res.error });
              return;
            }
            pushToast({ kind: "success", message: "Set deleted." });
            setEditingSet(null);
            router.refresh();
          }}
        />
      )}
      {autoGroupOpen && (
        <AutoGroupModal
          onClose={() => setAutoGroupOpen(false)}
          onApply={async (prefix, clearExisting) => {
            const res = await autoGroupByPrefix(prefix, clearExisting);
            if (res.error && !res.setsCreated) {
              pushToast({ kind: "error", message: res.error });
              return;
            }
            const parts = [
              clearExisting
                ? `Deleted ${res.setsDeleted ?? 0} existing sets`
                : null,
              `Grouped ${res.designsGrouped ?? 0} designs into ${res.setsCreated ?? 0} sets`,
              `(${res.distinctCodes ?? 0} codes seen)`,
            ].filter(Boolean);
            pushToast({
              kind: "success",
              message: parts.join(" · "),
            });
            setAutoGroupOpen(false);
            router.refresh();
          }}
        />
      )}
      {helpOpen && <VariantGroupsHelpModal onClose={() => setHelpOpen(false)} />}
      {addToSetPopover && (
        <AddToSetPopover
          label={addToSetPopover.label}
          anchorRect={addToSetPopover.anchorRect}
          sets={variantData.sets.filter(
            (s) => s.id !== addToSetPopover.excludeSetId,
          )}
          designsById={designsById}
          cachedSet={cachedSet}
          storageUrlBase={storageUrlBase}
          onClose={() => setAddToSetPopover(null)}
          onPick={async (setId) => {
            const existing =
              variantData.sets.find((s) => s.id === setId)?.designIds ?? [];
            const nextIds = Array.from(
              new Set([...existing, ...addToSetPopover.designIds]),
            );
            const res = await setVariantMembership(setId, nextIds);
            if (res.error) {
              pushToast({ kind: "error", message: res.error });
              return;
            }
            // Delete any source variant sets whose members were merged.
            for (const srcId of addToSetPopover.sourceSetIds) {
              if (srcId !== setId) await deleteVariantSet(srcId);
            }
            const setName =
              variantData.sets.find((s) => s.id === setId)?.name ??
              "variant set";
            pushToast({
              kind: "success",
              message:
                addToSetPopover.sourceSetIds.length > 0
                  ? `Merged into "${setName}".`
                  : `Added ${addToSetPopover.designIds.length} design${addToSetPopover.designIds.length === 1 ? "" : "s"} to "${setName}".`,
            });
            setAddToSetPopover(null);
            clearSelection();
            router.refresh();
          }}
        />
      )}
      {pendingDrop && (
        <ConfirmDropModal
          target={pendingDrop.target}
          sources={pendingDrop.sources}
          designsById={designsById}
          variantData={variantData}
          cachedSet={cachedSet}
          storageUrlBase={storageUrlBase}
          onCancel={() => setPendingDrop(null)}
          onConfirm={async () => {
            const { target, sources } = pendingDrop;
            setPendingDrop(null);
            await applyDrop(target, sources);
          }}
        />
      )}
    </div>
  );
}

// Card that renders one design in the Top Designs grid. Modeled after the
// extension's `.thumb-card` pattern — square thumbnail on top, tight
// text block underneath (title, stats, primary value). The sort mode
// determines which value the card foregrounds so the emphasized number
// aligns with what the user is ranking by.
type VariantMarker =
  | { kind: "set"; count: number }   // this card is a folded variant set
  | { kind: "orphan" }                // this design is not in any set
  | { kind: "member" };               // this design is in a set (grouped view hides it)

// Tokenize a design title for similarity matching. Strips ZAB SKU codes
// (they're internal identifiers, would sabotage similarity), lowercases,
// and splits on any non-alphanumeric.
function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/\bzab[a-z0-9]+\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

// Jaccard similarity between two token lists — |intersection| / |union|.
// Two titles that share most of their tokens score >0.5; unrelated
// titles typically score <0.2. Used to guess variant-siblings when the
// user starts a grouping from one orphan thumbnail.
function titleSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let common = 0;
  for (const t of setA) if (setB.has(t)) common++;
  const union = new Set([...a, ...b]).size;
  return common / union;
}

// Payload shape carried through drag events so drop handlers know what
// the source is. Same shape covers "individual design" and "folded
// variant set" — drop handlers key off `kind`.
type DragPayload =
  | { kind: "design"; designId: number }
  | { kind: "variant"; setId: string };

function DesignThumbCard({
  design,
  cached,
  storageUrlBase,
  sortMode,
  onClick,
  variantMarker,
  onEditClick,
  dragPayload,
  onDropOnCard,
  selected,
  onAddToSetClick,
}: {
  design: DesignAgg;
  cached: boolean;
  storageUrlBase: string;
  sortMode: TopDesignSort;
  onClick: (e: React.MouseEvent) => void;
  variantMarker?: VariantMarker;
  // Only relevant on variant-set cards: opens the edit modal.
  onEditClick?: () => void;
  // What this card broadcasts when the user starts dragging it. Omitted
  // for cards that can't participate as sources (rare).
  dragPayload?: DragPayload;
  // Fired when another card is dropped onto this one. Receives the
  // source payload; the parent decides whether it's a new-set create,
  // an append-to-set, or a no-op.
  onDropOnCard?: (source: DragPayload) => void;
  // True when this card is part of the current Cmd/Ctrl-click
  // multi-selection. Renders a saffron ring so the user can see the
  // set at a glance.
  selected?: boolean;
  // Only relevant on orphan cards: opens a "add to existing set"
  // dropdown so the user can pick a target set from a list instead of
  // dragging. Complementary to drag-drop, not a replacement.
  onAddToSetClick?: (anchorEl: HTMLElement) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const primary =
    sortMode === "sales"
      ? { value: design.saleCount.toLocaleString("en-US"), label: "sold" }
      : sortMode === "refundDollars"
        ? { value: money(design.refunds), label: "refunded", danger: true }
        : sortMode === "refundCount"
          ? { value: design.refundCount.toLocaleString("en-US"), label: "refunds", danger: true }
          : { value: money(design.net), label: "net" };
  const thumbAnchor =
    variantMarker?.kind === "set"
      ? design.variantLeadDesignId ?? design.design_id
      : design.design_id;
  const isSet = variantMarker?.kind === "set";
  const isOrphan = variantMarker?.kind === "orphan";
  const cardBorder = dragOver || selected
    ? "var(--saffron-500)"
    : "var(--parchment-200)";
  return (
    <button
      type="button"
      onClick={(e) => onClick(e)}
      draggable={!!dragPayload}
      onDragStart={
        dragPayload
          ? (e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData(
                "application/x-variant-source",
                JSON.stringify(dragPayload),
              );
            }
          : undefined
      }
      onDragOver={
        onDropOnCard
          ? (e) => {
              const raw = e.dataTransfer.types.includes(
                "application/x-variant-source",
              );
              if (!raw) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (!dragOver) setDragOver(true);
            }
          : undefined
      }
      onDragLeave={
        onDropOnCard
          ? () => {
              setDragOver(false);
            }
          : undefined
      }
      onDrop={
        onDropOnCard
          ? (e) => {
              e.preventDefault();
              setDragOver(false);
              const raw = e.dataTransfer.getData(
                "application/x-variant-source",
              );
              if (!raw) return;
              try {
                const source = JSON.parse(raw) as DragPayload;
                onDropOnCard(source);
              } catch {
                // ignore malformed payload
              }
            }
          : undefined
      }
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: `1px solid ${cardBorder}`,
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        color: "var(--ink-900)",
        cursor: dragPayload ? "grab" : "pointer",
        padding: 0,
        textAlign: "left",
        font: "inherit",
        transition:
          "border-color 160ms ease-out, box-shadow 160ms ease-out",
        position: "relative",
        boxShadow: dragOver || selected
          ? "0 0 0 3px var(--saffron-100)"
          : undefined,
      }}
      onMouseEnter={(e) => {
        if (!dragOver && !selected)
          e.currentTarget.style.borderColor = "var(--slate-300)";
      }}
      onMouseLeave={(e) => {
        if (!dragOver && !selected)
          e.currentTarget.style.borderColor = "var(--parchment-200)";
      }}
    >
      <div style={{ position: "relative" }}>
        <DesignSquareThumb
          designId={thumbAnchor}
          title={design.design_title}
          cached={cached}
          storageUrlBase={storageUrlBase}
        />
        {isSet && variantMarker.count > 1 && (
          <span
            role={onEditClick ? "button" : undefined}
            tabIndex={onEditClick ? 0 : undefined}
            aria-label={
              onEditClick ? "Edit this variant set" : undefined
            }
            title={
              onEditClick
                ? `Edit set (${variantMarker.count} designs)`
                : `Variant set of ${variantMarker.count} designs`
            }
            onClick={
              onEditClick
                ? (e) => {
                    e.stopPropagation();
                    onEditClick();
                  }
                : undefined
            }
            onKeyDown={
              onEditClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onEditClick();
                    }
                  }
                : undefined
            }
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              padding: "3px 10px",
              borderRadius: 999,
              background: "var(--ink-900)",
              color: "var(--parchment-50)",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              lineHeight: 1.3,
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
              cursor: onEditClick ? "pointer" : "default",
              zIndex: 4,
            }}
          >
            ×{variantMarker.count}
          </span>
        )}
        {onAddToSetClick && (isOrphan || isSet) && (
          <span
            role="button"
            tabIndex={0}
            aria-label={
              isSet
                ? "Merge this variant set into another set"
                : "Add to an existing variant set"
            }
            title={
              isSet
                ? "Merge into another set"
                : "Add to an existing variant set"
            }
            onClick={(e) => {
              e.stopPropagation();
              onAddToSetClick(e.currentTarget as HTMLElement);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onAddToSetClick(e.currentTarget as HTMLElement);
              }
            }}
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "var(--surface)",
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-900)",
              padding: 0,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              zIndex: 4,
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 10 10"
              style={{ display: "block" }}
              aria-hidden
            >
              <line x1="5" y1="1.4" x2="5" y2="8.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="1.4" y1="5" x2="8.6" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </div>
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
