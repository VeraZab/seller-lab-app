// Pure functions that turn a list of sales_events rows into the numbers
// and slices the analytics UI renders. Kept dependency-free so the page
// (server component) can compute once and the client just paints.

export type SalesRow = {
  id: string;
  sold_at: string;
  type: string;
  qty: number;
  size: string | null;
  design_title: string | null;
  design_id: number | null;
  substrate: string | null;
  customer: string | null;
  amount: number;
  balance: number | null;
};

// A personal-purchase event: the seller spent their own Spoondollar
// balance on a Spoonflower order. Types are "debit" in our normalized
// vocabulary; they show up in the CSV so the running balance in the
// export math reconciles.
export type MyPurchasesSummary = {
  total: number;
  count: number;
  firstAt: string | null;
  lastAt: string | null;
};

export type Headline = {
  grossRevenue: number;
  refundsTotal: number; // absolute value of refund $
  netRevenue: number;
  refundRatePct: number;
  saleCount: number; // count of type='sale' rows
  refundCount: number;
  avgSaleAmount: number;
  firstSaleAt: string | null;
  lastSaleAt: string | null;
  uniqueDesigns: number;
  // Named (non-guest) unique customers. Guest events don't roll up here
  // because we can't attribute one guest event to the same person as
  // another guest event.
  uniqueCustomers: number;
  // Total sale events where the customer handle was 'guest' /
  // 'guest_user' / 'anonymous'. Useful as a raw count.
  guestSaleCount: number;
  // Guest events as a percentage of all sale events. Answers "what
  // fraction of my sales come from anonymous checkouts?"
  guestSharePct: number;
  // Named customers who bought more than once (repeat business signal).
  // Excludes guest — see uniqueCustomers.
  returningCustomers: number;
};

export type DesignAgg = {
  design_id: number;
  design_title: string;
  gross: number;
  refunds: number;
  net: number;
  units: number;
  // Number of successful sale events for this design (not refunds).
  saleCount: number;
  // Number of refund events for this design.
  refundCount: number;
};

export type BucketAgg = {
  label: string;
  gross: number;
  net: number;
  count: number;
};

export type CustomerAgg = {
  customer: string;
  isGuest: boolean;
  gross: number;
  refunds: number;
  net: number;
  orders: number;
  firstAt: string;
  lastAt: string;
};

export type DailyPoint = {
  day: string; // YYYY-MM-DD
  gross: number;
  refunds: number;
  net: number;
  // Number of sale events on the day. Doesn't include refunds.
  count: number;
  // Sum of the Qty column across sale events on the day (units sold, not
  // number of transactions — a single sale of 3 fat quarters counts as 3
  // here but 1 in `count`).
  qty: number;
};

// Year-over-year monthly series — one entry per year the seller has
// activity, each with 12 months of aggregated net revenue / sale count /
// quantity. Powers the year-over-year overlay chart on /analytics so a
// seller can see whether "March this year" is stronger than "March last
// year". Any month without sales is 0.
export type YearlySeries = {
  year: number;
  monthlyNet: number[]; // 12 entries, Jan..Dec
  monthlyCount: number[];
  monthlyQty: number[];
  totalNet: number;
};

// Monthly time series for the top N designs. Buckets are keyed by
// YYYY-MM so the chart can lay them out along a shared timeline.
// Includes a wallpaper/fabric/decor mix percentage per design so the
// hover tooltip can show what kind of product each line represents.
export type DesignMonthlySeries = {
  design_id: number;
  design_title: string;
  totalNet: number;
  totalSales: number;
  totalQty: number;
  // Product-mix breakdown by NET revenue.
  wallpaperPct: number;
  fabricPct: number;
  decorPct: number;
  // Monthly net revenue keyed by YYYY-MM. Missing months = 0.
  monthly: Record<string, number>;
  // Monthly quantity keyed by YYYY-MM. Missing months = 0.
  monthlyQty: Record<string, number>;
};

export function computeTopDesignsMonthly(
  allRows: SalesRow[],
  topN: number = 10,
): { series: DesignMonthlySeries[]; months: string[] } {
  const rows = allRows.filter(isAnalyticsEvent);

  // First pass: aggregate net per design + mix + monthly buckets.
  const byDesign = new Map<
    number,
    {
      title: string;
      totalNet: number;
      totalSales: number;
      totalQty: number;
      wallpaperNet: number;
      fabricNet: number;
      decorNet: number;
      monthly: Map<string, number>;
      monthlyQty: Map<string, number>;
    }
  >();
  const allMonthKeys = new Set<string>();

  for (const r of rows) {
    if (!r.design_id) continue;
    const d = new Date(r.sold_at);
    if (Number.isNaN(d.getTime())) continue;
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    allMonthKeys.add(monthKey);
    const entry = byDesign.get(r.design_id) ?? {
      title: r.design_title ?? "Untitled",
      totalNet: 0,
      totalSales: 0,
      totalQty: 0,
      wallpaperNet: 0,
      fabricNet: 0,
      decorNet: 0,
      monthly: new Map<string, number>(),
      monthlyQty: new Map<string, number>(),
    };
    if (r.design_title) entry.title = r.design_title;
    const signedAmount = isRefund(r) ? -Math.abs(r.amount) : r.amount;
    entry.totalNet += signedAmount;
    entry.monthly.set(
      monthKey,
      (entry.monthly.get(monthKey) ?? 0) + signedAmount,
    );
    if (!isRefund(r) && r.type === "sale") {
      entry.totalSales++;
      entry.totalQty += r.qty;
      entry.monthlyQty.set(
        monthKey,
        (entry.monthlyQty.get(monthKey) ?? 0) + r.qty,
      );
    }
    // Attribute the net to a product category bucket for the mix pct.
    const category = classifyProductCategory(r.size, r.substrate);
    if (category === "Wallpaper") entry.wallpaperNet += signedAmount;
    else if (category === "Fabric") entry.fabricNet += signedAmount;
    else entry.decorNet += signedAmount;
    byDesign.set(r.design_id, entry);
  }

  // Sort months chronologically for X-axis layout.
  const months = Array.from(allMonthKeys).sort();

  // Materialize the aggregation, then rank. Return the UNION of the
  // top-N by revenue AND top-N by qty so the client can re-rank on the
  // fly when the user toggles between $ and qty modes — otherwise a
  // design with modest revenue but a huge qty (fat-quarter volume) would
  // vanish in qty view.
  const all = Array.from(byDesign.entries()).map(([design_id, e]) => {
    const totalNet = round2(e.totalNet);
    const totalAttribution = Math.max(
      1,
      e.wallpaperNet + e.fabricNet + e.decorNet,
    );
    const monthly: Record<string, number> = {};
    const monthlyQty: Record<string, number> = {};
    for (const m of months) {
      monthly[m] = round2(e.monthly.get(m) ?? 0);
      monthlyQty[m] = e.monthlyQty.get(m) ?? 0;
    }
    return {
      design_id,
      design_title: e.title,
      totalNet,
      totalSales: e.totalSales,
      totalQty: e.totalQty,
      wallpaperPct: round2((e.wallpaperNet / totalAttribution) * 100),
      fabricPct: round2((e.fabricNet / totalAttribution) * 100),
      decorPct: round2((e.decorNet / totalAttribution) * 100),
      monthly,
      monthlyQty,
    };
  });
  const topByRev = [...all]
    .sort((a, b) => b.totalNet - a.totalNet)
    .slice(0, topN);
  const topByQty = [...all]
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, topN);
  const idSet = new Set<number>();
  const ranked: DesignMonthlySeries[] = [];
  for (const d of [...topByRev, ...topByQty]) {
    if (idSet.has(d.design_id)) continue;
    idSet.add(d.design_id);
    ranked.push(d);
  }

  return { series: ranked, months };
}

// Per-keyword monthly time series — top N tags on the user's sold
// designs, ranked by revenue (or qty in qty mode).
//
// Attribution rule: each sale's FULL net + FULL qty are credited to
// every one of the design's tokens. A $10 sale on a design tagged
// with 5 words contributes $10 to each of those 5 tokens (not $2).
// Reads as "revenue/qty on sales featuring this keyword" — the
// downside is that summing keyword totals exceeds actual revenue/qty
// (each sale counted once per token). We chose this because it maps
// to how humans think about a keyword ("how much money did designs
// with 'block-print' bring in?") rather than a strict accounting split.
export type KeywordMonthlySeries = {
  keyword: string;
  totalNet: number;
  totalQty: number;
  monthly: Record<string, number>;
  monthlyQty: Record<string, number>;
};

// Extract discoverability tokens for a sale, drawing from BOTH the
// Spoonflower tags for the design AND the design title itself. The
// merged set represents the "keywords likely helping this design get
// found." SKU codes like ZAB25024 are stripped since they're internal
// identifiers, not real keywords.
//
// `phrases` are user-defined multi-word tokens saved with hyphens as
// separators (e.g. "block-print"). Any tag/title that contains the
// phrase — either hyphenated OR space-separated — emits the phrase
// as ONE token and does NOT emit the constituent single tokens for
// that appearance. Longest phrases win when they overlap.
function extractSaleTokens(
  designTags: string[] | undefined,
  designTitle: string | null,
  phrases: string[] = [],
): Set<string> {
  const tokens = new Set<string>();
  const sources: string[] = [];
  if (designTags?.length) sources.push(...designTags);
  if (designTitle) sources.push(designTitle);
  const sortedPhrases = [...phrases].sort((a, b) => b.length - a.length);
  for (const phrase of sources) {
    let text = phrase.trim().toLowerCase();
    for (const p of sortedPhrases) {
      const hy = p.toLowerCase();
      const sp = hy.replace(/-/g, " ");
      const pattern = new RegExp(
        `\\b(?:${escapeRegExp(sp)}|${escapeRegExp(hy)})\\b`,
        "g",
      );
      text = text.replace(pattern, () => {
        tokens.add(hy);
        return " ";
      });
    }
    for (const t of text.split(/\s+/)) {
      const tok = t.trim();
      if (tok.length < 2) continue;
      // Strip SKU codes: any token starting with `zab` followed by
      // alphanumerics (ZAB25024, zab25045, etc.). Real English words
      // don't start with `zab`, so this doesn't false-positive.
      if (/^zab[a-z0-9]*$/i.test(tok)) continue;
      tokens.add(tok);
    }
  }
  return tokens;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function computeTopKeywordsMonthly(
  allRows: SalesRow[],
  tagsByDesign: Map<number, string[]>,
  topN: number = 10,
  phrases: string[] = [],
  hiddenWords: Set<string> = new Set(),
): { series: KeywordMonthlySeries[]; months: string[] } {
  const rows = allRows.filter(isAnalyticsEvent);
  // Cache latest title per design_id from the sales rows so we don't
  // read the title N times for the same design.
  const titleByDesign = new Map<number, string>();
  for (const r of rows) {
    if (r.design_id && r.design_title && !titleByDesign.has(r.design_id)) {
      titleByDesign.set(r.design_id, r.design_title);
    }
  }
  const byKeyword = new Map<string, Map<string, number>>();
  const byKeywordQty = new Map<string, Map<string, number>>();
  const totalByKeyword = new Map<string, number>();
  const totalQtyByKeyword = new Map<string, number>();
  const allMonthKeys = new Set<string>();
  for (const r of rows) {
    if (!r.design_id) continue;
    const tags = tagsByDesign.get(r.design_id);
    const title = titleByDesign.get(r.design_id) ?? r.design_title ?? null;
    // Include a sale even if we don't have scraped tags yet — the title
    // alone still contributes tokens. This means the leaderboard fills
    // in immediately after CSV upload rather than waiting on scrapes.
    const rawTokens = extractSaleTokens(tags, title, phrases);
    // Strip user-hidden tokens before attribution. Hiding "new" or "the"
    // in the workspace library means "not a real keyword" — the analytics
    // chart should reflect that same judgement. Hidden tokens don't
    // receive any credit and don't reduce credit given to survivors.
    const tokens = new Set<string>();
    for (const t of rawTokens) if (!hiddenWords.has(t)) tokens.add(t);
    if (tokens.size === 0) continue;
    const d = new Date(r.sold_at);
    if (Number.isNaN(d.getTime())) continue;
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    allMonthKeys.add(monthKey);
    const signed = isRefund(r) ? -Math.abs(r.amount) : r.amount;
    // Whole-value attribution: every token on this design gets the full
    // sale $ and full qty. Keyword totals will exceed actual revenue/qty
    // by design — the number answers "revenue on sales featuring this
    // keyword", not "share of revenue owed to this keyword".
    const perToken = signed;
    const qtyPerToken =
      !isRefund(r) && r.type === "sale" ? r.qty : 0;
    for (const tok of tokens) {
      const monthly = byKeyword.get(tok) ?? new Map<string, number>();
      monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + perToken);
      byKeyword.set(tok, monthly);
      totalByKeyword.set(tok, (totalByKeyword.get(tok) ?? 0) + perToken);
      if (qtyPerToken > 0) {
        const monthlyQ = byKeywordQty.get(tok) ?? new Map<string, number>();
        monthlyQ.set(monthKey, (monthlyQ.get(monthKey) ?? 0) + qtyPerToken);
        byKeywordQty.set(tok, monthlyQ);
        totalQtyByKeyword.set(
          tok,
          (totalQtyByKeyword.get(tok) ?? 0) + qtyPerToken,
        );
      }
    }
  }
  const months = Array.from(allMonthKeys).sort();
  // Union of top-N by revenue AND top-N by qty. When the client toggles
  // between $ and qty modes it re-sorts and re-slices this superset —
  // otherwise a keyword that ranks top-20 by qty but bottom-30 by revenue
  // would silently drop out of view in qty mode.
  const topByRev = Array.from(totalByKeyword.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);
  const topByQty = Array.from(totalQtyByKeyword.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);
  const keywords = Array.from(new Set([...topByRev, ...topByQty]));
  const ranked = keywords.map((keyword) => {
    const monthlyMap = byKeyword.get(keyword) ?? new Map<string, number>();
    const monthlyQtyMap =
      byKeywordQty.get(keyword) ?? new Map<string, number>();
    const monthly: Record<string, number> = {};
    const monthlyQty: Record<string, number> = {};
    for (const m of months) {
      monthly[m] = round2(monthlyMap.get(m) ?? 0);
      monthlyQty[m] = round2(monthlyQtyMap.get(m) ?? 0);
    }
    return {
      keyword,
      totalNet: round2(totalByKeyword.get(keyword) ?? 0),
      totalQty: round2(totalQtyByKeyword.get(keyword) ?? 0),
      monthly,
      monthlyQty,
    };
  });
  return { series: ranked, months };
}

export function computeYearly(allRows: SalesRow[]): YearlySeries[] {
  const rows = allRows.filter(isAnalyticsEvent);
  const byYear = new Map<
    number,
    { net: number[]; count: number[]; qty: number[]; total: number }
  >();
  for (const r of rows) {
    const d = new Date(r.sold_at);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const bucket = byYear.get(year) ?? {
      net: new Array(12).fill(0),
      count: new Array(12).fill(0),
      qty: new Array(12).fill(0),
      total: 0,
    };
    if (isRefund(r)) {
      bucket.net[month] -= Math.abs(r.amount);
      bucket.total -= Math.abs(r.amount);
    } else {
      bucket.net[month] += r.amount;
      bucket.count[month] += 1;
      bucket.qty[month] += r.qty;
      bucket.total += r.amount;
    }
    byYear.set(year, bucket);
  }
  return Array.from(byYear, ([year, v]) => ({
    year,
    monthlyNet: v.net.map(round2),
    monthlyCount: v.count,
    monthlyQty: v.qty,
    totalNet: round2(v.total),
  })).sort((a, b) => a.year - b.year);
}

const GUEST_HANDLES = new Set([
  "guest",
  "guest_user",
  "guest user",
  "guestuser",
  "anonymous",
  "anon",
]);

// True if the CSV row represents a guest / anonymous checkout.
//
// Spoonflower's CSV inconsistency: sometimes the Customer column is BLANK
// for guest sales (the "to a guest user" note lives in Description),
// sometimes it's populated with a variant like "guest user" or
// "guest_user". Substring match on "guest" catches all of these while
// still letting named handles that happen to contain the substring pass
// through (e.g. "guestchef42" would be treated as a named handle, but
// that's rare and the miss is one-directional — we'd undercount, not
// falsely inflate).
function isGuestRow(customer: string | null | undefined): boolean {
  if (!customer) return true;
  const trimmed = customer.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (GUEST_HANDLES.has(lower)) return true;
  // Common suffixes/prefixes Spoonflower has used at various times.
  if (lower === "not signed in" || lower === "signed out") return true;
  return false;
}

// Only "sale" and "refund" are customer-facing events that belong in
// the analytics. "debit" (seller spending Spoondollars on their own
// order), "payout" (Spoonflower paying the seller), "credit" (promo
// credit), "adjustment" (manual balance fix) all affect the running
// balance in the CSV but aren't customer transactions — we exclude them
// from every aggregate so revenue/refund/design counts stay clean.
function isAnalyticsEvent(r: SalesRow): boolean {
  return r.type === "sale" || r.type === "refund";
}

// Strict refund check — only rows explicitly typed as refund. We no
// longer treat "amount < 0 && type != sale" as a refund because
// non-customer events (debit, adjustment) can also be negative.
function isRefund(r: SalesRow): boolean {
  return r.type === "refund";
}

// Sum up your own Spoonflower purchases (debit rows) so the analytics
// page can surface a "my purchases" KPI alongside sales revenue —
// otherwise the "why doesn't this match my Spoonflower dashboard?"
// question always resurfaces.
export function computeMyPurchases(allRows: SalesRow[]): MyPurchasesSummary {
  let total = 0;
  let count = 0;
  let firstAt: string | null = null;
  let lastAt: string | null = null;
  for (const r of allRows) {
    if (r.type !== "debit") continue;
    total += Math.abs(r.amount);
    count++;
    if (firstAt == null || r.sold_at < firstAt) firstAt = r.sold_at;
    if (lastAt == null || r.sold_at > lastAt) lastAt = r.sold_at;
  }
  return { total: round2(total), count, firstAt, lastAt };
}

// A "sample" is anything Spoonflower sells to let a buyer test the design
// before committing to yardage: swatches, sample rolls, test prints. The
// Size column encodes it — e.g. "Imperial Wallpaper Swatch", "Test Swatch",
// "Sample Roll".
function isSample(size: string | null | undefined): boolean {
  if (!size) return false;
  const s = size.toLowerCase();
  return s.includes("swatch") || s.includes("sample") || s.includes("test");
}

export function computeHeadline(allRows: SalesRow[]): Headline {
  const rows = allRows.filter(isAnalyticsEvent);
  if (!rows.length) {
    return {
      grossRevenue: 0,
      refundsTotal: 0,
      netRevenue: 0,
      refundRatePct: 0,
      saleCount: 0,
      refundCount: 0,
      avgSaleAmount: 0,
      firstSaleAt: null,
      lastSaleAt: null,
      uniqueDesigns: 0,
      uniqueCustomers: 0,
      guestSaleCount: 0,
      guestSharePct: 0,
      returningCustomers: 0,
    };
  }
  let gross = 0;
  let refunds = 0;
  let saleCount = 0;
  let refundCount = 0;
  let guestSaleCount = 0;
  const designIds = new Set<number>();
  // Named customers only. Guest sales don't roll up here.
  const namedCustomers = new Set<string>();
  // Distinct purchase DAYS per named customer, so a "returning" buyer is
  // someone who came back on a different day — a single-order buyer with
  // multiple items on one day still counts as 1 visit.
  const purchaseDaysByCustomer = new Map<string, Set<string>>();
  let first = rows[0].sold_at;
  let last = rows[0].sold_at;
  for (const r of rows) {
    if (r.sold_at < first) first = r.sold_at;
    if (r.sold_at > last) last = r.sold_at;
    if (r.design_id) designIds.add(r.design_id);
    const isGuest = isGuestRow(r.customer);
    if (!isGuest && r.customer) {
      namedCustomers.add(r.customer);
    }
    if (isRefund(r)) {
      refunds += Math.abs(r.amount);
      refundCount++;
    } else {
      gross += r.amount;
      if (r.type === "sale") {
        saleCount++;
        if (isGuest) guestSaleCount++;
        else if (r.customer) {
          const day = r.sold_at.slice(0, 10);
          const days =
            purchaseDaysByCustomer.get(r.customer) ?? new Set<string>();
          days.add(day);
          purchaseDaysByCustomer.set(r.customer, days);
        }
      }
    }
  }
  // A "returning customer" is one who purchased on at least 2 different
  // calendar days. Multiple items in a single order don't count — it's
  // the come-back-later behavior we care about.
  let returningCustomers = 0;
  for (const days of purchaseDaysByCustomer.values()) {
    if (days.size >= 2) returningCustomers++;
  }
  const net = gross - refunds;
  return {
    grossRevenue: round2(gross),
    refundsTotal: round2(refunds),
    netRevenue: round2(net),
    refundRatePct: gross > 0 ? round2((refunds / gross) * 100) : 0,
    saleCount,
    refundCount,
    avgSaleAmount: saleCount > 0 ? round2(gross / saleCount) : 0,
    firstSaleAt: first,
    lastSaleAt: last,
    uniqueDesigns: designIds.size,
    uniqueCustomers: namedCustomers.size,
    guestSaleCount,
    guestSharePct:
      saleCount > 0 ? round2((guestSaleCount / saleCount) * 100) : 0,
    returningCustomers,
  };
}

// Aggregate sales by ISO weekday (0=Sun, 1=Mon, ..., 6=Sat) and hour (UTC)
// so the day-of-week + hour-of-day heatmap has a single source. Returns
// 7 arrays of 24 numbers each: dayHour[day][hour] = net revenue on that
// slot.
// Raw event list the client uses to build the day/hour heatmap in the
// viewer's local timezone. We can't bucket server-side because we don't
// know the viewer's tz here — and even if we did, per-event conversion
// with DST is easier client-side using the browser's own Intl/Date.
export type HeatmapEvent = { sold_at: string; amount: number };

export function collectHeatmapEvents(allRows: SalesRow[]): HeatmapEvent[] {
  const events: HeatmapEvent[] = [];
  for (const r of allRows) {
    if (!isAnalyticsEvent(r)) continue;
    if (isRefund(r)) continue;
    events.push({ sold_at: r.sold_at, amount: r.amount });
  }
  return events;
}

export function computeDaily(allRows: SalesRow[]): DailyPoint[] {
  const rows = allRows.filter(isAnalyticsEvent);
  const byDay = new Map<
    string,
    { gross: number; refunds: number; count: number; qty: number }
  >();
  for (const r of rows) {
    const day = r.sold_at.slice(0, 10);
    const prev = byDay.get(day) ?? {
      gross: 0,
      refunds: 0,
      count: 0,
      qty: 0,
    };
    if (isRefund(r)) prev.refunds += Math.abs(r.amount);
    else {
      prev.gross += r.amount;
      prev.count++;
      prev.qty += r.qty;
    }
    byDay.set(day, prev);
  }
  const sparse = Array.from(byDay, ([day, v]) => ({
    day,
    gross: round2(v.gross),
    refunds: round2(v.refunds),
    net: round2(v.gross - v.refunds),
    count: v.count,
    qty: v.qty,
  })).sort((a, b) => a.day.localeCompare(b.day));

  if (sparse.length === 0) return [];
  // Fill in missing days between first and last so the trend line is
  // continuous (a day with no sales counts as $0).
  const firstDay = sparse[0].day;
  const lastDay = sparse[sparse.length - 1].day;
  return fillDailyGaps(sparse, firstDay, lastDay);
}

function fillDailyGaps(
  points: DailyPoint[],
  fromDay: string,
  toDay: string,
): DailyPoint[] {
  const byDay = new Map(points.map((p) => [p.day, p]));
  const out: DailyPoint[] = [];
  const cur = new Date(fromDay + "T00:00:00Z");
  const end = new Date(toDay + "T00:00:00Z");
  while (cur.getTime() <= end.getTime()) {
    const day = cur.toISOString().slice(0, 10);
    out.push(
      byDay.get(day) ?? {
        day,
        gross: 0,
        refunds: 0,
        net: 0,
        count: 0,
        qty: 0,
      },
    );
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// Returns every design the user has ever transacted on. The client
// re-sorts by user's chosen dimension (net / sales / refund $ / refund #)
// and filters (e.g. drop $0-refund rows when sorting by refunds), so we
// deliberately do NOT limit here — otherwise designs with low net but
// meaningful refund activity would get clipped before the client sees
// them.
export function computeTopDesigns(allRows: SalesRow[]): DesignAgg[] {
  const rows = allRows.filter(isAnalyticsEvent);
  const map = new Map<number, DesignAgg>();
  for (const r of rows) {
    if (!r.design_id) continue;
    const prev = map.get(r.design_id) ?? {
      design_id: r.design_id,
      design_title: r.design_title ?? "Untitled",
      gross: 0,
      refunds: 0,
      net: 0,
      units: 0,
      saleCount: 0,
      refundCount: 0,
    };
    // Keep the most recently seen title (in case titles drift).
    if (r.design_title) prev.design_title = r.design_title;
    if (isRefund(r)) {
      prev.refunds += Math.abs(r.amount);
      prev.refundCount++;
    } else {
      prev.gross += r.amount;
      prev.units += r.qty;
      if (r.type === "sale") prev.saleCount++;
    }
    prev.net = prev.gross - prev.refunds;
    map.set(r.design_id, prev);
  }
  return Array.from(map.values())
    .map((d) => ({
      ...d,
      gross: round2(d.gross),
      refunds: round2(d.refunds),
      net: round2(d.net),
    }))
    .sort((a, b) => b.net - a.net);
}

// Designs that had at least one refund/cancel, ranked by refund $. Useful
// for spotting substrate/size mismatches ("this design gets returned a lot
// on Cotton Poplin — check color accuracy").
export type ConversionStats = {
  // Total non-refund sample-size purchases.
  sampleCount: number;
  // Samples that were followed by a full-product purchase of the same
  // design by the same customer at any later date. `guest` collapses to
  // one anonymous bucket, so guest→guest counts only if attribution can
  // work — we don't count guest→guest as a conversion since we can't
  // prove it's the same person.
  convertedCount: number;
  // conversions / samples, as a percentage.
  rate: number;
  // Per-design conversion breakdown for the top handful of designs by
  // sample count (only designs where samples > 0).
  perDesign: {
    design_id: number;
    design_title: string;
    samples: number;
    conversions: number;
    rate: number;
    fullRevenue: number;
  }[];
};

export function computeConversion(allRows: SalesRow[]): ConversionStats {
  // Only customer-facing events, then drop refunds — someone can't
  // "convert" a sample they got refunded.
  const clean = allRows.filter(isAnalyticsEvent).filter((r) => !isRefund(r));
  // Pre-index full-product purchases by (customer + design_id) → array
  // of sold_at, so we can quickly ask "did this customer buy the full
  // product at any time?" per sample.
  const fullBy = new Map<string, string[]>();
  for (const r of clean) {
    if (isSample(r.size)) continue;
    if (!r.design_id) continue;
    if (isGuestRow(r.customer)) continue;
    const key = `${r.customer!.toLowerCase()}|${r.design_id}`;
    const list = fullBy.get(key) ?? [];
    list.push(r.sold_at);
    fullBy.set(key, list);
  }

  let samples = 0;
  let conversions = 0;
  const perDesign = new Map<
    number,
    { title: string; samples: number; conversions: number; fullRevenue: number }
  >();
  for (const r of clean) {
    if (!isSample(r.size)) continue;
    if (!r.design_id) continue;
    // Guest samples aren't attributable.
    if (isGuestRow(r.customer)) continue;
    samples++;
    const key = `${r.customer!.toLowerCase()}|${r.design_id}`;
    const laterFullPurchases = (fullBy.get(key) ?? []).filter(
      (t) => t > r.sold_at,
    );
    const converted = laterFullPurchases.length > 0;
    if (converted) conversions++;
    const bucket = perDesign.get(r.design_id) ?? {
      title: r.design_title ?? "Untitled",
      samples: 0,
      conversions: 0,
      fullRevenue: 0,
    };
    bucket.samples++;
    if (converted) bucket.conversions++;
    if (r.design_title) bucket.title = r.design_title;
    perDesign.set(r.design_id, bucket);
  }

  // Sum full-product revenue per design so the per-row row can also show
  // "OK this design's sample funnel converts and it earned $X".
  for (const r of clean) {
    if (isSample(r.size)) continue;
    if (!r.design_id) continue;
    const bucket = perDesign.get(r.design_id);
    if (!bucket) continue;
    bucket.fullRevenue += r.amount;
  }

  return {
    sampleCount: samples,
    convertedCount: conversions,
    rate: samples > 0 ? round2((conversions / samples) * 100) : 0,
    perDesign: Array.from(perDesign, ([design_id, v]) => ({
      design_id,
      design_title: v.title,
      samples: v.samples,
      conversions: v.conversions,
      rate:
        v.samples > 0 ? round2((v.conversions / v.samples) * 100) : 0,
      fullRevenue: round2(v.fullRevenue),
    }))
      .filter((d) => d.samples > 0)
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 15),
  };
}

export function computeMostRefunded(
  rows: SalesRow[],
  limit = 10,
): DesignAgg[] {
  const all = computeTopDesigns(rows);
  return all
    .filter((d) => d.refunds > 0)
    .sort((a, b) => b.refunds - a.refunds)
    .slice(0, limit);
}

export function computeSubstrateBreakdown(rows: SalesRow[]): BucketAgg[] {
  return bucketBy(rows, (r) => r.substrate ?? "Unknown");
}

// Product category = a coarse rollup of what physical product the
// transaction covered. Derived from Size + Substrate heuristics.
//   Wallpaper — any size mentioning "wallpaper", "roll", "swatch" on a
//               wallpaper substrate, or substrate name matching a
//               wallpaper material.
//   Home decor — throw pillow, curtain panel, tablecloth, napkin,
//               table runner, tea towel, etc.
//   Fabric — everything else that's fabric (yardage, fat quarter,
//               fill-a-yard, etc.).
//   Other — couldn't classify (safety catch-all).
export function computeProductCategoryBreakdown(
  rows: SalesRow[],
): BucketAgg[] {
  return bucketBy(rows, (r) => classifyProductCategory(r.size, r.substrate));
}

// Priority order matters. Wallpaper first (substrate is authoritative),
// then finished home decor items (checked BEFORE fabric because a "linen
// cotton canvas tablecloth" is a home decor tablecloth even though
// substrate contains "linen"), then fabric as the yardage fallback.
function classifyProductCategory(
  size: string | null,
  substrate: string | null,
): string {
  const sz = (size ?? "").toLowerCase();
  const sub = (substrate ?? "").toLowerCase();
  const combined = `${sz} ${sub}`;

  // WALLPAPER — substrate mentions wallpaper explicitly, or size names a
  // wallpaper roll/swatch on a wallpaper substrate.
  if (
    sub.includes("wallpaper") ||
    sub.includes("peel and stick") ||
    sub.includes("pre-pasted") ||
    sub.includes("prepasted") ||
    sub.includes("removable") ||
    sub.includes("non-woven") ||
    sub.includes("non woven") ||
    /wallpaper\s*(swatch|sample|roll)/.test(combined)
  ) {
    return "Wallpaper";
  }

  // HOME DECOR sub-buckets — specific finished products. Checked before
  // fabric so that "linen table runner" lands in Table linens, not Fabric.
  if (/pillow|cushion|sham\b/.test(sz)) return "Pillows";
  if (/curtain|drape|valance/.test(sz)) return "Curtains";
  if (/tablecloth|napkin|table runner|placemat|coaster/.test(sz))
    return "Table linens";
  if (/duvet|sheet|blanket|quilt|pillowcase|comforter|bed skirt/.test(sz))
    return "Bedding";
  if (/throw/.test(sz) && !/throw pillow/.test(sz)) return "Bedding";
  if (/tea towel|kitchen towel|apron|cutting board|oven mitt|pot holder/.test(sz))
    return "Kitchen";
  if (/shower curtain|bath mat|bath towel|hand towel|washcloth/.test(sz))
    return "Bath";
  if (/baby|swaddle|burp|onesie|nursery blanket/.test(sz)) return "Baby";
  if (/wall hanging|wall art|tapestry|canvas print/.test(sz)) return "Wall art";
  if (/tote|zipper pouch|bag\b|makeup bag/.test(sz)) return "Bags";
  if (/wrapping paper|gift wrap/.test(sz)) return "Gift wrap";
  if (/sticker|decal/.test(sz)) return "Stickers";

  // FABRIC — yardage sizes are the primary signal; any known fabric
  // substrate + swatch also counts. Everything past here is unfinished
  // yardage, not a finished decor good.
  if (
    /\byard\b/.test(sz) ||
    /fat quarter|fill a yard|fill-a-yard|test swatch/.test(sz) ||
    (sz.includes("swatch") &&
      /cotton|linen|poplin|canvas|chiffon|satin|fleece|jersey|velvet|minky|silk|twill|voile/.test(
        sub,
      ))
  ) {
    return "Fabric";
  }

  // Fallback = generic Decor. We deliberately don't emit "Other" so the
  // breakdown feels complete — anything Spoonflower ships that isn't
  // wallpaper, yardage fabric, or a specifically-named home item lands
  // here as decor.
  return "Decor";
}

export function computeSizeBreakdown(rows: SalesRow[]): BucketAgg[] {
  // Filter out metric units (meter/centimeter/millimeter) and yardage
  // labels — those are US vs metric noise that clutter the breakdown
  // when the useful signal is the actual product size (Fat Quarter,
  // Yard, 9 Foot Roll, etc.). We keep sizes labeled with "yard" only if
  // they also carry a product qualifier ("Fat Quarter", "Long Yard",
  // etc.) via the checkExcludedSize() rule below.
  return bucketBy(
    rows.filter((r) => !isExcludedSize(r.size)),
    (r) => r.size ?? "Unknown",
  );
}

function isExcludedSize(size: string | null | undefined): boolean {
  if (!size) return false;
  // Normalize by lowercasing and collapsing internal whitespace so we can
  // do simple substring checks. The Spoonflower CSV occasionally has
  // trailing spaces or hyphens that slip past a strict anchored regex.
  const s = size.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return false;
  // Also drop test swatches — they're free product samples, not real
  // size buckets people ranking product mix care about.
  if (s.includes("test swatch")) return true;
  // Bare unit rows: "1 yard", "2 yards", "1 meter", "500 mm", "10 cm",
  // "0.5 m", etc. Match a number, optional space, unit token, no extra
  // descriptive text beyond an optional plural s.
  if (
    /^\d+(\.\d+)?\s*(meter|metre|yard|centimeter|centimetre|millimeter|millimetre|cm|mm|yd|m)s?$/.test(
      s,
    )
  ) {
    return true;
  }
  // Belt-and-suspenders: any size that is EXACTLY "<n> unit" style even
  // if my strict regex misses a subtle variant. Cheap substring check.
  const tokens = s.split(" ");
  if (tokens.length === 2 && /^\d+(\.\d+)?$/.test(tokens[0])) {
    const unit = tokens[1].replace(/s$/, "");
    if (
      unit === "yard" ||
      unit === "yd" ||
      unit === "meter" ||
      unit === "metre" ||
      unit === "m" ||
      unit === "centimeter" ||
      unit === "centimetre" ||
      unit === "cm" ||
      unit === "millimeter" ||
      unit === "millimetre" ||
      unit === "mm"
    ) {
      return true;
    }
  }
  return false;
}

function bucketBy(
  allRows: SalesRow[],
  keyOf: (r: SalesRow) => string,
): BucketAgg[] {
  const rows = allRows.filter(isAnalyticsEvent);
  const m = new Map<
    string,
    { gross: number; refunds: number; count: number }
  >();
  for (const r of rows) {
    const key = keyOf(r);
    const prev = m.get(key) ?? { gross: 0, refunds: 0, count: 0 };
    if (isRefund(r)) prev.refunds += Math.abs(r.amount);
    else {
      prev.gross += r.amount;
      prev.count++;
    }
    m.set(key, prev);
  }
  return Array.from(m, ([label, v]) => ({
    label,
    gross: round2(v.gross),
    net: round2(v.gross - v.refunds),
    count: v.count,
  })).sort((a, b) => b.net - a.net);
}

export function computeCustomers(allRows: SalesRow[]): CustomerAgg[] {
  const rows = allRows.filter(isAnalyticsEvent);
  const map = new Map<string, CustomerAgg>();
  for (const r of rows) {
    const isGuest = isGuestRow(r.customer);
    // Include guest rows (empty customer) — they roll up under the
    // "Guest (anonymous)" bucket so the anonymous share is visible.
    // Named customers keep their handle as the map key.
    const key = isGuest ? "__guest__" : (r.customer as string);
    const prev = map.get(key) ?? {
      customer: isGuest ? "guest user" : (r.customer as string),
      isGuest,
      gross: 0,
      refunds: 0,
      net: 0,
      orders: 0,
      firstAt: r.sold_at,
      lastAt: r.sold_at,
    };
    if (r.sold_at < prev.firstAt) prev.firstAt = r.sold_at;
    if (r.sold_at > prev.lastAt) prev.lastAt = r.sold_at;
    if (isRefund(r)) prev.refunds += Math.abs(r.amount);
    else {
      prev.gross += r.amount;
      prev.orders++;
    }
    prev.net = prev.gross - prev.refunds;
    map.set(key, prev);
  }
  return Array.from(map.values())
    .map((c) => ({
      ...c,
      gross: round2(c.gross),
      refunds: round2(c.refunds),
      net: round2(c.net),
    }))
    .sort((a, b) => b.net - a.net);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
